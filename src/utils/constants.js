export const APP_NAME = 'Power BI Lite';

export const LOAD_ROW_HEIGHT = 56;
export const LOAD_LIST_VIEWPORT = 300;
export const LOAD_LIST_OVERSCAN = 6;

export const MIN_W = 220;
export const MIN_H = 160;
export const HANDLE_SIZE = 2;
export const PAGE_SIZE = 50;

export const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export const cursorMap = {
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
  nw: 'nw-resize',
};

/** e.g. `api/v1` from env — full path prefix is `/${...}` */
export const ApiVersion = process.env.NEXT_PUBLIC_API_VERSION;

export const STORAGE_KEY = 'powerbi-dashboard';
export const RECENT_DASHBOARDS_STORAGE_KEY = 'powerbi-recent-dashboard-ids';
export const LAST_SAVED_HASH_KEY = 'powerbi-last-saved-hash';
export const STACKED_BAR_CHART_KEY = 'stackedBar';
