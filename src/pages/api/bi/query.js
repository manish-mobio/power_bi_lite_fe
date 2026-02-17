/**
 * Power BI Lite - Analytical Query API
 * Fetches data from backend, runs aggregation, returns ECharts format
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = req.body;
    if (!config || !config.collection) {
      return res.status(400).json({
        error: 'Invalid config: requires collection',
      });
    }

    const isTable = config.type === 'table';
    if (!isTable && (!config.dimension || !config.measure)) {
      return res.status(400).json({
        error: 'Invalid config: non-table charts require dimension and measure',
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    let apiPath = `${baseUrl}/api/v1/collection/${config.collection}`;
    let url = `${apiPath}?limit=${config.limit || 1000}`;

    let response = await fetch(url);
    if (!response.ok && response.status === 404) {
      apiPath = config.collection
        ? `${baseUrl}/api/v1/${config.collection}`
        : `${baseUrl}/api/v1`;
      url = `${apiPath}?limit=${config.limit || 1000}`;
      response = await fetch(url);
    }
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    let items = Array.isArray(data) ? data : data?.data || data?.results || [];
    if (!items.length && data && typeof data === 'object') {
      const key = Object.keys(data).find((k) => Array.isArray(data[k]));
      if (key) items = data[key];
    }

    if (isTable) {
      const result = getTableData(items, config.selectedFields, config.sortBy, config.sortOrder, config.dimension, config.measure, config.limit);
      return res.status(200).json(result);
    }

    const pipeline = generatePipeline(config);
    let result = runAggregation(items, pipeline);
    result = applySort(result, config.sortBy, config.sortOrder);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[BI Query Error]', error);
    return res.status(500).json({
      error: 'Failed to execute query',
      details: error.message,
    });
  }
}

/**
 * Generate aggregation pipeline (MongoDB-style, run in memory)
 */
function generatePipeline(config) {
  const { dimension, measure, limit = 100 } = config;
  const dimKey = dimension;
  const measureField = measure.field;
  const op = measure.op?.toUpperCase() || 'COUNT';

  return { dimKey, measureField, op, limit };
}

/**
 * Run aggregation on in-memory data
 */
function runAggregation(items, pipeline) {
  const { dimKey, measureField, op, limit } = pipeline;

  const groups = Object.create(null);

  for (const doc of items) {
    const dimValue = getNestedValue(doc, dimKey);
    const key = dimValue === null || dimValue === undefined ? '(empty)' : String(dimValue);

    if (!groups[key]) {
      groups[key] = { values: [], count: 0 };
    }

    const group = groups[key];
    group.count += 1;

    if (op !== 'COUNT' && measureField) {
      const val = getNestedValue(doc, measureField);
      if (typeof val === 'number' && !Number.isNaN(val)) {
        group.values.push(val);
      }
    }
  }

  const result = [];
  for (const [name, group] of Object.entries(groups)) {
    let value;
    switch (op) {
      case 'COUNT':
        value = group.count;
        break;
      case 'SUM':
        value = group.values.reduce((a, b) => a + b, 0);
        break;
      case 'AVG':
        value = group.values.length
          ? group.values.reduce((a, b) => a + b, 0) / group.values.length
          : 0;
        break;
      case 'MIN':
        value = group.values.length ? Math.min(...group.values) : 0;
        break;
      case 'MAX':
        value = group.values.length ? Math.max(...group.values) : 0;
        break;
      default:
        value = group.count;
    }
    result.push({ name, value: Math.round(value * 100) / 100 });
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
function getTableData(items, selectedFields, sortBy, sortOrder, dimension, measure, limit = 100) {
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
    const key = sortBy === 'measure' && measure?.field ? measure.field : dimension || Object.keys(rows[0] || {})[0];
    if (key) {
      rows = [...rows].sort((a, b) => {
        const va = getNestedValue(a, key);
        const vb = getNestedValue(b, key);
        const na = typeof va === 'number';
        const nb = typeof vb === 'number';
        let cmp = 0;
        if (na && nb) cmp = va - vb;
        else cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
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
