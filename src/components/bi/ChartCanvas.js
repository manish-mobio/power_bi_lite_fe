/**
 * Power BI Lite - Chart Canvas (Middle)
 * react-grid-layout area where charts are rendered
 */
import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveGridLayout } from 'react-grid-layout';
import SmartChart from './SmartChart';
import 'react-grid-layout/css/styles.css';

/** Deep clone layout objects - prevents "Cannot assign to read only property" during drag */
function cloneLayouts(layouts) {
  if (!layouts) return {};
  const result = {};
  for (const [breakpoint, items] of Object.entries(layouts)) {
    if (Array.isArray(items)) {
      result[breakpoint] = items.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
        static: item.static,
        moved: item.moved,
      }));
    }
  }
  return result;
}

/** Remove overlaps by placing each item at the lowest free position (vertical compact) */
function compactLayout(items, cols = 12) {
  if (!items.length) return items;
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const result = [];
  for (const item of sorted) {
    const w = item.w || 6;
    const h = item.h || 2;
    let placed = false;
    for (let y = 0; !placed; y++) {
      for (let x = 0; x <= cols - w; x++) {
        const overlaps = result.some(
          (r) =>
            x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y
        );
        if (!overlaps) {
          result.push({ ...item, x, y, w, h });
          placed = true;
        }
      }
    }
  }
  return result;
}

const ChartCanvas = ({ charts, selectedChartId, onSelect, onLayoutChange, savedLayouts, onRefresh, onRemove, onDuplicate, onChartUpdate }) => {
  const layouts = useMemo(() => {
    const chartIds = charts.map((c) => c.id);
    const savedLg = savedLayouts?.lg;
    const hasValidSaved = savedLg?.length === chartIds.length &&
      chartIds.every((id) => savedLg.some((item) => item.i === id));

    if (hasValidSaved && savedLayouts) {
      const validatedLayouts = cloneLayouts(savedLayouts);
      const lgItems = validatedLayouts.lg || [];
      const cols = 12;
      validatedLayouts.lg = compactLayout(lgItems, cols);
      validatedLayouts.md = validatedLayouts.md?.length
        ? compactLayout(validatedLayouts.md, 10)
        : validatedLayouts.lg.map((l) => ({ ...l, w: Math.min(l.w, 5) }));
      validatedLayouts.sm = validatedLayouts.sm?.length
        ? compactLayout(validatedLayouts.sm, 6)
        : validatedLayouts.lg.map((l) => ({ ...l, w: 6 }));
      return validatedLayouts;
    }

    // Generate non-overlapping layouts
    const items = [];
    const cols = 12;
    const itemWidth = 6;
    const itemHeight = 2;
    
    charts.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      items.push({
        i: c.id,
        x: col * itemWidth,
        y: row * itemHeight,
        w: itemWidth,
        h: itemHeight,
      });
    });
    
    return cloneLayouts({
      lg: items,
      md: items.map((l) => ({ ...l, w: 5 })),
      sm: items.map((l) => ({ ...l, w: 6 })),
    });
  }, [charts.map((c) => c.id).join(','), savedLayouts]);

  const syncedLayoutRef = useRef(false);
  useEffect(() => {
    const chartIds = charts.map((c) => c.id);
    const savedLg = savedLayouts?.lg;
    const hasValidSaved =
      savedLg?.length === chartIds.length &&
      chartIds.every((id) => savedLg.some((item) => item.i === id));
    if (charts.length > 0 && !hasValidSaved && layouts?.lg?.length === chartIds.length && onLayoutChange) {
      if (!syncedLayoutRef.current) {
        onLayoutChange(cloneLayouts(layouts));
        syncedLayoutRef.current = true;
      }
    } else if (hasValidSaved) {
      syncedLayoutRef.current = false;
    }
  }, [charts.length, layouts, savedLayouts, onLayoutChange]);

  const handleLayoutChange = useCallback(
    (layout, allLayouts) => {
      // Constrain items to stay within grid boundaries
      const constrainedLayouts = {};
      const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
      const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
      
      for (const [breakpoint, items] of Object.entries(allLayouts || {})) {
        const maxCols = cols[breakpoint] || 12;
        constrainedLayouts[breakpoint] = items.map((item) => {
          // Ensure x + w doesn't exceed maxCols
          const maxX = maxCols - item.w;
          const constrainedX = Math.max(0, Math.min(item.x, maxX));
          // Ensure y is non-negative
          const constrainedY = Math.max(0, item.y);
          return {
            ...item,
            x: constrainedX,
            y: constrainedY,
          };
        });
      }
      
      if (onLayoutChange) onLayoutChange(cloneLayouts(constrainedLayouts));
    },
    [onLayoutChange]
  );

  if (charts.length === 0) {
    return (
      <div className="bi-canvas-empty">
        <p>No charts yet. Add a chart from the Fields panel on the left.</p>
      </div>
    );
  }

  return (
    <div className="bi-chart-canvas">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".bi-chart-title"
        preventCollision={true}
        compactType="vertical"
      >
        {charts.map((config) => (
          <div key={config.id} data-grid={{ w: 6, h: 2, x: 0, y: 0 }}>
            <SmartChart
              config={config}
              isSelected={selectedChartId === config.id}
              onSelect={onSelect}
              onRefresh={onRefresh}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
              onUpdate={onChartUpdate ? (updates) => onChartUpdate(config.id, updates) : undefined}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

ChartCanvas.propTypes = {
  charts: PropTypes.array,
  selectedChartId: PropTypes.string,
  onSelect: PropTypes.func,
  onLayoutChange: PropTypes.func,
  savedLayouts: PropTypes.object,
  onRefresh: PropTypes.func,
  onRemove: PropTypes.func,
  onDuplicate: PropTypes.func,
  onChartUpdate: PropTypes.func,
};

export default ChartCanvas;
