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

  const queryPayload = useMemo(
    () => ({
      id: config?.id,
      collection: config?.collection,
      type: config?.type,
      dimension: config?.dimension,
      legendField: config?.legendField,
      measure: config?.measure,
      measureFields: config?.measureFields,
      metrics: config?.metrics,
      limit: config?.limit,
      selectedFields: config?.selectedFields,
      sortBy: config?.sortBy,
      sortOrder: config?.sortOrder,
      filter: globalFilter || undefined,
    }),
    [
      config?.id,
      config?.collection,
      config?.type,
      config?.dimension,
      config?.legendField,
      config?.measure,
      config?.measureFields,
      config?.metrics,
      config?.limit,
      config?.selectedFields,
      config?.sortBy,
      config?.sortOrder,
      globalFilter,
    ]
  );

  const fetchData = useCallback(() => {
    if (!queryPayload.id || !queryPayload.collection) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    postBiQuery(queryPayload)
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
  }, [queryPayload]);

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
        ? normalizedMetrics.map((m) => `${m.field} (${m.op})`).join(', ')
        : `${config.measure?.field || 'Value'} (${config.measure?.op || 'COUNT'})`;

    const defaultOptionXAxisName =
      config.type === 'stackedBar' ? yAxisName : xAxisName;
    const defaultOptionYAxisName =
      config.type === 'stackedBar' ? xAxisName : yAxisName;

    const trimOverride = (v) =>
      v != null && String(v).trim() !== '' ? String(v).trim() : null;

    const optionXName =
      trimOverride(config.xAxisTitle) ?? defaultOptionXAxisName;
    const optionYName =
      trimOverride(config.yAxisTitle) ?? defaultOptionYAxisName;

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

    // Shared X-axis label config: show all labels, rotate when many/long; tick truncate + hover via ECharts
    const hasManyCategories = names.length > 6;
    const isIdOrLongLabels =
      config.dimension === '_id' ||
      names.some((n) => n && String(n).length > 10);
    const needRotate = hasManyCategories || isIdOrLongLabels;

    const maxCatLabelLen = names.length
      ? Math.max(...names.map((n) => String(n ?? '').length))
      : 0;

    const xTitleLen = String(optionXName ?? '').length;
    const yTitleLen = String(optionYName ?? '').length;

    const maxYValue = (() => {
      let m = 0;
      for (const row of data) {
        if (typeof row.value === 'number' && !Number.isNaN(row.value)) {
          m = Math.max(m, row.value);
        }
        for (const k of measureFieldKeys) {
          if (typeof row[k] === 'number' && !Number.isNaN(row[k])) {
            m = Math.max(m, row[k]);
          }
        }
      }
      return m;
    })();

    const yTickLabelChars = (() => {
      const v = maxYValue;
      if (!Number.isFinite(v)) return 6;
      const abs = Math.abs(v);
      if (abs >= 1e15) return String(v.toExponential(1)).length + 1;
      return Math.ceil(abs).toLocaleString('en-US').length;
    })();

    const valueYNameGap = 52 + Math.min(72, yTickLabelChars * 8);
    const valueYAxisLabelMargin = 10 + Math.min(32, yTickLabelChars * 2);

    const truncateCategoryTicks =
      maxCatLabelLen > 14 ||
      hasManyCategories ||
      isIdOrLongLabels ||
      needRotate;

    const gridBottom =
      config.dimension === '_id'
        ? '22%'
        : needRotate
          ? `${Math.min(
              44,
              26 +
                Math.min(10, Math.floor(names.length * 0.35)) +
                Math.min(8, Math.floor(maxCatLabelLen / 5))
            )}%`
          : xTitleLen > 18 || maxCatLabelLen > 12
            ? '20%'
            : '16%';

    const gridLeftForCartesian =
      config.type === 'bar' ||
      config.type === 'line' ||
      config.type === 'area' ||
      config.type === 'scatter'
        ? `${Math.min(
            34,
            (yTitleLen > 28
              ? 24
              : yTitleLen > 20
                ? 18
                : yTitleLen > 14
                  ? 15
                  : 12) + Math.min(6, Math.floor(yTickLabelChars * 0.9))
          )}%`
        : null;

    const xAxisCategoryNameGap = needRotate
      ? 68 +
        Math.min(
          48,
          Math.floor(names.length * 1.5) + Math.floor(maxCatLabelLen * 0.35)
        )
      : 40 + (xTitleLen > 14 ? 10 : 0);

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

    const axisNameTruncate = { maxWidth: 160, ellipsis: '…' };

    const categoryAxisLabelBase = {
      interval: 0,
      rotate: needRotate ? 45 : 0,
      showMinLabel: true,
      showMaxLabel: true,
      margin: needRotate ? 14 : 10,
      color: xAxisLabelColor,
      fontSize: needRotate ? 11 : 12,
      fontStyle: axisFont.fontStyle,
      fontWeight: axisFont.fontWeight,
      ...(truncateCategoryTicks
        ? {
            width: needRotate ? 96 : 120,
            overflow: 'truncate',
            ellipsis: '…',
          }
        : {}),
    };

    const categoryXAxis = {
      type: 'category',
      data: names,
      name: optionXName,
      nameLocation: 'middle',
      nameGap: xAxisCategoryNameGap,
      nameTruncate: axisNameTruncate,
      nameMoveOverlap: true,
      triggerEvent: true,
      tooltip: { show: true },
      nameTextStyle: {
        color: xAxisLabelColor,
        fontSize: 12,
        fontWeight: 600,
      },
      axisLabel: categoryAxisLabelBase,
    };

    const cartesianValueYAxis = {
      type: 'value',
      name: optionYName,
      nameLocation: 'middle',
      nameGap: valueYNameGap,
      nameRotate: 90,
      nameTruncate: axisNameTruncate,
      nameMoveOverlap: true,
      triggerEvent: true,
      tooltip: { show: true },
      nameTextStyle: {
        color: yAxisLabelColor,
        fontSize: 12,
        fontWeight: 600,
      },
      axisLabel: {
        margin: valueYAxisLabelMargin,
        color: yAxisLabelColor,
        fontStyle: axisFont.fontStyle,
        fontWeight: axisFont.fontWeight,
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
        left: gridLeftForCartesian ?? '3%',
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
          yAxis: { ...cartesianValueYAxis },
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
          yAxis: { ...cartesianValueYAxis },
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
        const stackedLeft =
          maxCatLabelLen > 16 || yTitleLen > 20
            ? '26%'
            : maxCatLabelLen > 10
              ? '20%'
              : '15%';
        const stackedBottom = xTitleLen > 24 ? '12%' : '10%';

        return {
          ...baseOption,
          grid: {
            left: stackedLeft,
            right: '4%',
            bottom: stackedBottom,
            top: 36,
            containLabel: true,
          },
          xAxis: {
            type: 'value',
            name: optionXName,
            nameLocation: 'middle',
            nameGap: 32 + Math.min(36, yTickLabelChars * 2.5),
            nameTruncate: axisNameTruncate,
            nameMoveOverlap: true,
            triggerEvent: true,
            tooltip: { show: true },
            nameTextStyle: {
              color: xAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              margin: 8 + Math.min(20, yTickLabelChars * 2),
              color: xAxisLabelColor,
              fontStyle: axisFont.fontStyle,
              fontWeight: axisFont.fontWeight,
            },
          },
          yAxis: {
            type: 'category',
            data: names,
            name: optionYName,
            nameLocation: 'middle',
            nameGap: 68 + Math.min(50, yTitleLen * 0.9 + maxCatLabelLen * 0.25),
            nameRotate: 90,
            nameTruncate: axisNameTruncate,
            nameMoveOverlap: true,
            triggerEvent: true,
            tooltip: { show: true },
            nameTextStyle: {
              color: yAxisLabelColor,
              fontSize: 12,
              fontWeight: 600,
            },
            axisLabel: {
              interval: 0,
              margin: 10 + Math.min(18, Math.floor(maxCatLabelLen * 0.35)),
              ...(truncateCategoryTicks
                ? {
                    width: 120,
                    overflow: 'truncate',
                    ellipsis: '…',
                  }
                : {}),
              fontSize: 12,
              color: yAxisLabelColor,
              fontStyle: axisFont.fontStyle,
              fontWeight: axisFont.fontWeight,
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
          yAxis: { ...cartesianValueYAxis },
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
            yAxis: { ...cartesianValueYAxis },
            series,
          };
        }

        // No legend field: original multi-metric behaviour
        return {
          ...baseOption,
          xAxis: categoryXAxis,
          yAxis: { ...cartesianValueYAxis },
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
            ...cartesianValueYAxis,
            nameGap: 18,
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
    config?.xAxisTitle,
    config?.yAxisTitle,
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
    xAxisTitle: PropTypes.string,
    yAxisTitle: PropTypes.string,
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
  onRefresh: PropTypes.func,
  onRemove: PropTypes.func,
  onDuplicate: PropTypes.func,
  onUpdate: PropTypes.func,
};

export default SmartChart;
