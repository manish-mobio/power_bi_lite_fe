import constants from './constants';
export const stableStringify = (value) => {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (val && typeof val === 'object') {
      if (seen.has(val)) return undefined;
      seen.add(val);
      if (Array.isArray(val)) return val;
      return Object.keys(val)
        .sort()
        .reduce((acc, k) => {
          acc[k] = val[k];
          return acc;
        }, {});
    }
    return val;
  });
};

export function sanitizeChartsForSave(charts) {
  if (!Array.isArray(charts)) return [];
  return charts.map((c) => {
    if (!c || typeof c !== 'object') return c;
    // Remove UI-only / volatile fields so they don't trigger "changes"
    // eslint-disable-next-line no-unused-vars
    const { refreshedAt: _refreshedAt, ...rest } = c;
    return rest;
  });
}

export function buildDashboardSavePayload({
  name,
  collection,
  charts,
  layouts,
  logo,
}) {
  return {
    name: String(name || '').trim() || 'My Dashboard',
    collection: String(collection || ''),
    charts: sanitizeChartsForSave(charts),
    layouts: layouts || {},
    logo: logo || undefined,
  };
}

export function readRecentDashboardIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(constants.RECENT_DASHBOARDS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map(String);
  } catch {
    return [];
  }
}

export function buildLayoutsAndChartsFromSaved(dashboard) {
  const cfg = dashboard?.charts ?? [];
  if (!Array.isArray(cfg) || cfg.length === 0) {
    return { chartsWithIds: [], validLayouts: {}, collection: '' };
  }
  const chartIds = cfg.map(
    (c) =>
      c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
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
    ...c,
    id: c.id || chartIds[idx],
  }));
  const collection =
    (chartsWithIds[0] && chartsWithIds[0].collection) ||
    dashboard?.collection ||
    '';
  return { chartsWithIds, validLayouts, collection };
}

export function cleanPdfHeaderLabel(str) {
  if (str == null || typeof str !== 'string') return '';
  return (
    str
      .trim()
      .replace(/\s*[▲▼↑↓↗↘%²]\s*$/g, '')
      .replace(/\s+[^\w\s]+$/g, '')
      .trim() || str.trim()
  );
}

export function normalizeSharedUser(entry, idx) {
  const userId = entry?.userId ?? entry?.id ?? `shared-${idx}`;
  return {
    userId: String(userId),
    email: String(entry?.email || entry?.userEmail || '').trim(),
    name: String(entry?.name || entry?.userName || '').trim(),
    role: String(entry?.role || 'Viewer'),
  };
}
