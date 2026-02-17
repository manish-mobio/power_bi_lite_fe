/**
 * Power BI Lite - Config Panel (Right Sidebar)
 * Edit selected chart type, aggregation, sort, and column selection
 */
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AGG_OPS, CHART_TYPES,CHART_TYPE_ICONS, SORT_ORDERS, SORT_BY_OPTIONS } from '@/utils/chartTypes';
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
  table: 'Table',
};

const ConfigPanel = ({ config, fields, layouts, onUpdate, onRemove, onLayoutSizeChange }) => {
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
  const selectedFields = config.selectedFields || [];

  const handleChange = (key, value) => {
    if (key === 'dimension') {
      onUpdate({ dimension: value });
    } else if (key === 'measureField') {
      onUpdate({ measure: { ...config.measure, field: value } });
    } else if (key === 'measureOp') {
      onUpdate({ measure: { ...config.measure, op: value } });
    } else if (key === 'type') {
      // When switching to table, set default limit to 100 if not already set or if current limit is too small
      const updates = { type: value };
      if (value === 'table' && (!config.limit || config.limit < 50)) {
        updates.limit = 100;
      } else if (value !== 'table' && (!config.limit || config.limit > 1000)) {
        updates.limit = 10;
      }
      onUpdate(updates);
    } else if (key === 'limit') {
      onUpdate({ limit: Math.max(1, parseInt(value, 10) || 10) });
    } else if (key === 'sortBy') {
      onUpdate({ sortBy: value });
    } else if (key === 'sortOrder') {
      onUpdate({ sortOrder: value });
    } else if (key === 'selectedFields') {
      onUpdate({ selectedFields: value });
    }
  };

  const toggleField = (fieldName) => {
    const allNames = allFields.map((f) => f.name);
    let next;
    if (selectedFields.length === 0) {
      next = allNames.filter((n) => n !== fieldName);
    } else {
      next = selectedFields.includes(fieldName)
        ? selectedFields.filter((f) => f !== fieldName)
        : [...selectedFields, fieldName];
    }
    if (next.length === 0) next = allNames;
    handleChange('selectedFields', next);
  };

  const allSelected = allFields.length === 0 || selectedFields.length === 0 || selectedFields.length >= allFields.length;
  const someSelected = selectedFields.length > 0;
  const selectAllRef = useRef(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const handleSelectDeselectAll = () => {
    if (allSelected) {
      handleChange('selectedFields', []);
    } else {
      handleChange('selectedFields', allFields.map((f) => f.name));
    }
  };

  const sortable = isTable || ['bar', 'line', 'area', 'stackedBar'].includes(config.type);

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

        {!isTable && (
          <>
            <div className="bi-config-row">
              <label>Group By</label>
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
              <label>Calculation</label>
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
              <label>Measure Field</label>
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
                  checked={selectedFields.length === 0 || selectedFields.includes(f.name)}
                  onChange={() => toggleField(f.name)}
                />
                <span>{f.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bi-config-row">
          <label>Limit {isTable ? '(rows)' : '(results)'}</label>
          <input
            type="number"
            min={1}
            max={isTable ? 10000 : 1000}
            value={config.limit || (isTable ? 100 : 10)}
            onChange={(e) => handleChange('limit', e.target.value)}
          />
        </div>

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
  onUpdate: PropTypes.func,
  onRemove: PropTypes.func,
  onLayoutSizeChange: PropTypes.func,
};

export default ConfigPanel;
