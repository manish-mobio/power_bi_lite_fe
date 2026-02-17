/**
 * Power BI Lite - Dashboard RTK Slice
 * Manages chart configs, selected chart, and layout
 */
import { createSlice } from '@reduxjs/toolkit';

const generateId = () => `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const initialState = {
  collection: 'users',
  charts: [],
  selectedChartId: null,
  layouts: {},
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setCollection: (state, action) => {
      state.collection = action.payload || 'users';
    },

    addChart: (state, action) => {
      const config = action.payload || createDefaultChartConfig();
      config.id = config.id || generateId();
      state.charts.push(config);
      state.selectedChartId = config.id;
    },

    updateChart: (state, action) => {
      const { id, updates } = action.payload;
      const idx = state.charts.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.charts[idx] = { ...state.charts[idx], ...updates };
      }
    },

    removeChart: (state, action) => {
      const id = action.payload;
      state.charts = state.charts.filter((c) => c.id !== id);
      if (state.selectedChartId === id) {
        state.selectedChartId = state.charts[0]?.id || null;
      }
    },

    duplicateChart: (state, action) => {
      const chart = action.payload;
      if (chart) {
        const duplicated = {
          ...chart,
          id: generateId(),
        };
        state.charts.push(duplicated);
        state.selectedChartId = duplicated.id;
      }
    },

    setSelectedChart: (state, action) => {
      state.selectedChartId = action.payload;
    },

    setLayouts: (state, action) => {
      const payload = action.payload || {};
      state.layouts = { ...state.layouts };
      for (const [key, val] of Object.entries(payload)) {
        state.layouts[key] = Array.isArray(val)
          ? val.map((item) => ({ ...item }))
          : val;
      }
    },

    updateChartLayout: (state, action) => {
      const { id, w, h } = action.payload || {};
      if (!id || (w == null && h == null)) return;
      for (const breakpoint of ['lg', 'md', 'sm']) {
        const items = state.layouts[breakpoint];
        if (!Array.isArray(items)) continue;
        const idx = items.findIndex((item) => item.i === id);
        if (idx >= 0) {
          if (w != null) state.layouts[breakpoint][idx].w = Math.min(12, Math.max(1, w));
          if (h != null) state.layouts[breakpoint][idx].h = Math.min(10, Math.max(1, h));
        }
      }
    },

    loadDashboard: (state, action) => {
      const { charts, layouts } = action.payload || {};
      if (charts && Array.isArray(charts)) {
        state.charts = charts.map((c) => ({ ...createDefaultChartConfig(), ...c }));
      }
      if (layouts && typeof layouts === 'object') {
        state.layouts = {};
        for (const [key, val] of Object.entries(layouts)) {
          state.layouts[key] = Array.isArray(val)
            ? val.map((item) => ({ ...item }))
            : val;
        }
      }
    },

    resetDashboard: () => initialState,
  },
});

function createDefaultChartConfig() {
  return {
    id: generateId(),
    type: 'bar',
    collection: 'users',
    dimension: 'gender',
    measure: { field: 'id', op: 'COUNT' },
    limit: 10,
  };
}

export const {
  setCollection,
  addChart,
  updateChart,
  removeChart,
  duplicateChart,
  setSelectedChart,
  setLayouts,
  updateChartLayout,
  loadDashboard,
  resetDashboard,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
