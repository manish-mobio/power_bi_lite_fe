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

const DEFAULT_CANVAS_MIN = { width: 2400, height: 1600 };

/** Single draggable + resizable chart item; positions relative to playground content */
const ChartItem = ({ config, isSelected, onSelect, onRefresh, onRemove, onDuplicate, onUpdate, initialRect, onRectChange, contentBounds }) => {
  const [rect, setRect] = useState(initialRect || { x: 40, y: 40, w: 480, h: 300 });
  const rectRef = useRef(rect);
  const containerRef = useRef(null);

  useEffect(() => { rectRef.current = rect; }, [rect]);

  useEffect(() => {
    onRectChange?.(config.id, rect);
  }, [rect]);

  const getCanvasBounds = useCallback(() => ({
    width: contentBounds.current.width,
    height: contentBounds.current.height,
  }), [contentBounds]);

  const onDragMouseDown = useCallback((e) => {
    if (e.target.dataset.handle) return;
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
      const newX = Math.max(0, Math.min(startRect.x + dx, Math.max(canvas.width, startRect.x + startRect.w) - startRect.w));
      const newY = Math.max(0, Math.min(startRect.y + dy, Math.max(canvas.height, startRect.y + startRect.h) - startRect.h));
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

      if (dir.includes('e')) {
        w = Math.max(MIN_W, startRect.w + dx);
      }
      if (dir.includes('w')) {
        const newX = Math.max(0, Math.min(startRect.x + dx, startRect.x + startRect.w - MIN_W));
        w = startRect.w + (startRect.x - newX);
        x = newX;
      }
      if (dir.includes('s')) {
        h = Math.max(MIN_H, startRect.h + dy);
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
      data-chart-id={config.id}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: 'border-box',
        border: isSelected ? '1px solid rgb(214, 225, 233)' : '1px solid transparent',
        borderRadius: 6,
        
        background: '#fff',
        zIndex: isSelected ? 10 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
        boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
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

      <style>{`
        [data-chart-id="${config.id}"]:hover > [data-handle] {
          opacity: 0.6 !important;
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
  const scrollContainerRef = useRef(null);
  const contentRef = useRef(null);
  const rectsRef = useRef({});
  const contentBounds = useRef({ width: DEFAULT_CANVAS_MIN.width, height: DEFAULT_CANVAS_MIN.height });

  const getInitialRect = useCallback((config, idx) => {
    const saved = savedLayouts?.rects?.[config.id];
    if (saved) return saved;
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    return {
      x: col * 500 + 24,
      y: row * 340 + 24,
      w: 460,
      h: 300,
    };
  }, [savedLayouts]);

  const [contentSize, setContentSize] = useState(() => ({ width: DEFAULT_CANVAS_MIN.width, height: DEFAULT_CANVAS_MIN.height }));

  const updateContentSize = useCallback(() => {
    const rects = rectsRef.current;
    let maxX = DEFAULT_CANVAS_MIN.width;
    let maxY = DEFAULT_CANVAS_MIN.height;
    Object.values(rects).forEach((r) => {
      if (r && typeof r.x === 'number' && typeof r.w === 'number') {
        maxX = Math.max(maxX, r.x + r.w + 80);
      }
      if (r && typeof r.y === 'number' && typeof r.h === 'number') {
        maxY = Math.max(maxY, r.y + r.h + 80);
      }
    });
    contentBounds.current = { width: maxX, height: maxY };
    setContentSize({ width: maxX, height: maxY });
  }, []);

  const handleRectChange = useCallback((id, rect) => {
    rectsRef.current[id] = rect;
    if (onLayoutChange) {
      onLayoutChange({ rects: { ...rectsRef.current } });
    }
    const rects = rectsRef.current;
    let maxX = DEFAULT_CANVAS_MIN.width;
    let maxY = DEFAULT_CANVAS_MIN.height;
    Object.values(rects).forEach((r) => {
      if (r && typeof r.x === 'number' && typeof r.w === 'number') {
        maxX = Math.max(maxX, r.x + r.w + 80);
      }
      if (r && typeof r.y === 'number' && typeof r.h === 'number') {
        maxY = Math.max(maxY, r.y + r.h + 80);
      }
    });
    contentBounds.current = { width: maxX, height: maxY };
    setContentSize({ width: maxX, height: maxY });
  }, [onLayoutChange]);

  const chartIds = charts.map((c) => c.id).join(',');

  useEffect(() => {
    const ids = new Set(charts.map((c) => c.id));
    Object.keys(rectsRef.current).forEach((id) => {
      if (!ids.has(id)) delete rectsRef.current[id];
    });
    charts.forEach((config, idx) => {
      if (!rectsRef.current[config.id]) {
        rectsRef.current[config.id] = getInitialRect(config, idx);
      }
    });
    updateContentSize();
  }, [chartIds, getInitialRect, updateContentSize]);

  // Keyboard delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedChartId) {
        const t = e.target;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) {
          e.preventDefault();
          onRemove?.(selectedChartId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChartId, onRemove]);

  if (charts.length === 0) {
    return (
      <div
        className="bi-canvas-empty"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
          color: '#64748b',
          fontSize: 15,
        }}
      >
        <p>No charts yet. Add a chart from the Fields panel on the left.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="bi-chart-canvas bi-playground"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: '#f1f5f9',
        WebkitOverflowScrolling: 'touch',
      }}
      onMouseDown={(e) => {
        if (e.target === scrollContainerRef.current || e.target === contentRef.current) {
          onSelect?.(null);
        }
      }}
    >
      <div
        ref={contentRef}
        className="bi-playground-content"
        style={{
          position: 'relative',
          width: contentSize.width,
          height: contentSize.height,
          minWidth: contentSize.width,
          minHeight: contentSize.height,
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
            contentBounds={contentBounds}
          />
        ))}
      </div>
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