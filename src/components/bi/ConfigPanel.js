/**
 * Power BI Lite - Config Panel (Right Sidebar)
 * Edit selected chart type, aggregation, sort, and column selection
 */
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AGG_OPS, CHART_TYPES, CHART_TYPE_ICONS, SORT_ORDERS, SORT_BY_OPTIONS } from '@/utils/chartTypes';
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

const ConfigPanel = ({ config, fields, layouts, recordCount, onUpdate, onRemove, onLayoutSizeChange }) => {
  if (!config) {
    return (
      <div className="bi-config-panel">
        <div className="bi-config-panel-header">
          <h3>Chart Config</h3>
        </div>
        <div className="bi-config-empty">Select a chart to configure</div>
      </div>
    );
  }

  const allFields = fields || [];
  const stringFields = allFields.filter((f) => f.type === 'string');
  const numberFields = allFields.filter((f) => f.type === 'number');
  const isTable = config.type === 'table';
  const isPieOrDonut = config.type === 'pie' || config.type === 'donut';
  const isCard = config.type === 'card';
  const hasAxis = ['bar', 'line', 'area', 'stackedBar', 'scatter'].includes(config.type);
  const selectedFields = config.selectedFields || [];

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
      const maxLimit = typeof recordCount === 'number' && recordCount > 0 ? recordCount : (value === 'table' ? 10000 : 1000);
      if (value === 'table' && (!config.limit || config.limit < 50)) {
        updates.limit = Math.min(maxLimit, 100);
      }
      // Do not reset limit to 10 when switching to non-table — keep current limit or user will use max
      onUpdate(updates);
    } else if (key === 'limit') {
      const num = parseInt(value, 10);
      const maxLimit = typeof recordCount === 'number' && recordCount > 0 ? recordCount : 10000;
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
      next = selectedFields.length === 0 ? [fieldName] : [...selectedFields, fieldName];
    }
    handleChange('selectedFields', next);
  };

  // All selected = explicitly all names in selectedFields (empty array means "none selected" for UI)
  const allSelected = allFields.length > 0 && selectedFields.length === allFields.length;
  const someSelected = selectedFields.length > 0 && selectedFields.length < allFields.length;
  const selectAllRef = useRef(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleSelectDeselectAll = () => {
    if (allSelected) {
      handleChange('selectedFields', []);
    } else {
      handleChange('selectedFields', allFields.map((f) => f.name));
    }
  };

  const sortable = isTable || ['bar', 'line', 'area', 'stackedBar'].includes(config.type);
  const showLimit = true;

  const layoutItem = layouts?.lg?.find((item) => item.i === config.id);
  const layoutW = layoutItem?.w ?? 6;
  const layoutH = layoutItem?.h ?? 2;

  return (
    <div className="bi-config-panel">
      <div className="bi-config-panel-header">
        <h3>Chart Config</h3>
      </div>
      <div className="bi-config-body">
        <div className="bi-config-row">
          <label>Chart name</label>
          <input
            type="text"
            className="bi-config-input"
            placeholder="Optional display name"
            value={config.title ?? ''}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>

        <div className="bi-config-row">
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

        {/* Axis charts: X-axis, Y-axis, Legend (Power BI style) */}
        {hasAxis && (
          <>
            <div className="bi-config-row">
              <label>X-axis</label>
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
            <div className="bi-config-row">
              <label>Y-axis</label>
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
            <div className="bi-config-row">
              <label>Legend</label>
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
                    {f.name} (for COUNT)
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Pie / Donut: Legend + Values only (no X/Y) */}
        {isPieOrDonut && (
          <>
            <div className="bi-config-row">
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
            <div className="bi-config-row">
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
            <div className="bi-config-row">
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
            <div className="bi-config-row">
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
            <div className="bi-config-row">
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
            <div className="bi-config-row">
              <label>Category (optional)</label>
              <select
                value={config.dimension}
                onChange={(e) => handleChange('dimension', e.target.value)}
              >
                <option value="">— None —</option>
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
          <div className="bi-config-row">
            <label>Columns to show</label>
            {allFields.length > 0 && (
              <label className="bi-config-select-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={selectAllRef}
                  onChange={handleSelectDeselectAll}
                />
                <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
              </label>
            )}
            <div className="bi-config-column-list">
              {allFields.length === 0 && <span className="bi-config-hint">Load schema first</span>}
              {allFields.map((f) => (
                <label key={f.name} className="bi-config-column-item">
                  <input
                    type="checkbox"
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
          <div className="bi-config-row">
            <label>Limit {isTable ? '(rows)' : '(results)'}</label>
            <input
              type="number"
              min={1}
              max={typeof recordCount === 'number' && recordCount > 0 ? recordCount : (isTable ? 10000 : 1000)}
              value={config.limit ?? (typeof recordCount === 'number' && recordCount > 0 ? recordCount : (isTable ? 100 : 10))}
              onChange={(e) => handleChange('limit', e.target.value)}
            />
          </div>
        )}

        {sortable && (
          <>
            {isTable && (
              <div className="bi-config-row">
                <label>Sort by column</label>
                <select
                  value={config.dimension || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdate({ dimension: val, sortBy: val ? 'dimension' : undefined });
                  }}
                >
                  <option value="">— None —</option>
                  {allFields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isTable && (
              <div className="bi-config-row">
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
            <div className="bi-config-row">
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
          type="button"
          className="bi-remove-chart-btn"
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
  onLayoutSizeChange: PropTypes.func,
};

export default ConfigPanel;
