import { DASHBOARD_ACTION_TYPES } from '@/store/actionTypes/dashboardActionTypes';

const generateId = () =>
  `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const initialDashboardState = {
  collection: '',
  charts: [],
  selectedChartId: null,
  layouts: {},
};

function createDefaultChartConfig() {
  return {
    id: generateId(),
    type: 'bar',
    collection: '',
    dimension: 'gender',
    measure: { field: 'id', op: 'COUNT' },
    limit: 10,
    title: undefined,
  };
}

function cloneLayouts(payload) {
  const next = {};
  const obj = payload && typeof payload === 'object' ? payload : {};
  for (const [key, val] of Object.entries(obj)) {
    next[key] = Array.isArray(val) ? val.map((item) => ({ ...item })) : val;
  }
  return next;
}

export default function dashboardReducer(
  state = initialDashboardState,
  action
) {
  switch (action.type) {
    case DASHBOARD_ACTION_TYPES.SET_COLLECTION: {
      return { ...state, collection: action.payload || '' };
    }

    case DASHBOARD_ACTION_TYPES.ADD_CHART: {
      const base = createDefaultChartConfig();
      const provided = action.payload || {};
      const config = { ...base, ...provided, id: provided.id || base.id };
      return {
        ...state,
        charts: [...state.charts, config],
        selectedChartId: config.id,
      };
    }

    case DASHBOARD_ACTION_TYPES.UPDATE_CHART: {
      const { id, updates } = action.payload || {};
      if (!id) return state;
      const idx = state.charts.findIndex((c) => c.id === id);
      if (idx < 0) return state;
      const nextCharts = state.charts.slice();
      nextCharts[idx] = { ...nextCharts[idx], ...(updates || {}) };
      return { ...state, charts: nextCharts };
    }

    case DASHBOARD_ACTION_TYPES.REMOVE_CHART: {
      const id = action.payload;
      const nextCharts = state.charts.filter((c) => c.id !== id);
      const nextSelected =
        state.selectedChartId === id
          ? nextCharts[0]?.id || null
          : state.selectedChartId;
      return { ...state, charts: nextCharts, selectedChartId: nextSelected };
    }

    case DASHBOARD_ACTION_TYPES.DUPLICATE_CHART: {
      const chart = action.payload;
      if (!chart) return state;
      const duplicated = { ...chart, id: generateId() };
      return {
        ...state,
        charts: [...state.charts, duplicated],
        selectedChartId: duplicated.id,
      };
    }

    case DASHBOARD_ACTION_TYPES.SET_SELECTED_CHART: {
      return { ...state, selectedChartId: action.payload };
    }

    case DASHBOARD_ACTION_TYPES.SET_LAYOUTS: {
      const incoming = action.payload || {};
      return {
        ...state,
        layouts: { ...state.layouts, ...cloneLayouts(incoming) },
      };
    }

    case DASHBOARD_ACTION_TYPES.UPDATE_CHART_LAYOUT: {
      const { id, w, h } = action.payload || {};
      if (!id || (w == null && h == null)) return state;
      const nextLayouts = { ...state.layouts };
      for (const breakpoint of ['lg', 'md', 'sm']) {
        const items = nextLayouts[breakpoint];
        if (!Array.isArray(items)) continue;
        const idx = items.findIndex((item) => item.i === id);
        if (idx < 0) continue;
        const nextItems = items.slice();
        const nextItem = { ...nextItems[idx] };
        if (w != null) nextItem.w = Math.min(12, Math.max(1, w));
        if (h != null) nextItem.h = Math.min(10, Math.max(1, h));
        nextItems[idx] = nextItem;
        nextLayouts[breakpoint] = nextItems;
      }
      return { ...state, layouts: nextLayouts };
    }

    case DASHBOARD_ACTION_TYPES.LOAD_DASHBOARD: {
      const { charts, layouts, collection } = action.payload || {};
      const next = { ...state };

      if (collection != null && String(collection).trim()) {
        next.collection = String(collection).trim();
      }

      if (Array.isArray(charts)) {
        next.charts = charts.map((c) => ({
          ...createDefaultChartConfig(),
          ...c,
        }));
        if (
          next.charts.length &&
          (collection == null || !String(collection).trim())
        ) {
          const firstCollection = next.charts[0].collection;
          if (firstCollection) next.collection = firstCollection;
        }
      }

      if (layouts && typeof layouts === 'object') {
        next.layouts = cloneLayouts(layouts);
      }

      return next;
    }

    case DASHBOARD_ACTION_TYPES.RESET_DASHBOARD: {
      return initialDashboardState;
    }

    default:
      return state;
  }
}
