/**
 * Power BI Lite - SmartChart Component
 * Fetches data from /api/bi/query and renders ECharts
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReactECharts from 'echarts-for-react';

const SmartChart = ({ config, isSelected, onSelect, onRefresh, onRemove, onDuplicate, onUpdate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const fetchData = useCallback(() => {
    if (!config) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/bi/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
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
  }, [config]);

  useEffect(() => {
    fetchData();
  }, [config?.id, config?.collection, config?.dimension, config?.measure?.field, config?.measure?.op, config?.limit, config?.type, config?.selectedFields, config?.sortBy, config?.sortOrder, fetchData]);

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
  const tableData = isTable && Array.isArray(data) ? data : [];

  const handleTableSort = useCallback(
    (columnKey) => {
      if (!onUpdate) return;
      const nextOrder = config.dimension === columnKey && config.sortOrder === 'asc' ? 'desc' : 'asc';
      onUpdate({ dimension: columnKey, sortBy: 'dimension', sortOrder: nextOrder });
    },
    [config.dimension, config.sortOrder, onUpdate]
  );

  const option = useMemo(() => {
    if (isTable) return null;
    if (!data || data.length === 0) return null;

    const names = data.map((d) => d.name);
    const values = data.map((d) => d.value);

    const baseOption = {
      tooltip: { trigger: config.type === 'pie' || config.type === 'donut' ? 'item' : 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
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
          xAxis: { type: 'category', data: names, boundaryGap: false },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: values, smooth: true }],
        };

      case 'area':
        return {
          ...baseOption,
          xAxis: { type: 'category', data: names, boundaryGap: false },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: values, smooth: true, areaStyle: {} }],
        };

      case 'stackedBar':
        return {
          ...baseOption,
          xAxis: { type: 'category', data: names },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: values, stack: 'total', itemStyle: { borderRadius: [4, 4, 0, 0] } }],
        };

      case 'scatter':
        return {
          ...baseOption,
          xAxis: { type: 'category', data: names },
          yAxis: { type: 'value' },
          series: [{ type: 'scatter', data: values.map((v, i) => [i, v]), symbolSize: 10 }],
        };

      case 'bar':
        // Special handling for _id field: ensure all labels are visible
        const isIdField = config.dimension === '_id';
        return {
          ...baseOption,
          grid: {
            left: '3%',
            right: '4%',
            bottom: isIdField ? '20%' : '3%',
            top: '10%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: names,
            axisLabel: {
              rotate: isIdField ? 45 : 0,
              interval: 0, // Show all labels
              showMinLabel: true,
              showMaxLabel: true,
              formatter: (value) => {
                // Truncate long _id values for better display
                if (isIdField && value && value.length > 15) {
                  return value.substring(0, 15) + '...';
                }
                return value;
              },
              textStyle: {
                fontSize: isIdField ? 11 : 12,
              },
            },
          },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
        };

      default:
        return {
          ...baseOption,
          xAxis: { type: 'category', data: names },
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
        <span>
          {config.type === 'table'
            ? (config.selectedFields?.length ? `Table (${config.selectedFields.length} columns)` : 'Table')
            : `${config.dimension} by ${config.measure?.op}(${config.measure?.field || ''})`}
        </span>
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
        {!loading && !error && !isTable && data?.length > 0 && option && (
          <ReactECharts option={option} style={{ height: '100%', minHeight: 200 }} opts={{ renderer: 'canvas' }} />
        )}
      </div>
    </div>
  );
};

SmartChart.propTypes = {
  config: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.oneOf(['bar', 'line', 'pie', 'area', 'stackedBar', 'donut', 'scatter', 'table']),
    collection: PropTypes.string,
    dimension: PropTypes.string,
    measure: PropTypes.shape({
      field: PropTypes.string,
      op: PropTypes.string,
    }),
    limit: PropTypes.number,
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
