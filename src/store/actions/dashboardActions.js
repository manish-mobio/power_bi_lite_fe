import { DASHBOARD_ACTION_TYPES } from '@/store/actionTypes/dashboardActionTypes';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { FORMAT_FAILED_LOAD_DASHBOARD } from '@/utils/messages';
import { DASHBOARD_PAGE_UI } from '@/utils/messages';
import { getDashboardById } from '@/services/biService';

const generateId = () =>
  `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

export function setCollection(collection) {
  return { type: DASHBOARD_ACTION_TYPES.SET_COLLECTION, payload: collection };
}

export function addChart(config) {
  return { type: DASHBOARD_ACTION_TYPES.ADD_CHART, payload: config };
}

export function updateChart({ id, updates }) {
  return {
    type: DASHBOARD_ACTION_TYPES.UPDATE_CHART,
    payload: { id, updates },
  };
}

export function removeChart(id) {
  return { type: DASHBOARD_ACTION_TYPES.REMOVE_CHART, payload: id };
}

export function duplicateChart(chart) {
  return { type: DASHBOARD_ACTION_TYPES.DUPLICATE_CHART, payload: chart };
}

export function setSelectedChart(id) {
  return { type: DASHBOARD_ACTION_TYPES.SET_SELECTED_CHART, payload: id };
}

export function setLayouts(layouts) {
  return { type: DASHBOARD_ACTION_TYPES.SET_LAYOUTS, payload: layouts };
}

export function updateChartLayout({ id, w, h }) {
  return {
    type: DASHBOARD_ACTION_TYPES.UPDATE_CHART_LAYOUT,
    payload: { id, w, h },
  };
}

export function loadDashboard({ charts, layouts, collection }) {
  return {
    type: DASHBOARD_ACTION_TYPES.LOAD_DASHBOARD,
    payload: { charts, layouts, collection },
  };
}

export function resetDashboard() {
  return { type: DASHBOARD_ACTION_TYPES.RESET_DASHBOARD };
}

function buildLayoutsAndCharts(dashboard) {
  const cfg = dashboard?.charts ?? [];
  if (!Array.isArray(cfg) || cfg.length === 0) {
    return { chartsWithIds: [], validLayouts: {}, collection: '' };
  }

  const chartIds = cfg.map((c) => c.id || generateId());
  const validLayouts = {};

  if (dashboard?.layouts?.lg && Array.isArray(dashboard.layouts.lg)) {
    const savedLg = dashboard.layouts.lg;
    const hasValidSaved =
      savedLg.length === chartIds.length &&
      chartIds.every((id) => savedLg.some((item) => item.i === id));

    if (hasValidSaved) {
      validLayouts.lg = savedLg;
      validLayouts.md =
        dashboard.layouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
      validLayouts.sm =
        dashboard.layouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
    } else {
      const items = chartIds.map((id, idx) => ({
        i: id,
        x: (idx % 2) * 6,
        y: Math.floor(idx / 2) * 2,
        w: 6,
        h: 2,
      }));
      validLayouts.lg = items;
      validLayouts.md = items.map((l) => ({ ...l, w: 5 }));
      validLayouts.sm = items.map((l) => ({ ...l, w: 6 }));
    }
  } else {
    const items = chartIds.map((id, idx) => ({
      i: id,
      x: (idx % 2) * 6,
      y: Math.floor(idx / 2) * 2,
      w: 6,
      h: 2,
    }));
    validLayouts.lg = items;
    validLayouts.md = items.map((l) => ({ ...l, w: 5 }));
    validLayouts.sm = items.map((l) => ({ ...l, w: 6 }));
  }

  const savedRects = dashboard?.layouts?.rects;
  if (
    savedRects &&
    typeof savedRects === 'object' &&
    !Array.isArray(savedRects)
  ) {
    const rectsOut = {};
    for (const id of chartIds) {
      if (savedRects[id]) rectsOut[id] = savedRects[id];
    }
    if (Object.keys(rectsOut).length > 0) validLayouts.rects = rectsOut;
  }

  const chartsWithIds = cfg.map((c, idx) => ({
    ...createDefaultChartConfig(),
    ...c,
    id: c.id || chartIds[idx],
  }));

  const collection =
    (chartsWithIds[0] && chartsWithIds[0].collection) ||
    dashboard?.collection ||
    '';

  return { chartsWithIds, validLayouts, collection };
}

/** Thunk: fetch dashboard by id and populate store. */
export function fetchAndLoadDashboardById(id) {
  return async (dispatch) => {
    const res = await getDashboardById(id);
    if (res.status === HTTP_STATUS.NOT_FOUND) {
      const err = new Error(FORMAT_FAILED_LOAD_DASHBOARD(res.status));
      err.status = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    if (!isHttpSuccessStatus(res.status)) {
      const err = new Error(FORMAT_FAILED_LOAD_DASHBOARD(res.status));
      err.status = res.status;
      throw err;
    }

    const data = res.data;
    const { chartsWithIds, validLayouts, collection } =
      buildLayoutsAndCharts(data);
    if (chartsWithIds.length === 0) {
      const err = new Error(DASHBOARD_PAGE_UI.NO_CHARTS);
      err.status = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    dispatch(
      loadDashboard({
        charts: chartsWithIds,
        layouts: validLayouts,
        collection,
      })
    );
    return data;
  };
}
