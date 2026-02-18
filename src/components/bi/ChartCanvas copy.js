// 18 feb 2026 - in this drag height works works
import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveGridLayout } from 'react-grid-layout';
import SmartChart from './SmartChart';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

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
          (r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y
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

const ChartCanvas = ({
  charts,
  selectedChartId,
  onSelect,
  onLayoutChange,
  savedLayouts,
  onRefresh,
  onRemove,
  onDuplicate,
  onChartUpdate,
}) => {
  const layouts = useMemo(() => {
    const chartIds = charts.map((c) => c.id);
    const savedLg = savedLayouts?.lg;
    const hasValidSaved =
      savedLg?.length === chartIds.length &&
      chartIds.every((id) => savedLg.some((item) => item.i === id));

    // ✅ If we have valid saved layouts, return them AS-IS
    // Do NOT run compactLayout here — it was resetting resized heights
    if (hasValidSaved && savedLayouts) {
      return cloneLayouts(savedLayouts);
    }

    // Generate default non-overlapping layouts for new charts
    const items = [];
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
        minW: 2,
        minH: 1,
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

    if (
      charts.length > 0 &&
      !hasValidSaved &&
      layouts?.lg?.length === chartIds.length &&
      onLayoutChange
    ) {
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
      const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
      const constrainedLayouts = {};

      for (const [breakpoint, items] of Object.entries(allLayouts || {})) {
        const maxCols = cols[breakpoint] || 12;
        constrainedLayouts[breakpoint] = items.map((item) => ({
          ...item,
          x: Math.max(0, Math.min(item.x, maxCols - item.w)),
          y: Math.max(0, item.y),
        }));
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
        // preventCollision={true}
        // compactType="vertical"
        preventCollision={false}
        compactType={null}
        isDraggable={true}
        isResizable={true}
        resizeHandles={['se']}
      >
        {charts.map((config) => (
          <div key={config.id}>
            <SmartChart
              config={config}
              isSelected={selectedChartId === config.id}
              onSelect={onSelect}
              onRefresh={onRefresh}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
              onUpdate={
                onChartUpdate
                  ? (updates) => onChartUpdate(config.id, updates)
                  : undefined
              }
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


// height and width drap and drop works
/**
 * Power BI Lite - Chart Canvas
 * Fully flexible resize from all 8 directions (top, bottom, left, right, all corners)
 * Uses custom pixel-based resize instead of react-grid-layout's broken column-unit width resize
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import SmartChart from './SmartChart';

const MIN_W = 220;
const MIN_H = 160;
const HANDLE_SIZE = 2; // px, size of resize handles

// 8 resize directions
const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

const cursorMap = {
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
  nw: 'nw-resize',
};

// Handle styles for each of 8 directions
function getHandleStyle(dir) {
  const h = HANDLE_SIZE;
  const base = {
    position: 'absolute',
    zIndex: 20,
    cursor: cursorMap[dir],
  };
  switch (dir) {
    case 'n':  return { ...base, top: -h/2, left: h, right: h, height: h };
    case 's':  return { ...base, bottom: -h/2, left: h, right: h, height: h };
    case 'e':  return { ...base, right: -h/2, top: h, bottom: h, width: h };
    case 'w':  return { ...base, left: -h/2, top: h, bottom: h, width: h };
    case 'ne': return { ...base, top: -h/2, right: -h/2, width: h*2, height: h*2 };
    case 'se': return { ...base, bottom: -h/2, right: -h/2, width: h*2, height: h*2 };
    case 'sw': return { ...base, bottom: -h/2, left: -h/2, width: h*2, height: h*2 };
    case 'nw': return { ...base, top: -h/2, left: -h/2, width: h*2, height: h*2 };
    default:   return base;
  }
}

/** Single draggable + resizable chart item */
const ChartItem = ({ config, isSelected, onSelect, onRefresh, onRemove, onDuplicate, onUpdate, initialRect, onRectChange, canvasRef }) => {
  const [rect, setRect] = useState(initialRect || { x: 40, y: 40, w: 480, h: 300 });
  const rectRef = useRef(rect);
  const dragRef = useRef(null);
  const containerRef = useRef(null);

  // Keep ref in sync
  useEffect(() => { rectRef.current = rect; }, [rect]);

  // Propagate rect changes up
  useEffect(() => {
    onRectChange?.(config.id, rect);
  }, [rect]);

  const getCanvasBounds = useCallback(() => {
    if (canvasRef?.current) {
      return canvasRef.current.getBoundingClientRect();
    }
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }, [canvasRef]);

  // ── DRAG (move) ──────────────────────────────────────────────────
  const onDragMouseDown = useCallback((e) => {
    if (e.target.dataset.handle) return; // don't drag when clicking a handle
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(config.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...rectRef.current };

    const onMove = (me) => {
      const canvas = getCanvasBounds();
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      const newX = Math.max(0, Math.min(startRect.x + dx, canvas.width - startRect.w));
      const newY = Math.max(0, Math.min(startRect.y + dy, canvas.height - startRect.h));
      const next = { ...rectRef.current, x: newX, y: newY };
      rectRef.current = next;
      setRect(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [config.id, onSelect, getCanvasBounds]);

  // ── RESIZE ───────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(config.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...rectRef.current };

    const onMove = (me) => {
      const canvas = getCanvasBounds();
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;

      let { x, y, w, h } = startRect;

      // Horizontal
      if (dir.includes('e')) {
        w = Math.max(MIN_W, Math.min(startRect.w + dx, canvas.width - x));
      }
      if (dir.includes('w')) {
        const newX = Math.max(0, Math.min(startRect.x + dx, startRect.x + startRect.w - MIN_W));
        w = startRect.w + (startRect.x - newX);
        x = newX;
      }

      // Vertical
      if (dir.includes('s')) {
        h = Math.max(MIN_H, Math.min(startRect.h + dy, canvas.height - y));
      }
      if (dir.includes('n')) {
        const newY = Math.max(0, Math.min(startRect.y + dy, startRect.y + startRect.h - MIN_H));
        h = startRect.h + (startRect.y - newY);
        y = newY;
      }

      const next = { x, y, w, h };
      rectRef.current = next;
      setRect(next);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [config.id, onSelect, getCanvasBounds]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: 'border-box',
        border: isSelected ? '1px solid rgb(214, 225, 233)' : '1px solid transparent',
        borderRadius: 6,
        // boxShadow: isSelected
        //   ? '0 0 0 1px #0078d4, 0 4px 24px rgba(0,120,212,0.18)'
        //   : '0 2px 8px rgba(0,0,0,0.10)',
        background: '#fff',
        zIndex: isSelected ? 10 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
      onClick={() => onSelect?.(config.id)}
    >
      {/* Drag area — the chart title bar acts as handle */}
      <div
        onMouseDown={onDragMouseDown}
        style={{ width: '100%', height: '100%', cursor: 'default' }}
      >
        <SmartChart
          config={config}
          isSelected={isSelected}
          onSelect={onSelect}
          onRefresh={onRefresh}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onUpdate={onUpdate}
        />
      </div>

      {/* 8 resize handles — only visible when selected or on hover */}
      {DIRECTIONS.map((dir) => (
        <div
          key={dir}
          data-handle={dir}
          onMouseDown={(e) => onResizeMouseDown(e, dir)}
          style={{
            ...getHandleStyle(dir),
            opacity: isSelected ? 1 : 0,
            transition: 'opacity 0.15s',
            // Visual dot for corners, bar for edges
            background: dir.length === 2
              ? '#0078d4'           // corner = solid blue dot
              : 'rgba(0,120,212,0.35)', // edge = translucent bar
            borderRadius: dir.length === 2 ? '50%' : 3,
          }}
        />
      ))}

      {/* Show handles on hover even when not selected */}
      <style>{`
        div[data-chartid="${config.id}"]:hover > [data-handle] {
          opacity: 0.5 !important;
        }
      `}</style>
    </div>
  );
};

// ── CANVAS ────────────────────────────────────────────────────────────────────

const ChartCanvas = ({
  charts,
  selectedChartId,
  onSelect,
  onLayoutChange,
  savedLayouts,
  onRefresh,
  onRemove,
  onDuplicate,
  onChartUpdate,
}) => {
  const canvasRef = useRef(null);

  // Convert saved pixel rects or generate defaults
  const getInitialRect = useCallback((config, idx) => {
    const saved = savedLayouts?.rects?.[config.id];
    if (saved) return saved;
    // Auto-position in a 2-column grid
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    return {
      x: col * 500 + 20,
      y: row * 340 + 20,
      w: 460,
      h: 300,
    };
  }, [savedLayouts]);

  const rectsRef = useRef({});

  const handleRectChange = useCallback((id, rect) => {
    rectsRef.current[id] = rect;
    // Debounce saving to parent
    if (onLayoutChange) {
      onLayoutChange({ rects: { ...rectsRef.current } });
    }
  }, [onLayoutChange]);

  if (charts.length === 0) {
    return (
      <div className="bi-canvas-empty" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#888',
        fontSize: 15,
      }}>
        <p>No charts yet. Add a chart from the Fields panel on the left.</p>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="bi-chart-canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 600,
        overflow: 'auto',
        background: '#f3f4f6',
      }}
      onMouseDown={(e) => {
        // Click on empty canvas = deselect
        if (e.target === canvasRef.current) onSelect?.(null);
      }}
    >
      {charts.map((config, idx) => (
        <ChartItem
          key={config.id}
          config={config}
          isSelected={selectedChartId === config.id}
          onSelect={onSelect}
          onRefresh={onRefresh}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onUpdate={onChartUpdate ? (updates) => onChartUpdate(config.id, updates) : undefined}
          initialRect={getInitialRect(config, idx)}
          onRectChange={handleRectChange}
          canvasRef={canvasRef}
        />
      ))}
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