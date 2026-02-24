/**
 * Power BI Lite - SmartChart Component
 * Fetches data from /api/bi/query and renders ECharts
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReactECharts from 'echarts-for-react';

const SmartChart = ({ config, isSelected, onSelect, onRefresh, onRemove, onDuplicate, onUpdate, globalFilter }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const menuRef = useRef(null);
  const titleInputRef = useRef(null);

  const fetchData = useCallback(() => {
    if (!config) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const body = { ...config, filter: globalFilter || undefined };
    fetch('/api/bi/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (Array.isArray(result)) {
          setData(result);
        } else if (result?.error) {
          setError(result.error);
          setData([]);
        } else {
          setData([]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch');
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [config, globalFilter]);

  useEffect(() => {
    fetchData();
  }, [config?.id, config?.collection, config?.dimension, config?.measure?.field, config?.measure?.op, config?.limit, config?.type, config?.selectedFields, config?.sortBy, config?.sortOrder, globalFilter, fetchData]);

  // Auto-refresh every 30s so chart reflects current DB data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Table type: data is array of row objects
  const isTable = config.type === 'table';
  const isCard = config.type === 'card';
  const tableData = isTable && Array.isArray(data) ? data : [];

  const displayTitle = config.title != null && String(config.title).trim() !== ''
    ? String(config.title).trim()
    : config.type === 'table'
      ? (config.selectedFields?.length ? `Table (${config.selectedFields.length} columns)` : 'Table')
      : `${config.dimension || ''} by ${config.measure?.op || 'COUNT'}(${config.measure?.field || ''})`;

  const startEditTitle = () => {
    setTitleInput(displayTitle);
    setEditingTitle(true);
    setShowMenu(false);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const saveTitle = () => {
    const v = titleInput.trim();
    if (onUpdate) onUpdate({ title: v || undefined });
    setEditingTitle(false);
  };

  const handleTableSort = useCallback(
    (columnKey) => {
      if (!onUpdate) return;
      const nextOrder = config.dimension === columnKey && config.sortOrder === 'asc' ? 'desc' : 'asc';
      onUpdate({ dimension: columnKey, sortBy: 'dimension', sortOrder: nextOrder });
    },
    [config.dimension, config.sortOrder, onUpdate]
  );

  const option = useMemo(() => {
    if (isTable || isCard) return null;
    if (!data || data.length === 0) return null;

    const names = data.map((d) => d.name);
    const values = data.map((d) => d.value);

    // Shared X-axis label config: show all labels, rotate when many/long, prevent truncation
    const hasManyCategories = names.length > 6;
    const isIdOrLongLabels = config.dimension === '_id' || names.some((n) => n && String(n).length > 10);
    const needRotate = hasManyCategories || isIdOrLongLabels;
    const gridBottom = config.dimension === '_id' ? '22%' : needRotate ? '18%' : '3%';
    const categoryXAxis = {
      type: 'category',
      data: names,
      axisLabel: {
        interval: 0,
        rotate: needRotate ? 45 : 0,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value) => {
          if (!value) return value;
          const str = String(value);
          if (str.length > 14) return str.substring(0, 14) + '…';
          return str;
        },
        textStyle: { fontSize: needRotate ? 11 : 12 },
      },
    };

    const baseOption = {
      tooltip: { trigger: config.type === 'pie' || config.type === 'donut' ? 'item' : 'axis' },
      grid: { left: '3%', right: '4%', bottom: gridBottom, top: '10%', containLabel: true },
    };

    switch (config.type) {
      case 'pie':
        return {
          ...baseOption,
          series: [
            {
              type: 'pie',
              radius: '70%',
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 2,
              },
              label: { show: true },
              data: data.map((d) => ({ name: d.name, value: d.value })),
            },
          ],
        };

      case 'donut':
        return {
          ...baseOption,
          series: [
            {
              type: 'pie',
              radius: ['35%', '70%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 2,
              },
              label: { show: true },
              data: data.map((d) => ({ name: d.name, value: d.value })),
            },
          ],
        };

      case 'line':
        return {
          ...baseOption,
          xAxis: { ...categoryXAxis, boundaryGap: false },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: values, smooth: true }],
        };

      case 'area':
        return {
          ...baseOption,
          xAxis: { ...categoryXAxis, boundaryGap: false },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: values, smooth: true, areaStyle: {} }],
        };

      case 'stackedBar':
        // Stacked bar: horizontal bars (category on Y-axis, value on X) — visually distinct from vertical bar
        return {
          ...baseOption,
          grid: { left: '15%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
          xAxis: { type: 'value' },
          yAxis: {
            type: 'category',
            data: names,
            axisLabel: {
              interval: 0,
              formatter: (value) => {
                if (!value) return value;
                const str = String(value);
                if (str.length > 14) return str.substring(0, 14) + '…';
                return str;
              },
              textStyle: { fontSize: 12 },
            },
          },
          series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [0, 4, 4, 0] } }],
        };

      case 'scatter':
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: { type: 'value' },
          series: [{ type: 'scatter', data: values.map((v, i) => [i, v]), symbolSize: 10 }],
        };

      case 'bar':
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
        };

      default:
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
        };
    }
  }, [data, config?.type, config?.dimension, isTable]);

  const handleClick = (e) => {
    // Don't select if clicking on menu
    if (e.target.closest('.bi-chart-menu')) return;
    if (onSelect) onSelect(config.id);
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleRefreshClick = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onRefresh) {
      onRefresh(config.id);
    } else {
      fetchData();
    }
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onRemove && config.id) {
      onRemove(config.id);
    }
  };

  const handleDuplicateClick = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onDuplicate && config) {
      onDuplicate(config);
    }
  };

  return (
    <div
      className={`bi-chart-card ${isSelected ? 'bi-chart-selected' : ''}`}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick(e)}
      role="button"
      tabIndex={0}
    >
      <div className="bi-chart-title">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="bi-chart-title-input"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') {
                setTitleInput(displayTitle);
                setEditingTitle(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="bi-chart-title-text"
            onClick={(e) => { e.stopPropagation(); if (onUpdate) startEditTitle(); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onUpdate && startEditTitle()}
            title="Click to rename"
          >
            {displayTitle}
          </span>
        )}
        <div className="bi-chart-menu" ref={menuRef}>
          <button
            type="button"
            className="bi-chart-menu-btn"
            onClick={handleMenuToggle}
            aria-label="Chart menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="4" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="12" r="1.5" />
            </svg>
          </button>
          {showMenu && (
            <div className="bi-chart-menu-dropdown">
              <button type="button" onClick={() => { startEditTitle(); }} className="bi-chart-menu-item">
                <span>✏️</span> Rename
              </button>
              <button type="button" onClick={handleRefreshClick} className="bi-chart-menu-item">
                <span>🔄</span> Refresh
              </button>
              {onDuplicate && (
                <button type="button" onClick={handleDuplicateClick} className="bi-chart-menu-item">
                  <span>📋</span> Duplicate
                </button>
              )}
              {onRemove && (
                <button type="button" onClick={handleRemoveClick} className="bi-chart-menu-item bi-chart-menu-item-danger">
                  <span>🗑️</span> Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="bi-chart-body">
        {loading && <div className="bi-chart-loading">Loading...</div>}
        {error && <div className="bi-chart-error">{error}</div>}
        {!loading && !error && data?.length === 0 && (
          <div className="bi-chart-empty">No data available</div>
        )}
        {!loading && !error && isCard && data?.length > 0 && (
          <div className="bi-chart-card-content" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', padding: '20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px' }}>
              {data[0]?.value != null
                ? (typeof data[0].value === 'number' ? data[0].value.toLocaleString() : String(data[0].value))
                : '—'}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
              {config.measure?.op || 'COUNT'}({config.measure?.field || config.dimension || ''})
            </div>
            {data[0]?.name && (
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{data[0].name}</div>
            )}
          </div>
        )}
        {!loading && !error && isTable && tableData.length > 0 && (
          <div className="bi-chart-table-wrap">
            <table className="bi-chart-table">
              <thead>
                <tr>
                  {Object.keys(tableData[0]).map((key) => {
                    const isSorted = config.dimension === key;
                    return (
                      <th
                        key={key}
                        className={onUpdate ? 'bi-chart-table-th-sortable' : ''}
                        onClick={onUpdate ? () => handleTableSort(key) : undefined}
                        role={onUpdate ? 'button' : undefined}
                        title={onUpdate ? `Sort by ${key}` : undefined}
                      >
                        <span>{key}</span>
                        {isSorted && (
                          <span className="bi-chart-table-sort-icon" aria-hidden>
                            {config.sortOrder === 'asc' ? ' ▲' : ' ▼'}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(tableData[0]).map((key) => (
                      <td key={key}>{row[key] != null ? String(row[key]) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && !isTable && !isCard && data?.length > 0 && option && (
          <ReactECharts option={option} style={{ height: '100%', minHeight: 200 }} opts={{ renderer: 'canvas' }} />
        )}
      </div>
    </div>
  );
};

SmartChart.propTypes = {
  config: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.oneOf(['bar', 'line', 'pie', 'area', 'stackedBar', 'donut', 'scatter', 'table', 'card']),
    collection: PropTypes.string,
    dimension: PropTypes.string,
    measure: PropTypes.shape({
      field: PropTypes.string,
      op: PropTypes.string,
    }),
    limit: PropTypes.number,
    title: PropTypes.string,
    selectedFields: PropTypes.array,
    sortBy: PropTypes.string,
    sortOrder: PropTypes.string,
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
  onRefresh: PropTypes.func,
  onRemove: PropTypes.func,
  onDuplicate: PropTypes.func,
  onUpdate: PropTypes.func,
};

export default SmartChart;
