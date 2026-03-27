/**
 * Power BI Lite - Config Panel (Right Sidebar)
 * Edit selected chart type, aggregation, sort, and column selection
 */
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  AGG_OPS,
  CHART_TYPES,
  CHART_TYPE_ICONS,
  SORT_ORDERS,
  SORT_BY_OPTIONS,
} from '@/utils/chartTypes';
import { Select } from 'antd';
const { Option } = Select;

const CHART_TYPE_LABELS = {
  bar: 'Bar',
  line: 'Line',
  pie: 'Pie',
  area: 'Area',
  stackedBar: 'Stacked Bar',
  donut: 'Donut',
  scatter: 'Scatter',
  card: 'Card',
  table: 'Table',
};

const ConfigPanel = ({
  config,
  fields,
  layouts,
  recordCount,
  onUpdate,
  onRemove,
}) => {
  const allFields = fields || [];
  const selectedFields = config?.selectedFields || [];
  const allSelected =
    allFields.length > 0 && selectedFields.length === allFields.length;
  const someSelected =
    selectedFields.length > 0 && selectedFields.length < allFields.length;
  const selectAllRef = useRef(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (!config) {
    return (
      <div className='bi-config-panel'>
        <div className='bi-config-panel-header'>
          <h3>Chart Config</h3>
        </div>
        <div className='bi-config-empty'>Select a chart to configure</div>
      </div>
    );
  }

  const stringFields = allFields.filter((f) => f.type === 'string');
  const numberFields = allFields.filter((f) => f.type === 'number');
  const isTable = config.type === 'table';
  const isPieOrDonut = config.type === 'pie' || config.type === 'donut';
  const isCard = config.type === 'card';
  const hasAxis = ['bar', 'line', 'area', 'stackedBar', 'scatter'].includes(
    config.type
  );

  // Normalise Y-axis metrics (field + aggregation) for axis charts.
  // This keeps a clear separation between:
  // - X-axis (dimension)
  // - Y-axis metrics (each with its own aggregation op)
  // - Legend (comes from metric field names)
  const normalizedMetrics = (() => {
    // Preferred: explicit metrics array [{ field, op }]
    if (Array.isArray(config.metrics) && config.metrics.length) {
      return config.metrics
        .filter((m) => m && m.field)
        .map((m) => ({
          field: m.field,
          op: (m.op || config.measure?.op || 'COUNT').toUpperCase(),
        }));
    }

    // Legacy: single measure + optional measureFields
    const baseOp = (config.measure?.op || 'COUNT').toUpperCase();
    if (Array.isArray(config.measureFields) && config.measureFields.length) {
      return config.measureFields
        .filter(Boolean)
        .map((field) => ({ field, op: baseOp }));
    }
    if (config.measure?.field) {
      return [{ field: config.measure.field, op: baseOp }];
    }
    return [];
  })();

  const updateMetrics = (nextMetrics) => {
    const cleaned = nextMetrics.filter((m) => m && m.field);
    const primary = cleaned[0] || null;

    onUpdate?.({
      metrics: cleaned,
      // Keep legacy fields in sync for existing API and chart code
      measureFields: cleaned.map((m) => m.field),
      measure: primary
        ? {
            ...(config.measure || {}),
            field: primary.field,
            op: primary.op || 'COUNT',
          }
        : { field: '', op: config.measure?.op || 'COUNT' },
    });
  };

  const handleChange = (key, value) => {
    if (key === 'dimension') {
      onUpdate({ dimension: value });
    } else if (key === 'measureField') {
      onUpdate({ measure: { ...config.measure, field: value } });
    } else if (key === 'measureOp') {
      onUpdate({ measure: { ...config.measure, op: value } });
    } else if (key === 'type') {
      // When switching chart type, keep existing limit; only default table to a reasonable min if very small
      const updates = { type: value };
      const maxLimit =
        typeof recordCount === 'number' && recordCount > 0
          ? recordCount
          : value === 'table'
            ? 10000
            : 1000;
      if (value === 'table' && (!config.limit || config.limit < 50)) {
        updates.limit = Math.min(maxLimit, 100);
      }
      // Do not reset limit to 10 when switching to non-table — keep current limit or user will use max
      onUpdate(updates);
    } else if (key === 'limit') {
      const num = parseInt(value, 10);
      const maxLimit =
        typeof recordCount === 'number' && recordCount > 0
          ? recordCount
          : 10000;
      onUpdate({ limit: Math.min(maxLimit, Math.max(1, num || 1)) });
    } else if (key === 'title') {
      onUpdate({ title: value === '' ? undefined : value });
    } else if (key === 'sortBy') {
      onUpdate({ sortBy: value });
    } else if (key === 'sortOrder') {
      onUpdate({ sortOrder: value });
    } else if (key === 'selectedFields') {
      onUpdate({ selectedFields: value });
    }
  };

  const toggleField = (fieldName) => {
    let next;
    if (selectedFields.includes(fieldName)) {
      next = selectedFields.filter((f) => f !== fieldName);
    } else {
      next =
        selectedFields.length === 0
          ? [fieldName]
          : [...selectedFields, fieldName];
    }
    handleChange('selectedFields', next);
  };

  const handleSelectDeselectAll = () => {
    if (allSelected) {
      handleChange('selectedFields', []);
    } else {
      handleChange(
        'selectedFields',
        allFields.map((f) => f.name)
      );
    }
  };

  const sortable =
    isTable || ['bar', 'line', 'area', 'stackedBar'].includes(config.type);
  const showLimit = true;

  const layoutItem = layouts?.lg?.find((item) => item.i === config.id);
  void layoutItem;

  return (
    <div className='bi-config-panel'>
      <div className='bi-config-panel-header'>
        <h3>Chart Config</h3>
      </div>
      <div className='bi-config-body'>
        <div className='bi-config-row'>
          <label>Chart name</label>
          <input
            type='text'
            className='bi-config-input'
            placeholder='Optional display name'
            value={config.title ?? ''}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>

        <div className='bi-config-row'>
          <label>Chart Type</label>
          <Select
            value={config.type}
            onChange={(value) => handleChange('type', value)}
            style={{ width: '100%' }}
          >
            {CHART_TYPES.map((t) => (
              <Option key={t} value={t}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {CHART_TYPE_ICONS[t]}
                  {CHART_TYPE_LABELS[t] || t}
                </span>
              </Option>
            ))}
          </Select>
          {/* <select
            value={config.type}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            {CHART_TYPES.map((t) => (
              <option key={t} value={t}>
                {CHART_TYPE_LABELS[t] || t}
              </option>
            ))}
          </select> */}
        </div>

        <div className='bi-config-row'>
          <label>Color theme</label>
          <select
            value={config.themeKey || 'default'}
            onChange={(e) => onUpdate?.({ themeKey: e.target.value })}
          >
            <option value='default'>Default</option>
            <option value='pastel'>Pastel</option>
            <option value='dark'>Dark</option>
            <option value='ocean'>Ocean</option>
          </select>
        </div>

        {/* Axis charts: X-axis + Y-axis metrics (each with its own aggregation, Power BI style) */}
        {hasAxis && (
          <>
            <div className='bi-config-row'>
              <label>X-axis</label>
              {/* <Select
                mode="tags"
                allowClear
                placeholder="Select X-axis field(s)"
                value={config.dimensions && Array.isArray(config.dimensions) && config.dimensions.length
                  ? config.dimensions
                  : (config.dimension ? [config.dimension] : [])}
                onChange={(vals) => {
                  const arr = Array.isArray(vals) ? vals : [];
                  onUpdate?.({
                    dimensions: arr,
                    dimension: arr[0] || '',
                  });
                }}
                style={{ width: '100%' }}
              > */}
              <Select
                allowClear
                placeholder='Select X-axis field'
                value={config.dimension || undefined}
                onChange={(val) => {
                  onUpdate?.({
                    dimension: val || '',
                    dimensions: val ? [val] : [], // keep backward compatibility
                  });
                }}
                style={{ width: '100%' }}
              >
                {stringFields.map((f) => (
                  <Option key={f.name} value={f.name}>
                    {f.name}
                  </Option>
                ))}
              </Select>
            </div>
            <div className='bi-config-row'>
              <label>Y-axis metrics</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {normalizedMetrics.map((m, idx) => (
                  <div
                    key={`${m.field}-${idx}`}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    {/* Aggregation operation for this Y-axis */}
                    <select
                      value={m.op}
                      onChange={(e) => {
                        const next = [...normalizedMetrics];
                        next[idx] = { ...next[idx], op: e.target.value };
                        updateMetrics(next);
                      }}
                      style={{ minWidth: 100 }}
                    >
                      {AGG_OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    {/* Y-axis field (metric) */}
                    <Select
                      value={m.field}
                      onChange={(val) => {
                        const next = [...normalizedMetrics];
                        next[idx] = { ...next[idx], field: val };
                        updateMetrics(next);
                      }}
                      style={{ flex: 1 }}
                      placeholder='Select Y-axis field'
                    >
                      {numberFields.map((f) => (
                        <Option key={f.name} value={f.name}>
                          {f.name}
                        </Option>
                      ))}
                      {stringFields.map((f) => (
                        <Option key={f.name} value={f.name}>
                          {f.name} (COUNT)
                        </Option>
                      ))}
                    </Select>

                    {/* Remove this Y-axis metric */}
                    <button
                      type='button'
                      onClick={() => {
                        const next = normalizedMetrics.filter(
                          (_, i) => i !== idx
                        );
                        updateMetrics(next);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#ef4444',
                        fontSize: 16,
                        padding: '0 4px',
                      }}
                      title='Remove Y-axis metric'
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Add new Y-axis metric */}
                <button
                  type='button'
                  onClick={() => {
                    const firstNumeric = numberFields[0]?.name;
                    const firstString = stringFields[0]?.name;
                    const fallbackField =
                      firstNumeric ||
                      firstString ||
                      normalizedMetrics[0]?.field ||
                      config.measure?.field ||
                      '';

                    if (!fallbackField) return;

                    updateMetrics([
                      ...normalizedMetrics,
                      {
                        field: fallbackField,
                        op: (config.measure?.op || 'COUNT').toUpperCase(),
                      },
                    ]);
                  }}
                  style={{
                    marginTop: 4,
                    alignSelf: 'flex-start',
                    borderRadius: 4,
                    border: '1px dashed #cbd5e1',
                    padding: '4px 8px',
                    background: '#f9fafb',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  + Add Y-axis
                </button>
              </div>
            </div>

            <div className='bi-config-row'>
              <label>Legend field</label>
              <select
                value={config.legendField || ''}
                onChange={(e) =>
                  onUpdate?.({ legendField: e.target.value || undefined })
                }
              >
                <option value=''>— None —</option>
                {stringFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className='bi-config-row'>
              <label>X-axis label color</label>
              <input
                type='color'
                value={config.xAxisLabelColor || '#374151'}
                onChange={(e) =>
                  onUpdate?.({ xAxisLabelColor: e.target.value })
                }
              />
            </div>

            <div className='bi-config-row'>
              <label>Y-axis label color</label>
              <input
                type='color'
                value={config.yAxisLabelColor || '#374151'}
                onChange={(e) =>
                  onUpdate?.({ yAxisLabelColor: e.target.value })
                }
              />
            </div>

            <div className='bi-config-row'>
              <label>Axis font style</label>
              <select
                value={config.axisLabelFontStyle || 'regular'}
                onChange={(e) =>
                  onUpdate?.({ axisLabelFontStyle: e.target.value })
                }
              >
                <option value='regular'>Regular</option>
                <option value='bold'>Bold</option>
                <option value='italic'>Italic</option>
                <option value='boldItalic'>Bold italic</option>
              </select>
            </div>
          </>
        )}

        {/* Pie / Donut: Legend + Values only (no X/Y) */}
        {isPieOrDonut && (
          <>
            <div className='bi-config-row'>
              <label>Legend</label>
              <select
                value={config.dimension}
                onChange={(e) => handleChange('dimension', e.target.value)}
              >
                {stringFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='bi-config-row'>
              <label>Values</label>
              <select
                value={config.measure?.op}
                onChange={(e) => handleChange('measureOp', e.target.value)}
              >
                {AGG_OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
            <div className='bi-config-row'>
              <label>Values field</label>
              <select
                value={config.measure?.field}
                onChange={(e) => handleChange('measureField', e.target.value)}
              >
                {numberFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
                {stringFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} (COUNT)
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Card: single Value only */}
        {isCard && (
          <>
            <div className='bi-config-row'>
              <label>Value</label>
              <select
                value={config.measure?.op}
                onChange={(e) => handleChange('measureOp', e.target.value)}
              >
                {AGG_OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
            <div className='bi-config-row'>
              <label>Value field</label>
              <select
                value={config.measure?.field}
                onChange={(e) => handleChange('measureField', e.target.value)}
              >
                {numberFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
                {stringFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} (COUNT)
                  </option>
                ))}
              </select>
            </div>
            <div className='bi-config-row'>
              <label>Category (optional)</label>
              <select
                value={config.dimension}
                onChange={(e) => handleChange('dimension', e.target.value)}
              >
                <option value=''>— None —</option>
                {stringFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {isTable && (
          <div className='bi-config-row'>
            <label>Columns to show</label>
            {allFields.length > 0 && (
              <label className='bi-config-select-all'>
                <input
                  type='checkbox'
                  checked={allSelected}
                  ref={selectAllRef}
                  onChange={handleSelectDeselectAll}
                />
                <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
              </label>
            )}
            <div className='bi-config-column-list'>
              {allFields.length === 0 && (
                <span className='bi-config-hint'>Load schema first</span>
              )}
              {allFields.map((f) => (
                <label key={f.name} className='bi-config-column-item'>
                  <input
                    type='checkbox'
                    checked={selectedFields.includes(f.name)}
                    onChange={() => toggleField(f.name)}
                  />
                  <span>{f.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {showLimit && (
          <div className='bi-config-row'>
            <label>Limit {isTable ? '(rows)' : '(results)'}</label>
            <input
              type='number'
              min={1}
              max={
                typeof recordCount === 'number' && recordCount > 0
                  ? recordCount
                  : isTable
                    ? 10000
                    : 1000
              }
              value={
                config.limit ??
                (typeof recordCount === 'number' && recordCount > 0
                  ? recordCount
                  : isTable
                    ? 100
                    : 10)
              }
              onChange={(e) => handleChange('limit', e.target.value)}
            />
          </div>
        )}

        {sortable && (
          <>
            {isTable && (
              <div className='bi-config-row'>
                <label>Sort by column</label>
                <select
                  value={config.dimension || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdate({
                      dimension: val,
                      sortBy: val ? 'dimension' : undefined,
                    });
                  }}
                >
                  <option value=''>— None —</option>
                  {allFields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isTable && (
              <div className='bi-config-row'>
                <label>Sort By</label>
                <select
                  value={config.sortBy || 'measure'}
                  onChange={(e) => handleChange('sortBy', e.target.value)}
                >
                  {SORT_BY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'dimension' ? 'Dimension' : 'Measure'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className='bi-config-row'>
              <label>Order</label>
              <select
                value={config.sortOrder || 'desc'}
                onChange={(e) => handleChange('sortOrder', e.target.value)}
              >
                {SORT_ORDERS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'asc' ? 'Ascending' : 'Descending'}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <button
          type='button'
          className='bi-remove-chart-btn'
          onClick={() => onRemove(config.id)}
        >
          Remove Chart
        </button>
      </div>
    </div>
  );
};

ConfigPanel.propTypes = {
  config: PropTypes.object,
  fields: PropTypes.array,
  layouts: PropTypes.object,
  recordCount: PropTypes.number,
  onUpdate: PropTypes.func,
  onRemove: PropTypes.func,
};

export default ConfigPanel;
