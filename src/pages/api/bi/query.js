/**
 * Power BI Lite - Analytical Query API
 * Fetches data from backend, runs aggregation, returns ECharts format
 */
import axios from 'axios';
import { API_MSG, FORMAT_BACKEND_ERROR_STATUS } from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  try {
    const config = req.body;
    if (!config || !config.collection) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: API_MSG.INVALID_CONFIG_COLLECTION,
      });
    }

    const isTable = config.type === 'table';
    if (!isTable && (!config.dimension || !config.measure)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: API_MSG.INVALID_CONFIG_CHART_FIELDS,
      });
    }

    let apiPath = `${getBackendBaseUrl}${ApiVersion}/collection/${config.collection}`;
    const isPaginatedTable = isTable && config.paginated;
    const pageSize = Math.max(
      1,
      parseInt(config.pageSize, 10) || parseInt(config.limit, 10) || 50
    );
    const pageIndex = Math.max(0, parseInt(config.pageIndex, 10) || 0);
    const skip = pageIndex * pageSize;
    const urlParams = new URLSearchParams();
    urlParams.set(
      'limit',
      String(isPaginatedTable ? pageSize : config.limit || 1000)
    );
    if (isPaginatedTable) {
      urlParams.set('skip', String(skip));
      urlParams.set('paginated', 'true');
    }
    if (config.filter?.field && config.filter?.type) {
      urlParams.set('filterField', config.filter.field);
      urlParams.set('filterType', config.filter.type);
      if (config.filter.from) urlParams.set('filterFrom', config.filter.from);
      if (config.filter.to) urlParams.set('filterTo', config.filter.to);
      if (config.filter.value)
        urlParams.set('filterValue', config.filter.value);
    }
    let url = `${apiPath}?${urlParams.toString()}`;

    let response = await axios.get(url, { validateStatus: () => true });
    if (
      !isHttpSuccessStatus(response.status) &&
      response.status === HTTP_STATUS.NOT_FOUND
    ) {
      apiPath = config.collection
        ? `${getBackendBaseUrl}${ApiVersion}/${config.collection}`
        : `${getBackendBaseUrl}${ApiVersion}`;
      url = `${apiPath}?${urlParams.toString()}`;
      response = await axios.get(url, { validateStatus: () => true });
    }
    if (!isHttpSuccessStatus(response.status)) {
      throw new Error(FORMAT_BACKEND_ERROR_STATUS(response.status));
    }

    const data = response.data;
    const pagedRows = data?.rows;
    const pagedTotal = typeof data?.total === 'number' ? data.total : null;
    let items = Array.isArray(data)
      ? data
      : Array.isArray(pagedRows)
        ? pagedRows
        : data?.data || data?.results || [];
    if (!items.length && data && typeof data === 'object') {
      const key = Object.keys(data).find((k) => Array.isArray(data[k]));
      if (key) items = data[key];
    }

    if (config.filter && config.filter.field && !isPaginatedTable) {
      items = applyDateFilter(items, config.filter);
    }

    if (isTable) {
      const rows = getTableData(
        items,
        config.selectedFields,
        config.sortBy,
        config.sortOrder,
        config.dimension,
        config.measure,
        isPaginatedTable ? pageSize : config.limit
      );
      if (isPaginatedTable) {
        return res.status(HTTP_STATUS.OK).json({
          rows,
          total: pagedTotal ?? rows.length,
        });
      }
      return res.status(HTTP_STATUS.OK).json(rows);
    }

    const pipeline = generatePipeline(config);
    let result = runAggregation(items, pipeline);
    result = applySort(result, config.sortBy, config.sortOrder);
    return res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    console.error('[BI Query Error]', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: API_MSG.FAILED_EXECUTE_QUERY,
      details: error.message,
    });
  }
}

/**
 * Generate aggregation pipeline (MongoDB-style, run in memory)
 * Supports:
 * - metrics: [{ field, op }]  (per-field aggregation)
 * - legacy: measure{field,op} + measureFields
 */
function generatePipeline(config) {
  const {
    dimension,
    legendField,
    measure,
    measureFields,
    metrics,
    limit = 100,
  } = config;
  const dimKey = dimension;
  const legendKey = legendField || null;
  const defaultOp = measure?.op?.toUpperCase() || 'COUNT';

  // Preferred: explicit metrics array
  let metricDefs =
    Array.isArray(metrics) && metrics.length
      ? metrics
          .filter((m) => m && m.field)
          .map((m) => ({
            field: m.field,
            op: (m.op || defaultOp || 'COUNT').toUpperCase(),
          }))
      : [];

  // Backward compatibility: fall back to measureFields + single op
  if (!metricDefs.length) {
    let fields =
      Array.isArray(measureFields) && measureFields.length
        ? measureFields.filter(Boolean)
        : [];
    if (!fields.length && measure?.field) {
      fields = [measure.field];
    }
    metricDefs = fields.map((field) => ({ field, op: defaultOp || 'COUNT' }));
  }

  const fields = metricDefs.map((m) => m.field);
  const opByField = {};
  metricDefs.forEach((m) => {
    opByField[m.field] = m.op;
  });

  return { dimKey, legendKey, measureFields: fields, opByField, limit };
}

/**
 * Run aggregation on in-memory data
 */
function runAggregation(items, pipeline) {
  const { dimKey, legendKey, measureFields, opByField, limit } = pipeline;

  const groups = Object.create(null);

  for (const doc of items) {
    const dimRaw = getNestedValue(doc, dimKey);
    const legendRaw = legendKey ? getNestedValue(doc, legendKey) : undefined;

    const dimLabel =
      dimRaw === null || dimRaw === undefined ? '(empty)' : String(dimRaw);
    const legendLabel = legendKey
      ? legendRaw === null || legendRaw === undefined
        ? '(empty)'
        : String(legendRaw)
      : undefined;

    const key = legendKey ? `${dimLabel}|||${legendLabel}` : dimLabel;

    if (!groups[key]) {
      groups[key] = {
        dimLabel,
        legendLabel,
        valuesByField: Object.create(null),
        count: 0,
      };
    }

    const group = groups[key];
    group.count += 1;

    if (Array.isArray(measureFields) && measureFields.length) {
      for (const field of measureFields) {
        if (!field) continue;
        if (!group.valuesByField[field]) group.valuesByField[field] = [];
        const fieldOp = (opByField && opByField[field]) || 'COUNT';
        // For COUNT we only need the group.count; for others we collect numeric values.
        if (fieldOp !== 'COUNT') {
          const val = getNestedValue(doc, field);
          if (typeof val === 'number' && !Number.isNaN(val)) {
            group.valuesByField[field].push(val);
          }
        }
      }
    }
  }

  const result = [];
  for (const group of Object.values(groups)) {
    // If no explicit measure fields, behave like legacy COUNT-only aggregation
    if (!measureFields || !measureFields.length) {
      const value = group.count;
      const baseRow = { name: group.dimLabel };
      if (legendKey) baseRow.legend = group.legendLabel;
      baseRow.value = Math.round(value * 100) / 100;
      result.push(baseRow);
      continue;
    }

    const row = { name: group.dimLabel };
    if (legendKey) row.legend = group.legendLabel;
    for (const field of measureFields) {
      const arr = group.valuesByField[field] || [];
      const op = (opByField && opByField[field]) || 'COUNT';
      let value;
      switch (op) {
        case 'COUNT':
          value = group.count;
          break;
        case 'SUM':
          value = arr.reduce((a, b) => a + b, 0);
          break;
        case 'AVG':
          value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
          break;
        case 'MIN':
          value = arr.length ? Math.min(...arr) : 0;
          break;
        case 'MAX':
          value = arr.length ? Math.max(...arr) : 0;
          break;
        default:
          value = group.count;
      }
      row[field] = Math.round(value * 100) / 100;
    }
    result.push(row);
  }

  return result.slice(0, limit);
}

function applySort(result, sortBy, sortOrder) {
  if (!result || !result.length) return result;
  const asc = sortOrder === 'asc';
  const byMeasure = sortBy === 'measure';
  return [...result].sort((a, b) => {
    if (byMeasure) {
      const diff = a.value - b.value;
      return asc ? diff : -diff;
    }
    const na = String(a.name ?? '');
    const nb = String(b.name ?? '');
    const cmp = na.localeCompare(nb, undefined, { numeric: true });
    return asc ? cmp : -cmp;
  });
}

/**
 * Table: return raw rows with optional column filter and sort
 */
function getTableData(
  items,
  selectedFields,
  sortBy,
  sortOrder,
  dimension,
  measure,
  limit = 100
) {
  const maxLimit = Math.min(limit || 100, 10000); // Cap at 10k for performance
  let rows = items.slice(0, maxLimit);

  if (selectedFields && selectedFields.length > 0) {
    rows = rows.map((row) => {
      const out = {};
      selectedFields.forEach((key) => {
        const val = getNestedValue(row, key);
        if (val !== undefined) out[key] = val;
      });
      return out;
    });
  }

  if (sortBy && sortOrder) {
    const key =
      sortBy === 'measure' && measure?.field
        ? measure.field
        : dimension || Object.keys(rows[0] || {})[0];
    if (key) {
      rows = [...rows].sort((a, b) => {
        const va = getNestedValue(a, key);
        const vb = getNestedValue(b, key);
        const na = typeof va === 'number';
        const nb = typeof vb === 'number';
        let cmp = 0;
        if (na && nb) cmp = va - vb;
        else
          cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, {
            numeric: true,
          });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }
  }

  return rows;
}

function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const k of keys) {
    current = current?.[k];
  }
  return current;
}

/**
 * Parse a value (ISO string, timestamp, or Date) to a Date object
 */
function parseDate(val) {
  if (val == null) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Get quarter (1-4) from a Date
 */
function getQuarter(d) {
  if (!d || !(d instanceof Date)) return 0;
  const m = d.getMonth() + 1;
  return Math.ceil(m / 3);
}

/**
 * Apply date filter: keep items where the filter field matches the filter type (date range, month, quarter, year)
 */
function applyDateFilter(items, filter) {
  const { field, type, from, to, value } = filter;
  if (!field || !items.length) return items;

  return items.filter((doc) => {
    const raw = getNestedValue(doc, field);
    const d = parseDate(raw);
    if (!d) return false;

    switch (type) {
      case 'date': {
        if (from) {
          const fromDate = parseDate(from);
          if (fromDate && d < fromDate) return false;
        }
        if (to) {
          const toDate = parseDate(to);
          if (toDate) {
            const toEnd = new Date(toDate);
            toEnd.setHours(23, 59, 59, 999);
            if (d > toEnd) return false;
          }
        }
        return true;
      }
      case 'month': {
        if (!value || !/^\d{4}-\d{2}$/.test(String(value).trim())) return true;
        const [y, m] = String(value).trim().split('-').map(Number);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      }
      case 'quarter': {
        if (!value) return true;
        const match = String(value)
          .trim()
          .match(/^(\d{4})-Q([1-4])$/i);
        if (!match) return true;
        const y = parseInt(match[1], 10);
        const q = parseInt(match[2], 10);
        return d.getFullYear() === y && getQuarter(d) === q;
      }
      case 'year': {
        if (!value) return true;
        const y = parseInt(String(value).trim(), 10);
        return !Number.isNaN(y) && d.getFullYear() === y;
      }
      default:
        return true;
    }
  });
}
