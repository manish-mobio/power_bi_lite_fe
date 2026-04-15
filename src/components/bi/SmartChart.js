/**
 * Power BI Lite - SmartChart Component
 * Fetches data from /api/bi/query and renders ECharts
 */

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import ReactECharts from 'echarts-for-react';
import { CHART_UI } from '@/utils/messages';
import { postBiQuery } from '@/services/biService';
import { COLOR_THEMES } from '@/utils/colors';

const SmartChart = ({
  config,
  isSelected,
  onSelect,
  onRefresh,
  onRemove,
  onDuplicate,
  onUpdate,
  globalFilter,
}) => {
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

    const body = {
      id: config.id,
      collection: config.collection,
      type: config.type,
      dimension: config.dimension,
      legendField: config.legendField,
      measure: config.measure,
      measureFields: config.measureFields,
      metrics: config.metrics,
      limit: config.limit,
      selectedFields: config.selectedFields,
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      filter: globalFilter || undefined,
    };
    postBiQuery(body)
      .then((res) => res.data)
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
          setError(err.message || CHART_UI.FAILED_TO_FETCH);
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config, globalFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Close this chart's menu when another chart's menu opens
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const openedId = e.detail?.id;
      if (openedId && openedId !== config.id) {
        setShowMenu(false);
      }
    };
    window.addEventListener('bi-chart-menu-open', handler);
    return () => window.removeEventListener('bi-chart-menu-open', handler);
  }, [config]);

  // Table type: data is array of row objects
  const isTable = config.type === 'table';
  const isCard = config.type === 'card';
  const tableData = isTable && Array.isArray(data) ? data : [];

  const displayTitle =
    config.title != null && String(config.title).trim() !== ''
      ? String(config.title).trim()
      : config.type === 'table'
        ? config.selectedFields?.length
          ? `Table (${config.selectedFields.length} columns)`
          : 'Table'
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
      const nextOrder =
        config.dimension === columnKey && config.sortOrder === 'asc'
          ? 'desc'
          : 'asc';
      onUpdate({
        dimension: columnKey,
        sortBy: 'dimension',
        sortOrder: nextOrder,
      });
    },
    [config.dimension, config.sortOrder, onUpdate]
  );

  const option = useMemo(() => {
    if (isTable || isCard) return null;
    if (!data || data.length === 0) return null;

    const theme = COLOR_THEMES[config.themeKey] || COLOR_THEMES.default;

    const names = Array.from(new Set(data.map((d) => d.name)));
    const hasLegendField =
      !!config.legendField && data.some((d) => d.legend !== undefined);

    // Detect multi-measure series when API returns multiple numeric keys per row.
    const measureFieldKeys =
      Array.isArray(config.measureFields) && config.measureFields.length
        ? config.measureFields
        : Object.keys(data[0] || {}).filter(
            (k) => k !== 'name' && typeof data[0][k] === 'number'
          );

    const hasMultipleSeries = measureFieldKeys.length > 1;
    const normalizedMetrics =
      Array.isArray(config.metrics) && config.metrics.length
        ? config.metrics
            .filter((m) => m && m.field)
            .map((m) => ({
              field: String(m.field),
              op: String(m.op || config.measure?.op || 'COUNT').toUpperCase(),
            }))
        : measureFieldKeys.map((field) => ({
            field,
            op: String(config.measure?.op || 'COUNT').toUpperCase(),
          }));
    const xAxisName = config.dimension || 'Category';
    const yAxisName =
      normalizedMetrics.length > 0
        ? normalizedMetrics
            .map((m) => `${m.field} (${m.op})`)
            .join(', ')
            .slice(0, 80)
        : `${config.measure?.field || 'Value'} (${config.measure?.op || 'COUNT'})`;

    const singleSeriesValues =
      !hasLegendField && !hasMultipleSeries
        ? data.map((d) => {
            if (typeof d.value === 'number') return d.value;
            const firstKey = measureFieldKeys[0];
            return typeof firstKey === 'string' &&
              typeof d[firstKey] === 'number'
              ? d[firstKey]
              : 0;
          })
        : null;

    // Shared X-axis label config: show all labels, rotate when many/long, prevent truncation
    const hasManyCategories = names.length > 6;
    const isIdOrLongLabels =
      config.dimension === '_id' ||
      names.some((n) => n && String(n).length > 10);
    const needRotate = hasManyCategories || isIdOrLongLabels;
    const gridBottom =
      config.dimension === '_id' ? '22%' : needRotate ? '18%' : '3%';

    const axisFontKey = config.axisLabelFontStyle || 'regular';
    const axisFontMap = {
      regular: { fontStyle: 'normal', fontWeight: '400' },
      bold: { fontStyle: 'normal', fontWeight: '600' },
      italic: { fontStyle: 'italic', fontWeight: '400' },
      boldItalic: { fontStyle: 'italic', fontWeight: '600' },
    };
    const axisFont = axisFontMap[axisFontKey] || axisFontMap.regular;

    const xAxisLabelColor = config.xAxisLabelColor || theme.axisLabelColor;
    const yAxisLabelColor = config.yAxisLabelColor || theme.axisLabelColor;
    const categoryXAxis = {
      type: 'category',
      data: names,
      name: xAxisName,
      nameLocation: 'middle',
      nameGap: needRotate ? 46 : 32,
      nameTextStyle: {
        color: xAxisLabelColor,
        fontSize: 12,
        fontWeight: 600,
      },
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
        textStyle: {
          fontSize: needRotate ? 11 : 12,
          color: xAxisLabelColor,
          fontStyle: axisFont.fontStyle,
          fontWeight: axisFont.fontWeight,
        },
      },
    };

    const baseOption = {
      backgroundColor: theme.backgroundColor,
      color: theme.colors,
      tooltip: {
        trigger:
          config.type === 'pie' || config.type === 'donut' ? 'item' : 'axis',
      },
      grid: {
        // Leave enough room for axis titles (especially Y-axis name)
        left:
          config.type === 'bar' ||
          config.type === 'line' ||
          config.type === 'area' ||
          config.type === 'scatter'
            ? '12%'
            : '3%',
        right: '4%',
        bottom: gridBottom,
        top: '10%',
        containLabel: true,
      },
    };

    switch (config.type) {
      case 'pie': {
        // For pie/donut we expect each data row to have either:
        // - a generic `value` field (legacy behaviour), or
        // - a single numeric measure field (from aggregation pipeline).
        // We normalise both into `{ name, value }` here.
        const pieValueKey =
          measureFieldKeys.length === 1 ? measureFieldKeys[0] : null;

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
              label: {
                show: true,
                formatter: '{b}: {c}',
              },
              data: data.map((d) => ({
                name: d.name,
                value:
                  typeof d.value === 'number'
                    ? d.value
                    : pieValueKey && typeof d[pieValueKey] === 'number'
                      ? d[pieValueKey]
                      : 0,
              })),
            },
          ],
        };
      }

      case 'donut': {
        const donutValueKey =
          measureFieldKeys.length === 1 ? measureFieldKeys[0] : null;

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
              label: {
                show: true,
                formatter: '{b}: {c}',
              },
              data: data.map((d) => ({
                name: d.name,
                value:
                  typeof d.value === 'number'
                    ? d.value
                    : donutValueKey && typeof d[donutValueKey] === 'number'
                      ? d[donutValueKey]
                      : 0,
              })),
            },
          ],
        };
      }
      case 'line': {
        return {
          ...baseOption,
          xAxis: { ...categoryXAxis, boundaryGap: false },
          yAxis: {
            type: 'value',
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 38,
            nameRotate: 90,
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              color: yAxisLabelColor,
              fontStyle: axisFont.fontStyle,
              fontWeight: axisFont.fontWeight,
            },
          },
          series: hasMultipleSeries
            ? measureFieldKeys.map((field) => ({
                name: field,
                type: 'line',
                smooth: true,
                data: data.map((d) =>
                  typeof d[field] === 'number' ? d[field] : 0
                ),
                label: {
                  show: true,
                  position: 'top',
                  formatter: '{c}',
                  color: '#111827',
                  fontSize: 11,
                },
              }))
            : [
                {
                  type: 'line',
                  data: singleSeriesValues,
                  smooth: true,
                  label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}',
                    color: '#111827',
                    fontSize: 11,
                  },
                },
              ],
        };
      }

      case 'area': {
        return {
          ...baseOption,
          xAxis: { ...categoryXAxis, boundaryGap: false },
          yAxis: {
            type: 'value',
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 38,
            nameRotate: 90,
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              color: yAxisLabelColor,
              fontStyle: axisFont.fontStyle,
              fontWeight: axisFont.fontWeight,
            },
          },
          series: hasMultipleSeries
            ? measureFieldKeys.map((field) => ({
                name: field,
                type: 'line',
                smooth: true,
                areaStyle: {},
                data: data.map((d) =>
                  typeof d[field] === 'number' ? d[field] : 0
                ),
                label: {
                  show: true,
                  position: 'top',
                  formatter: '{c}',
                  color: '#111827',
                  fontSize: 11,
                },
              }))
            : [
                {
                  type: 'line',
                  data: singleSeriesValues,
                  smooth: true,
                  areaStyle: {},
                  label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}',
                    color: '#111827',
                    fontSize: 11,
                  },
                },
              ],
        };
      }

      case 'stackedBar': {
        // Stacked bar: horizontal bars (category on Y-axis, value on X)
        return {
          ...baseOption,
          grid: {
            left: '15%',
            right: '4%',
            bottom: '8%',
            top: 36,
            containLabel: true,
          },
          xAxis: {
            type: 'value',
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 26,
            nameTextStyle: {
              color: xAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
          },
          yAxis: {
            type: 'category',
            data: names,
            name: xAxisName,
            nameLocation: 'middle',
            nameGap: 62,
            nameRotate: 90,
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              interval: 0,
              formatter: (value) => {
                if (!value) return value;
                const str = String(value);
                if (str.length > 14) return str.substring(0, 14) + '…';
                return str;
              },
              textStyle: {
                fontSize: 12,
                color: yAxisLabelColor,
                fontStyle: axisFont.fontStyle,
                fontWeight: axisFont.fontWeight,
              },
            },
          },
          series: hasMultipleSeries
            ? measureFieldKeys.map((field) => ({
                name: field,
                type: 'bar',
                stack: 'total',
                data: data.map((d) =>
                  typeof d[field] === 'number' ? d[field] : 0
                ),
                itemStyle: { borderRadius: [0, 4, 4, 0] },
                labelLayout: { hideOverlap: true },
                label: {
                  show: true,
                  position: 'right',
                  formatter: '{c}',
                  color: '#111827',
                  fontSize: 11,
                },
              }))
            : [
                {
                  type: 'bar',
                  data: singleSeriesValues,
                  itemStyle: { borderRadius: [0, 4, 4, 0] },
                  labelLayout: { hideOverlap: true },
                  label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}',
                    color: '#111827',
                    fontSize: 11,
                  },
                },
              ],
        };
      }

      case 'scatter': {
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: {
            type: 'value',
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 38,
            nameRotate: 90,
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              color: yAxisLabelColor,
              fontStyle: axisFont.fontStyle,
              fontWeight: axisFont.fontWeight,
            },
          },
          series: hasMultipleSeries
            ? measureFieldKeys.map((field) => ({
                name: field,
                type: 'scatter',
                data: data.map((d, i) => [
                  i,
                  typeof d[field] === 'number' ? d[field] : 0,
                ]),
                symbolSize: 10,
                label: {
                  show: true,
                  position: 'top',
                  formatter: '{c}',
                  color: '#111827',
                  fontSize: 11,
                },
              }))
            : [
                {
                  type: 'scatter',
                  data: (singleSeriesValues || []).map((v, i) => [i, v]),
                  symbolSize: 10,
                  label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}',
                    color: '#111827',
                    fontSize: 11,
                  },
                },
              ],
        };
      }

      case 'bar': {
        const metricKeys =
          measureFieldKeys.length > 0
            ? measureFieldKeys
            : singleSeriesValues
              ? ['__single__']
              : [];

        const getValue = (row, fieldKey) => {
          if (!row) return 0;
          if (fieldKey === '__single__') {
            if (typeof row.value === 'number') return row.value;
            const firstKey = measureFieldKeys[0];
            if (firstKey && typeof row[firstKey] === 'number')
              return row[firstKey];
            return 0;
          }
          if (fieldKey && typeof row[fieldKey] === 'number')
            return row[fieldKey];
          if (typeof row.value === 'number') return row.value;
          return 0;
        };

        if (hasLegendField && metricKeys.length) {
          const legendValues = Array.from(new Set(data.map((d) => d.legend)));
          const series = [];

          metricKeys.forEach((fieldKey) => {
            legendValues.forEach((legendVal) => {
              const seriesName =
                fieldKey === '__single__'
                  ? String(legendVal ?? '')
                  : `${fieldKey} • ${legendVal ?? ''}`;

              const seriesData = names.map((cat) => {
                const row = data.find(
                  (d) => d.name === cat && d.legend === legendVal
                );
                return getValue(row, fieldKey);
              });

              series.push({
                name: seriesName,
                type: 'bar',
                data: seriesData,
                itemStyle: { borderRadius: [4, 4, 0, 0] },
                labelLayout: { hideOverlap: true },
                label: {
                  show: true,
                  position: 'top',
                  formatter: '{c}',
                  color: '#111827',
                  fontSize: 11,
                },
              });
            });
          });

          return {
            ...baseOption,
            xAxis: categoryXAxis,
            yAxis: {
              type: 'value',
              name: yAxisName,
              nameLocation: 'middle',
              nameGap: 38,
              nameRotate: 90,
              nameTextStyle: {
                color: yAxisLabelColor,
                fontSize: 12,
                fontWeight: 600,
              },
              axisLabel: {
                color: yAxisLabelColor,
                fontStyle: axisFont.fontStyle,
                fontWeight: axisFont.fontWeight,
              },
            },
            series,
          };
        }

        // No legend field: original multi-metric behaviour
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: {
            type: 'value',
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 38,
            nameRotate: 90,
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              color: yAxisLabelColor,
              fontStyle: axisFont.fontStyle,
              fontWeight: axisFont.fontWeight,
            },
          },
          series: hasMultipleSeries
            ? measureFieldKeys.map((field) => ({
                name: field,
                type: 'bar',
                data: data.map((d) =>
                  typeof d[field] === 'number' ? d[field] : 0
                ),
                itemStyle: { borderRadius: [4, 4, 0, 0] },
                labelLayout: { hideOverlap: true },
                label: {
                  show: true,
                  position: 'top',
                  formatter: '{c}',
                  color: '#111827',
                  fontSize: 11,
                },
              }))
            : [
                {
                  type: 'bar',
                  data: singleSeriesValues,
                  itemStyle: { borderRadius: [4, 4, 0, 0] },
                  labelLayout: { hideOverlap: true },
                  label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}',
                    color: '#111827',
                    fontSize: 11,
                  },
                },
              ],
        };
      }

      default:
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: {
            type: 'value',
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 18,
            nameRotate: 90,
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
          },
          series: hasMultipleSeries
            ? measureFieldKeys.map((field) => ({
                name: field,
                type: 'bar',
                data: data.map((d) =>
                  typeof d[field] === 'number' ? d[field] : 0
                ),
                itemStyle: { borderRadius: [4, 4, 0, 0] },
              }))
            : [
                {
                  type: 'bar',
                  data: singleSeriesValues,
                  itemStyle: { borderRadius: [4, 4, 0, 0] },
                },
              ],
        };
    }
  }, [
    data,
    isTable,
    isCard,
    config?.type,
    config?.dimension,
    config?.measureFields,
    config?.metrics,
    config?.measure?.field,
    config?.measure?.op,
    config?.legendField,
    config?.themeKey,
    config?.xAxisLabelColor,
    config?.yAxisLabelColor,
    config?.axisLabelFontStyle,
  ]);

  const handleClick = (e) => {
    // Don't select if clicking on menu button or dropdown
    if (e.target.closest('.bi-chart-menu')) return;
    if (onSelect) onSelect(config.id);
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    const next = !showMenu;
    setShowMenu(next);
    if (next && typeof window !== 'undefined') {
      // Notify other charts to close their menus
      window.dispatchEvent(
        new CustomEvent('bi-chart-menu-open', { detail: { id: config.id } })
      );
    }
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
      role='button'
      tabIndex={0}
    >
      <div className='bi-chart-title'>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type='text'
            className='bi-chart-title-input'
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
            className='bi-chart-title-text'
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdate) startEditTitle();
            }}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onUpdate && startEditTitle()}
            title='Click to rename'
          >
            {displayTitle}
          </span>
        )}
        <div className='bi-chart-menu' ref={menuRef}>
          <button
            type='button'
            className='bi-chart-menu-btn'
            onClick={handleMenuToggle}
            aria-label='Chart menu'
          >
            <svg width='16' height='16' viewBox='0 0 16 16' fill='currentColor'>
              <circle cx='8' cy='4' r='1.5' />
              <circle cx='8' cy='8' r='1.5' />
              <circle cx='8' cy='12' r='1.5' />
            </svg>
          </button>
          {showMenu && (
            <div className='bi-chart-menu-dropdown'>
              <button
                type='button'
                onClick={() => {
                  startEditTitle();
                }}
                className='bi-chart-menu-item'
              >
                <span>✏️</span> Rename
              </button>
              <button
                type='button'
                onClick={handleRefreshClick}
                className='bi-chart-menu-item'
              >
                <span>🔄</span> Refresh
              </button>
              {onDuplicate && (
                <button
                  type='button'
                  onClick={handleDuplicateClick}
                  className='bi-chart-menu-item'
                >
                  <span>📋</span> Duplicate
                </button>
              )}
              {onRemove && (
                <button
                  type='button'
                  onClick={handleRemoveClick}
                  className='bi-chart-menu-item bi-chart-menu-item-danger'
                >
                  <span>🗑️</span> Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className='bi-chart-body'>
        {loading && <div className='bi-chart-loading'>Loading...</div>}
        {error && <div className='bi-chart-error'>{error}</div>}
        {!loading && !error && data?.length === 0 && (
          <div className='bi-chart-empty'>No data available1</div>
        )}
        {!loading && !error && isCard && data?.length > 0 && (
          <div
            className='bi-chart-card-content'
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#2563eb',
                marginBottom: '8px',
              }}
            >
              {data[0]?.value != null
                ? typeof data[0].value === 'number'
                  ? data[0].value.toLocaleString()
                  : String(data[0].value)
                : '—'}
            </div>
            <div
              style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}
            >
              {config.measure?.op || 'COUNT'}(
              {config.measure?.field || config.dimension || ''})
            </div>
            {data[0]?.name && (
              <div
                style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}
              >
                {data[0].name}
              </div>
            )}
          </div>
        )}
        {!loading && !error && isTable && tableData.length > 0 && (
          <div className='bi-chart-table-wrap'>
            <table className='bi-chart-table'>
              <thead>
                <tr>
                  {Object.keys(tableData[0]).map((key) => {
                    const isSorted = config.dimension === key;
                    return (
                      <th
                        key={key}
                        className={onUpdate ? 'bi-chart-table-th-sortable' : ''}
                        onClick={
                          onUpdate ? () => handleTableSort(key) : undefined
                        }
                        role={onUpdate ? 'button' : undefined}
                        title={onUpdate ? `Sort by ${key}` : undefined}
                      >
                        <span>{key}</span>
                        {isSorted && (
                          <span
                            className='bi-chart-table-sort-icon'
                            aria-hidden
                          >
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
                      <td key={key}>
                        {row[key] != null ? String(row[key]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading &&
          !error &&
          !isTable &&
          !isCard &&
          data?.length > 0 &&
          option && (
            <ReactECharts
              option={option}
              style={{ height: '100%', minHeight: 200 }}
              opts={{ renderer: 'canvas' }}
            />
          )}
      </div>
    </div>
  );
};

SmartChart.propTypes = {
  config: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.oneOf([
      'bar',
      'line',
      'pie',
      'area',
      'stackedBar',
      'donut',
      'scatter',
      'table',
      'card',
    ]),
    collection: PropTypes.string,
    dimension: PropTypes.string,
    measure: PropTypes.shape({
      field: PropTypes.string,
      op: PropTypes.string,
    }),
    measureFields: PropTypes.arrayOf(PropTypes.string),
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
