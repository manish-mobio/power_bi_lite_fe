/**
 * Power BI Lite - Main Dashboard (3-column layout)
 * Left: Field List | Middle: Chart Canvas | Right: Config Panel
 */
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addChart,
  updateChart,
  removeChart,
  duplicateChart,
  setSelectedChart,
  setCollection,
  loadDashboard,
  setLayouts,
  updateChartLayout,
  resetDashboard,
} from '@/store/actions/dashboardActions';
const dashboardUtils = require('@/utils/dashboard');
import { AiOutlineExpand, AiOutlineCompress } from 'react-icons/ai';
import FieldList from './FieldList';
import ChartCanvas from './ChartCanvas';
import ConfigPanel from './ConfigPanel';
import ViewDataModal from './ViewDataModal';

// import Copilot from './Copilot';
import styles from './BiDashboard.module.css';
import DashboardToolbar from './DashboardToolbar';
import ProfileBar from './ProfileBar';
import ShareDashboardModal from './ShareDashboardModal';
import { meRequest, logoutRequest } from '@/services/authService';
import {
  getDashboardsList,
  saveDashboard,
  getDashboardById,
  syncDashboard,
  uploadBiFile,
} from '@/services/biService';
import {
  BI_UI,
  FORMAT_FAILED_LOAD_BY_ID,
  FORMAT_PDF_BUILDING_CHARTS,
  FORMAT_PDF_DOWNLOADED_CHARTS,
  FORMAT_PDF_DOWNLOADED_RECORDS,
  FORMAT_UPLOAD_ERROR,
  FORMAT_UPLOAD_NEW,
  FORMAT_UPLOAD_REPLACED,
} from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import {
  STORAGE_KEY,
  RECENT_DASHBOARDS_STORAGE_KEY,
  LAST_SAVED_HASH_KEY,
  APP_NAME,
} from '@/utils/constants';
import { filterVisibleFields } from '@/utils/fieldVisibility';
import {
  errorMessage,
  infoMessage,
  loadingMessage,
  successMessage,
  supportedMimes,
  updateMessage,
} from '@/utils/commonFunctions';
import defaultDashboardLogo from '../../assets/Dashboard.png';

function stableStringify(value) {
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
}

function sanitizeChartsForSave(charts) {
  if (!Array.isArray(charts)) return [];
  return charts.map((c) => {
    if (!c || typeof c !== 'object') return c;
    // Remove UI-only / volatile fields so they don't trigger "changes"
    // eslint-disable-next-line no-unused-vars
    const { refreshedAt: _refreshedAt, ...rest } = c;
    return rest;
  });
}

function buildDashboardSavePayload({
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

function deriveBaseName(d) {
  if (d == null) return 'My Dashboard';
  if (
    typeof d === 'object' &&
    d.baseName != null &&
    String(d.baseName).trim()
  ) {
    return String(d.baseName).trim();
  }
  const n = typeof d === 'string' ? d : String(d?.name || '');
  const stripped = n.replace(/\s+\(v\d+\)\s+.+$/, '').trim();
  return stripped || n.trim() || 'My Dashboard';
}

function lineageKeyOf(doc) {
  if (!doc) return '';
  return String(doc.lineageId || doc._id || '');
}

function groupDashboardsForToolbar(list, currentUserId) {
  const me = String(currentUserId || '');
  const raw = Array.isArray(list) ? list : [];
  const mine = raw.filter((d) => String(d.userId) === me);
  const shared = raw.filter(
    (d) =>
      String(d.userId) !== me &&
      (d.sharedWith || []).some((x) => String(x.userId) === me)
  );

  const fold = (docs, isShared) => {
    const map = new Map();
    for (const d of docs) {
      const key = lineageKeyOf(d);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    const out = [];
    for (const [lk, docs] of map) {
      const sorted = [...docs].sort((a, b) => {
        const va = a.versionNumber || 1;
        const vb = b.versionNumber || 1;
        if (vb !== va) return vb - va;
        return (
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
        );
      });
      const latest = sorted[0];
      const displayName = latest.baseName || deriveBaseName(latest);
      const sharedWith = Array.isArray(latest.sharedWith)
        ? latest.sharedWith
        : [];
      const ownerUserId = String(latest.userId);
      out.push({
        lineageKey: lk,
        displayName: isShared ? `${displayName} (shared)` : displayName,
        latestId: String(latest._id || latest.id),
        latestUpdatedAt: latest.updatedAt,
        ownerUserId,
        isShared,
        isOwnedByMe: ownerUserId === me,
        canManageAccess: ownerUserId === me && sharedWith.length > 0,
        shareCount: sharedWith.length,
      });
    }
    return out;
  };

  const a = fold(mine, false);
  const b = fold(shared, true);
  return [...a, ...b].sort((x, y) =>
    x.displayName.localeCompare(y.displayName, undefined, {
      sensitivity: 'base',
    })
  );
}

function stripSharedSuffix(displayName) {
  return String(displayName || '')
    .replace(/\s*\(shared\)\s*$/i, '')
    .trim();
}

function formatVersionRowLabel(doc) {
  const vn = doc.versionNumber != null ? doc.versionNumber : 1;
  const base = doc.baseName || deriveBaseName(doc);
  const lower = base.toLowerCase();
  const ts = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';
  return ts ? `${lower} (v${vn}) — ${ts}` : `${lower} (v${vn})`;
}

/** Flat list: folder row then version rows (indented in UI). */
function buildLoadModalNestedRows(groups, savedDashboards) {
  const list = Array.isArray(savedDashboards) ? savedDashboards : [];
  const rows = [];
  for (const g of groups) {
    const versions = list
      .filter(
        (d) =>
          String(d.userId) === g.ownerUserId && lineageKeyOf(d) === g.lineageKey
      )
      .sort((a, b) => (a.versionNumber || 1) - (b.versionNumber || 1));

    rows.push({
      rowKey: `folder-${g.lineageKey}`,
      kind: 'folder',
      label: stripSharedSuffix(g.displayName),
      loadId: g.latestId,
      lineageKey: g.lineageKey,
      latestUpdatedAt: g.latestUpdatedAt,
      isShared: g.isShared,
      isOwnedByMe: g.isOwnedByMe,
      canManageAccess: g.canManageAccess,
      shareCount: g.shareCount,
    });
    const latestIdStr = String(g.latestId);
    for (const v of versions) {
      const vid = String(v._id || v.id);
      if (vid === latestIdStr) continue;
      rows.push({
        rowKey: `ver-${v._id}`,
        kind: 'version',
        label: formatVersionRowLabel(v),
        loadId: vid,
        lineageKey: g.lineageKey,
        updatedAt: v.updatedAt,
      });
    }
  }
  return rows;
}

const BiDashboard = () => {
  const dispatch = useDispatch();
  const { collection, charts, selectedChartId, layouts } = useSelector(
    (state) => state.dashboard
  );
  const [fields, setFields] = useState([]);
  const [recordCount, setRecordCount] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [collectionInput, setCollectionInput] = useState(collection);
  const [shareUrl, setShareUrl] = useState('');
  const [dashboardServerId, setDashboardServerId] = useState(null);
  const [dashboardEffectiveRole, setDashboardEffectiveRole] = useState(null); // 'Viewer' | 'Editor'
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [lastSavedHash, setLastSavedHash] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return String(localStorage.getItem(LAST_SAVED_HASH_KEY) || '');
    } catch {
      return '';
    }
  });
  const [chartToDeleteId, setChartToDeleteId] = useState(null);
  const [exportPdfInProgress, setExportPdfInProgress] = useState(false);
  const [viewDataOpen, setViewDataOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardOwnerId, setDashboardOwnerId] = useState(null);
  const [savedDashboards, setSavedDashboards] = useState([]);
  const [recentDashboardIds, setRecentDashboardIds] = useState([]);
  const [dashboardLogo, setDashboardLogo] = useState(defaultDashboardLogo); // base64 data URL for dashboard logo
  const [dataFilter, setDataFilter] = useState(null); // { field, type: 'date'|'month'|'quarter'|'year', from?, to?, value? }
  const [isPlaygroundMaximized, setIsPlaygroundMaximized] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(280);
  const [loadSurfaceKey, setLoadSurfaceKey] = useState(0);

  /** Server-computed: collaborator fork differs from owner’s latest (owners only). */
  const [pendingCollaboratorSync, setPendingCollaboratorSync] =
    useState(undefined);

  const isOwner = useMemo(
    () =>
      Boolean(
        me && dashboardOwnerId && String(me.id) === String(dashboardOwnerId)
      ),
    [me, dashboardOwnerId]
  );

  const isReadOnly =
    Boolean(dashboardServerId) &&
    dashboardEffectiveRole !== 'Editor' &&
    !isOwner;

  const dashboardGroups = useMemo(
    () => groupDashboardsForToolbar(savedDashboards, me?.id),
    [savedDashboards, me?.id]
  );

  const loadModalNestedRows = useMemo(
    () => buildLoadModalNestedRows(dashboardGroups, savedDashboards),
    [dashboardGroups, savedDashboards]
  );

  const syncDisabled = useMemo(
    () => !isOwner || !dashboardServerId || isReadOnly,
    [isOwner, dashboardServerId, isReadOnly]
  );

  /** Short label for shared access (owner uses full editor experience; no badge). */
  const accessModeLabel = useMemo(() => {
    if (!dashboardServerId || isOwner) return '';
    if (dashboardEffectiveRole === 'Viewer') return 'Viewer · view only';
    if (dashboardEffectiveRole === 'Editor') return 'Editor · shared';
    return '';
  }, [dashboardServerId, isOwner, dashboardEffectiveRole]);

  // const [copilotOpen, setCopilotOpen] = useState(false);
  const debounceTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const resizingRef = useRef(null); // 'left' | 'right' | null
  const resizeStartXRef = useRef(0);
  const startLeftWidthRef = useRef(leftSidebarWidth);
  const startRightWidthRef = useRef(rightSidebarWidth);

  const selectedChart = charts.find((c) => c.id === selectedChartId);
  const defaultDashboardLogoSrc = useMemo(() => {
    if (typeof defaultDashboardLogo === 'string') return defaultDashboardLogo;
    if (
      defaultDashboardLogo &&
      typeof defaultDashboardLogo === 'object' &&
      typeof defaultDashboardLogo.src === 'string'
    ) {
      return defaultDashboardLogo.src;
    }
    return '';
  }, []);
  const dashboardLogoSrc = useMemo(() => {
    if (typeof dashboardLogo === 'string') return dashboardLogo;
    if (
      dashboardLogo &&
      typeof dashboardLogo === 'object' &&
      typeof dashboardLogo.src === 'string'
    ) {
      return dashboardLogo.src;
    }
    return '';
  }, [dashboardLogo]);
  const headerLogoSrc = dashboardLogoSrc || defaultDashboardLogoSrc;
  const bumpLoadSurfaceKey = useCallback(() => {
    setLoadSurfaceKey((prev) => prev + 1);
  }, []);

  const refreshSavedDashboards = useCallback(async () => {
    const res = await getDashboardsList();
    const list = Array.isArray(res?.data) ? res.data : [];
    setSavedDashboards(list);
    return list;
  }, []);

  // Keep stable callback identity: ChartItem emits rect changes via an effect,
  // and an unstable onLayoutChange prop can cause a render -> effect -> dispatch loop.
  const handleCanvasLayoutChange = useCallback(
    (allLayouts) => {
      dispatch(setLayouts(allLayouts));
    },
    [dispatch]
  );

  useEffect(() => {
    let cancelled = false;
    refreshSavedDashboards()
      .then((list) => {
        if (!cancelled) setSavedDashboards(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSavedDashboards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSavedDashboards]);

  useEffect(() => {
    if (!dashboardServerId) {
      setDashboardOwnerId(null);
      setPendingCollaboratorSync(undefined);
      return;
    }
    let cancelled = false;
    getDashboardById(dashboardServerId)
      .then((res) => {
        if (cancelled || !isHttpSuccessStatus(res.status)) return;
        const data = res.data;
        if (data?.userId != null) setDashboardOwnerId(String(data.userId));
        if (typeof data?.pendingCollaboratorSync === 'boolean') {
          setPendingCollaboratorSync(data.pendingCollaboratorSync);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dashboardServerId]);

  useEffect(() => {
    if (!dashboardServerId || !isOwner) return undefined;
    const refresh = () => {
      getDashboardById(dashboardServerId).then((res) => {
        if (!isHttpSuccessStatus(res.status) || !res.data) return;
        const d = res.data;
        if (typeof d.pendingCollaboratorSync === 'boolean') {
          setPendingCollaboratorSync(d.pendingCollaboratorSync);
        }
      });
    };
    const interval = setInterval(refresh, 45000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [dashboardServerId, isOwner]);

  useEffect(() => {
    let cancelled = false;
    meRequest()
      .then((r) => (isHttpSuccessStatus(r.status) ? r.data : null))
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setMeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRecentDashboardIds(dashboardUtils.readRecentDashboardIds());
  }, []);

  // If user opened a shared dashboard link (email), persist effectiveRole in localStorage
  // so the UI can enable editor actions correctly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('powerbi-active-dashboard-meta');
      if (!raw) return;
      const meta = JSON.parse(raw);
      if (!meta?.id) return;

      const dashId = String(meta.id);
      setDashboardServerId(dashId);
      setDashboardEffectiveRole(meta?.effectiveRole || null);
      const base = window.location.origin;
      setShareUrl(`${base}/dashboard/${dashId}`);
    } catch {
      /* ignore */
    }
  }, []);

  // Global mouse handlers for sidebar resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      const delta = e.clientX - resizeStartXRef.current;
      const minWidth = 200;
      const maxWidth = 600;

      if (resizingRef.current === 'left') {
        const next = Math.min(
          maxWidth,
          Math.max(minWidth, startLeftWidthRef.current + delta)
        );
        setLeftSidebarWidth(next);
      } else if (resizingRef.current === 'right') {
        const next = Math.min(
          maxWidth,
          Math.max(minWidth, startRightWidthRef.current - delta)
        );
        setRightSidebarWidth(next);
      }
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Sync collectionInput with collection from store
  useEffect(() => {
    setCollectionInput(collection);
  }, [collection]);

  // Debounced collection update
  const handleCollectionChange = useCallback(
    (value) => {
      if (isReadOnly) {
        errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
        return;
      }
      setCollectionInput(value);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        dispatch(setCollection(value));
      }, 500);
    },
    [dispatch, isReadOnly]
  );

  const handleFieldsLoaded = useCallback((data) => {
    if (Array.isArray(data)) {
      // Legacy format: just array of fields
      setFields(filterVisibleFields(data || []));
      setRecordCount(null);
    } else if (data && typeof data === 'object') {
      // New format: object with fields and recordCount
      setFields(filterVisibleFields(data.fields || data.schema || []));
      setRecordCount(
        data.recordCount !== undefined && data.recordCount !== null
          ? data.recordCount
          : null
      );
    } else {
      setFields([]);
      setRecordCount(null);
    }
  }, []);
  // File upload handler - uploads data to backend and creates collection
  const handleFileUpload = useCallback(
    async (event) => {
      if (isReadOnly) {
        errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const file = event.target.files?.[0];
      if (!file) return;

      const fileName = String(file.name || '').toLowerCase();
      const isJSON = fileName.endsWith('.json');
      const isCSV = fileName.endsWith('.csv');
      const isXLSX = fileName.endsWith('.xlsx');

      const maxFileSizeBytes =
        process.env.NEXT_PUBLIC_MAX_FILE_SIZE * 1024 * 1024;

      if (!isJSON && !isCSV && !isXLSX) {
        errorMessage(
          `${BI_UI.UNSUPPORTED_FILE_TYPE}. ${BI_UI.FILE_UPLOAD_FORMATS_HINT}`
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.type && !supportedMimes.has(String(file.type).toLowerCase())) {
        errorMessage(BI_UI.INVALID_FILE_FORMAT);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size <= 0) {
        errorMessage(BI_UI.FILE_EMPTY);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > maxFileSizeBytes) {
        errorMessage(
          `${BI_UI.FILE_TOO_LARGE}. Max ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE}MB`
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSaveStatus(BI_UI.UPLOADING_FILE);

      try {
        let fileContent = '';
        let normalizedType = '';

        if (isXLSX) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error(BI_UI.FILE_PARSE_ERROR));
            reader.readAsDataURL(file);
          });
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
          if (!base64) {
            throw new Error(BI_UI.FILE_PARSE_ERROR);
          }
          fileContent = base64;
          normalizedType = 'xlsx';
        } else {
          fileContent = await file.text();
          normalizedType = isJSON ? 'json' : 'csv';
        }

        // Check if it's a dashboard config file (has charts array)
        if (isJSON) {
          try {
            const parsedData = JSON.parse(fileContent);
            if (parsedData?.charts && Array.isArray(parsedData.charts)) {
              // It's a dashboard config file, load it directly
              const loadedCharts = parsedData.charts;
              const loadedLayouts = parsedData.layouts || {};

              // Generate proper layouts if not provided or invalid
              const chartIds = loadedCharts.map(
                (c) =>
                  c.id ||
                  `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
              );
              const validLayouts = {};

              if (loadedLayouts?.lg && Array.isArray(loadedLayouts.lg)) {
                const savedLg = loadedLayouts.lg;
                const hasValidSaved =
                  savedLg.length === chartIds.length &&
                  chartIds.every((id) => savedLg.some((item) => item.i === id));

                if (hasValidSaved) {
                  validLayouts.lg = savedLg;
                  validLayouts.md =
                    loadedLayouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
                  validLayouts.sm =
                    loadedLayouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
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

              // Preserve pixel rects if present (ChartCanvas uses layouts.rects).
              const savedRects = loadedLayouts?.rects;
              if (
                savedRects &&
                typeof savedRects === 'object' &&
                !Array.isArray(savedRects)
              ) {
                const rectsOut = {};
                for (const id of chartIds) {
                  if (savedRects[id]) rectsOut[id] = savedRects[id];
                }
                if (Object.keys(rectsOut).length > 0)
                  validLayouts.rects = rectsOut;
              }

              const chartsWithIds = loadedCharts.map((c, idx) => ({
                ...c,
                id: c.id || chartIds[idx],
              }));

              dispatch(
                loadDashboard({ charts: chartsWithIds, layouts: validLayouts })
              );
              if (
                parsedData.logo != null &&
                typeof parsedData.logo === 'string'
              ) {
                setDashboardLogo(parsedData.logo);
              } else {
                setDashboardLogo(null);
              }
              if (parsedData.name) setDashboardName(parsedData.name);
              setSaveStatus(BI_UI.DASHBOARD_LOADED_OK);
              setTimeout(() => setSaveStatus(''), 2000);

              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              return;
            }
          } catch {
            // Not a dashboard config, continue with data upload
          }
        }

        // Upload data file to backend for parsing and storage
        const response = await uploadBiFile({
          fileName: file.name,
          fileContent,
          fileType: normalizedType,
          mimeType: file.type || '',
          fileSize: file.size || 0,
        });

        if (!isHttpSuccessStatus(response.status)) {
          const errorData =
            response.data &&
            typeof response.data === 'object' &&
            !Array.isArray(response.data)
              ? response.data
              : { error: BI_UI.UPLOAD_FAILED };
          setSaveStatus(errorData.error || BI_UI.UPLOAD_FAILED);
          setTimeout(() => setSaveStatus(''), 3000);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }

        const result = response.data;

        // Successfully uploaded - switch to the new collection
        if (result.collection) {
          // Set fields immediately from upload response (faster than waiting for FieldList fetch)
          if (
            result.schema &&
            Array.isArray(result.schema) &&
            result.schema.length > 0
          ) {
            handleFieldsLoaded({
              fields: result.schema,
              recordCount: result.recordCount,
            });
          } else if (
            result.recordCount !== undefined &&
            result.recordCount !== null
          ) {
            setRecordCount(result.recordCount);
          }

          // Set collection in Redux - this will trigger FieldList to fetch schema (as backup/refresh)
          dispatch(setCollection(result.collection));

          // Show appropriate message based on whether it was replaced or new
          const statusMsg = result.replaced
            ? FORMAT_UPLOAD_REPLACED(result.collection, result.recordCount || 0)
            : FORMAT_UPLOAD_NEW(result.recordCount || 0, result.collection);

          updateMessage({
            type: 'success',
            text: statusMsg,
            key: 'upload-data',
            duration: 2.5,
          });
          setSaveStatus(statusMsg);
        } else {
          setSaveStatus(BI_UI.UPLOAD_NO_COLLECTION);
          setTimeout(() => setSaveStatus(''), 3000);
        }
      } catch (error) {
        const friendlyMessage =
          error?.response?.data?.error ||
          error?.message ||
          BI_UI.FILE_PARSE_ERROR;
        setSaveStatus(FORMAT_UPLOAD_ERROR(friendlyMessage));
        setTimeout(() => setSaveStatus(''), 3000);
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [dispatch, handleFieldsLoaded, isReadOnly]
  );

  const handleAddChart = useCallback(
    ({ dimension, measureField, measureOp }) => {
      if (isReadOnly) {
        errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
        return;
      }
      // Prevent adding chart if no collection is selected
      if (!collection || !collection.trim()) {
        setSaveStatus(BI_UI.SELECT_COLLECTION_FIRST);
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      dispatch(
        addChart({
          collection: collection.trim(),
          dimension,
          measure: { field: measureField, op: measureOp || 'COUNT' },
          type: 'bar',
          limit:
            typeof recordCount === 'number' && recordCount > 0
              ? recordCount
              : 10,
        })
      );
    },
    [dispatch, collection, recordCount, isReadOnly]
  );

  const handleUpdateChart = useCallback(
    (id, updates) => {
      if (isReadOnly) {
        errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
        return;
      }
      dispatch(updateChart({ id, updates }));
    },
    [dispatch, isReadOnly]
  );

  const handleRequestRemoveChart = useCallback((id) => {
    setChartToDeleteId(id);
  }, []);

  const handleConfirmRemoveChart = useCallback(() => {
    if (isReadOnly) {
      errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
      setChartToDeleteId(null);
      return;
    }
    if (chartToDeleteId) {
      dispatch(removeChart(chartToDeleteId));
      setChartToDeleteId(null);
    }
  }, [chartToDeleteId, dispatch, isReadOnly]);

  const handleCancelRemoveChart = useCallback(() => {
    setChartToDeleteId(null);
  }, []);

  // const handleCopilotGenerateChart = useCallback(
  //   async (prompt, collectionName, availableFields) => {
  //     try {
  //       setSaveStatus('Processing your request with AI...');

  //       const response = await fetch('/api/bi/copilot', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({
  //           prompt: prompt.trim(),
  //           collection: collectionName,
  //           fields: availableFields || [],
  //         }),
  //       });

  //       if (!response.ok) {
  //         const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
  //         throw new Error(errorData.error || `Server error: ${response.status}`);
  //       }

  //       const result = await response.json();

  //       if (!result.success) {
  //         throw new Error(result.error || 'Failed to generate chart configuration');
  //       }

  //       if (!result.dimension || !result.measure?.field) {
  //         throw new Error('Invalid chart configuration: missing dimension or measure');
  //       }

  //       // Create chart with the AI-generated configuration
  //       dispatch(
  //         addChart({
  //           collection: collectionName.trim(),
  //           dimension: result.dimension,
  //           measure: result.measure,
  //           type: result.type || 'bar',
  //           limit: result.limit || 10,
  //           sortBy: result.sortBy,
  //           sortOrder: result.sortOrder,
  //         })
  //       );

  //       setSaveStatus('Chart created successfully!');
  //       setTimeout(() => setSaveStatus(''), 2000);

  //       return {
  //         success: true,
  //         type: result.type,
  //         dimension: result.dimension,
  //       };
  //     } catch (error) {
  //       console.error('Copilot error:', error);
  //       setSaveStatus(`Error: ${error.message}`);
  //       setTimeout(() => setSaveStatus(''), 4000);
  //       throw error;
  //     }
  //   },
  //   [dispatch]
  // );

  const handleDuplicateChart = useCallback(
    (chart) => {
      if (isReadOnly) {
        errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
        return;
      }
      dispatch(duplicateChart(chart));
    },
    [dispatch, isReadOnly]
  );

  const handleRefreshChart = useCallback(
    (id) => {
      // Force re-render by updating the chart (triggers useEffect in SmartChart)
      dispatch(updateChart({ id, updates: { refreshedAt: Date.now() } }));
    },
    [dispatch]
  );

  const performLogout = useCallback(async () => {
    try {
      await logoutRequest();
      successMessage(BI_UI.LOGOUT_SUCCESS);
    } catch {
      infoMessage(BI_UI.LOGOUT_REDIRECT_LOGIN);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }
  }, []);

  const handleLogoutClick = useCallback(() => {
    setLogoutConfirmOpen(true);
  }, []);

  const handleSelectChart = useCallback(
    (id) => {
      dispatch(setSelectedChart(id));
    },
    [dispatch]
  );

  const handleSaveDashboard = useCallback(async () => {
    if (isReadOnly) {
      errorMessage(BI_UI.READ_ONLY_CANNOT_SAVE);
      return;
    }
    if (!Array.isArray(charts) || charts.length === 0) {
      setSaveStatus(BI_UI.NO_CHARTS_IN_DASHBOARD);
      setTimeout(() => setSaveStatus(''), 2500);
      return;
    }
    const name = (dashboardName && dashboardName.trim()) || 'My Dashboard';
    const payloadForCompare = dashboardUtils.buildDashboardSavePayload({
      name,
      collection,
      charts,
      layouts,
      logo: dashboardLogo,
    });
    const nextHash = dashboardUtils.stableStringify(payloadForCompare);

    if (lastSavedHash && nextHash === lastSavedHash) {
      setSaveStatus(BI_UI.NO_CHANGES_TO_SAVE);
      setTimeout(() => setSaveStatus(''), 2000);
      return;
    }

    setSaveStatus(BI_UI.SAVING);
    const previousDashboardId = dashboardServerId
      ? String(dashboardServerId)
      : undefined;
    try {
      const res = await saveDashboard({
        ...payloadForCompare,
        ...(previousDashboardId ? { previousDashboardId } : {}),
        // server doesn't need collection currently, but harmless to send
        updatedAt: new Date().toISOString(),
      });
      if (isHttpSuccessStatus(res.status)) {
        try {
          const json = res.data;
          const id = json?.id || json?._id;
          if (id) {
            const displayName = json.baseName
              ? String(json.baseName).trim()
              : deriveBaseName(json);
            setDashboardName(displayName);
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                charts,
                layouts,
                collection,
                dashboardName: displayName,
                logo: dashboardLogo || undefined,
              })
            );
            setSaveStatus(BI_UI.SAVED);
            const base =
              typeof window !== 'undefined' ? window.location.origin : '';
            setDashboardServerId(String(id));
            if (json.userId != null) setDashboardOwnerId(String(json.userId));
            setDashboardEffectiveRole('Editor');
            setShareUrl(`${base}/dashboard/${id}`);
            refreshSavedDashboards().catch(() => {});
            setLastSavedHash(nextHash);
            try {
              localStorage.setItem(LAST_SAVED_HASH_KEY, nextHash);
            } catch {
              /* ignore */
            }
          } else {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                charts,
                layouts,
                collection,
                logo: dashboardLogo || undefined,
              })
            );
            setSaveStatus(BI_UI.SAVED_LOCAL);
            setLastSavedHash(nextHash);
            try {
              localStorage.setItem(LAST_SAVED_HASH_KEY, nextHash);
            } catch {
              /* ignore */
            }
          }
        } catch {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              charts,
              layouts,
              collection,
              logo: dashboardLogo || undefined,
            })
          );
          setSaveStatus(BI_UI.SAVED_LOCAL);
          setLastSavedHash(nextHash);
          try {
            localStorage.setItem(LAST_SAVED_HASH_KEY, nextHash);
          } catch {
            /* ignore */
          }
        }
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            charts,
            layouts,
            collection,
            logo: dashboardLogo || undefined,
          })
        );
        setSaveStatus(BI_UI.SAVED_LOCAL);
        setLastSavedHash(nextHash);
        try {
          localStorage.setItem(LAST_SAVED_HASH_KEY, nextHash);
        } catch {
          /* ignore */
        }
      }
    } catch {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          charts,
          layouts,
          collection,
          logo: dashboardLogo || undefined,
        })
      );
      setSaveStatus(BI_UI.SAVED_LOCAL);
      setLastSavedHash(nextHash);
      try {
        localStorage.setItem(LAST_SAVED_HASH_KEY, nextHash);
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => setSaveStatus(''), 2000);
  }, [
    charts,
    layouts,
    collection,
    dashboardName,
    dashboardLogo,
    lastSavedHash,
    isReadOnly,
    dashboardServerId,
    refreshSavedDashboards,
  ]);

  const handleShare = useCallback(() => {
    if (!dashboardServerId) return;
    if (dashboardEffectiveRole !== 'Editor') {
      setSaveStatus(BI_UI.EDITORS_ONLY_SHARE);
      setTimeout(() => setSaveStatus(''), 2000);
      return;
    }
    setShareModalOpen(true);
  }, [dashboardServerId, dashboardEffectiveRole]);

  const handleLoadDashboard = useCallback(() => {
    if (isReadOnly) {
      errorMessage(BI_UI.READ_ONLY_CANNOT_LOAD_CONFIGURATION);
      return;
    }
    setDashboardServerId(null);
    setDashboardOwnerId(null);
    setDashboardEffectiveRole(null);
    setShareUrl('');
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const {
          charts: savedCharts,
          layouts: savedLayouts,
          collection: savedCollection,
        } = parsed;
        if (savedCharts?.length) {
          // Generate proper layouts if not provided or invalid
          const chartIds = savedCharts.map(
            (c) =>
              c.id ||
              `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          );
          const validLayouts = {};

          if (savedLayouts?.lg && Array.isArray(savedLayouts.lg)) {
            const savedLg = savedLayouts.lg;
            const hasValidSaved =
              savedLg.length === chartIds.length &&
              chartIds.every((id) => savedLg.some((item) => item.i === id));

            if (hasValidSaved) {
              validLayouts.lg = savedLg;
              validLayouts.md =
                savedLayouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
              validLayouts.sm =
                savedLayouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
            } else {
              // Generate new layouts arranged properly
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
            // Generate new layouts arranged properly
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

          // Preserve pixel rects if present (ChartCanvas uses layouts.rects).
          const savedRects = savedLayouts?.rects;
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

          // Ensure all charts have IDs
          const chartsWithIds = savedCharts.map((c, idx) => ({
            ...c,
            id: c.id || chartIds[idx],
          }));

          const loadedCollection =
            savedCollection ||
            (savedCharts[0] && savedCharts[0].collection) ||
            collection;
          dispatch(
            loadDashboard({
              charts: chartsWithIds,
              layouts: validLayouts,
              collection: loadedCollection,
            })
          );
          bumpLoadSurfaceKey();
          setCollectionInput(loadedCollection);
          if (parsed.dashboardName != null)
            setDashboardName(parsed.dashboardName);
          if (parsed.logo != null && typeof parsed.logo === 'string')
            setDashboardLogo(parsed.logo);
          else setDashboardLogo(null);
          try {
            const payloadForCompare = dashboardUtils.buildDashboardSavePayload({
              name: parsed.dashboardName || 'My Dashboard',
              collection: loadedCollection,
              charts: chartsWithIds,
              layouts: validLayouts,
              logo: parsed.logo,
            });
            const h = dashboardUtils.stableStringify(payloadForCompare);
            setLastSavedHash(h);
            localStorage.setItem(LAST_SAVED_HASH_KEY, h);
          } catch {
            /* ignore */
          }
          setSaveStatus(BI_UI.LOADED);
          setTimeout(() => setSaveStatus(''), 2000);
        }
      } catch {
        setSaveStatus(BI_UI.LOAD_FAILED);
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } else {
      refreshSavedDashboards()
        .then((list) => {
          if (list?.length) {
            const latest = list[0];
            const latestId = latest?._id || latest?.id;
            if (latestId) {
              setDashboardServerId(String(latestId));
              if (latest.userId != null)
                setDashboardOwnerId(String(latest.userId));
              setDashboardEffectiveRole(latest?.effectiveRole || null);
              const base =
                typeof window !== 'undefined' ? window.location.origin : '';
              setShareUrl(`${base}/dashboard/${latestId}`);
            }
            const cfg = latest?.charts ?? latest;
            if (Array.isArray(cfg) && cfg.length) {
              // Generate proper layouts
              const chartIds = cfg.map(
                (c) =>
                  c.id ||
                  `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
              );
              const validLayouts = {};

              if (latest?.layouts?.lg && Array.isArray(latest.layouts.lg)) {
                const savedLg = latest.layouts.lg;
                const hasValidSaved =
                  savedLg.length === chartIds.length &&
                  chartIds.every((id) => savedLg.some((item) => item.i === id));

                if (hasValidSaved) {
                  validLayouts.lg = savedLg;
                  validLayouts.md =
                    latest.layouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
                  validLayouts.sm =
                    latest.layouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
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

              // Preserve pixel rects if present (ChartCanvas uses layouts.rects).
              const savedRects = latest?.layouts?.rects;
              if (
                savedRects &&
                typeof savedRects === 'object' &&
                !Array.isArray(savedRects)
              ) {
                const rectsOut = {};
                for (const id of chartIds) {
                  if (savedRects[id]) rectsOut[id] = savedRects[id];
                }
                if (Object.keys(rectsOut).length > 0)
                  validLayouts.rects = rectsOut;
              }

              const chartsWithIds = cfg.map((c, idx) => ({
                ...c,
                id: c.id || chartIds[idx],
              }));

              const loadedCollection =
                (chartsWithIds[0] && chartsWithIds[0].collection) ||
                (latest && latest.collection) ||
                collection;
              dispatch(
                loadDashboard({
                  charts: chartsWithIds,
                  layouts: validLayouts,
                  collection: loadedCollection,
                })
              );
              bumpLoadSurfaceKey();
              setCollectionInput(loadedCollection);
              setDashboardName(deriveBaseName(latest));
              try {
                const payloadForCompare =
                  dashboardUtils.buildDashboardSavePayload({
                    name: latest?.name || 'My Dashboard',
                    collection: loadedCollection,
                    charts: chartsWithIds,
                    layouts: validLayouts,
                    logo: latest?.logo,
                  });
                const h = dashboardUtils.stableStringify(payloadForCompare);
                setLastSavedHash(h);
                localStorage.setItem(LAST_SAVED_HASH_KEY, h);
              } catch {
                /* ignore */
              }
              setSaveStatus(BI_UI.LOADED_FROM_SERVER);
            } else {
              setSaveStatus(BI_UI.NO_SAVED_DASHBOARD);
            }
          } else {
            setSaveStatus(BI_UI.NO_SAVED_DASHBOARD);
          }
          setTimeout(() => setSaveStatus(''), 2000);
        })
        .catch(() => {
          setSaveStatus(BI_UI.LOAD_FAILED);
          setTimeout(() => setSaveStatus(''), 2000);
        })
        .catch(() => {});
    }
  }, [
    dispatch,
    collection,
    isReadOnly,
    refreshSavedDashboards,
    bumpLoadSurfaceKey,
  ]);

  const appendRecentDashboardId = useCallback((loadedId) => {
    if (!loadedId) return;
    const sid = String(loadedId);
    setRecentDashboardIds((prev) => {
      const next = [sid, ...prev.filter((x) => x !== sid)].slice(0, 40);
      try {
        localStorage.setItem(
          RECENT_DASHBOARDS_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);
  const applyServerDashboardPayload = useCallback(
    (data, { serverId, skipRecent = false } = {}) => {
      const {
        chartsWithIds,
        validLayouts,
        collection: loadedCollection,
      } = dashboardUtils.buildLayoutsAndChartsFromSaved(data);
      if (chartsWithIds.length === 0) return false;
      dispatch(
        loadDashboard({
          charts: chartsWithIds,
          layouts: validLayouts,
          collection: loadedCollection,
        })
      );
      bumpLoadSurfaceKey();
      setCollectionInput(loadedCollection);
      if (serverId) {
        setDashboardServerId(String(serverId));
        if (data?.userId != null) setDashboardOwnerId(String(data.userId));
        setDashboardEffectiveRole(data?.effectiveRole || null);
        if (typeof data?.pendingCollaboratorSync === 'boolean') {
          setPendingCollaboratorSync(data.pendingCollaboratorSync);
        } else {
          setPendingCollaboratorSync(undefined);
        }
        const base =
          typeof window !== 'undefined' ? window.location.origin : '';
        setShareUrl(`${base}/dashboard/${serverId}`);
        if (!skipRecent) appendRecentDashboardId(serverId);
      }
      try {
        const payloadForCompare = buildDashboardSavePayload({
          name: data?.name || 'My Dashboard',
          collection: loadedCollection,
          charts: chartsWithIds,
          layouts: validLayouts,
          logo: data?.logo,
        });
        const h = stableStringify(payloadForCompare);
        setLastSavedHash(h);
        localStorage.setItem(LAST_SAVED_HASH_KEY, h);
      } catch {
        /* ignore */
      }
      if (data.name) setDashboardName(data.name);
      if (data.logo != null && typeof data.logo === 'string')
        setDashboardLogo(data.logo);
      else setDashboardLogo(null);
      return true;
    },
    [dispatch, appendRecentDashboardId, bumpLoadSurfaceKey]
  );
  const handleLoadDashboardById = useCallback(
    (id) => {
      if (!id) return;
      if (isReadOnly) {
        errorMessage(BI_UI.READ_ONLY_CANNOT_SWITCH_DASHBOARD);
        return;
      }
      setSaveStatus(BI_UI.LOADING);
      getDashboardById(id)
        .then((res) => {
          if (res.status === HTTP_STATUS.NOT_FOUND) {
            setSaveStatus(BI_UI.DASHBOARD_NOT_FOUND);
            setTimeout(() => setSaveStatus(''), 2000);
            return null;
          }
          if (!isHttpSuccessStatus(res.status))
            throw new Error(FORMAT_FAILED_LOAD_BY_ID(res.status));
          return res.data;
        })
        .then((data) => {
          if (data == null) return;
          const {
            chartsWithIds,
            validLayouts,
            collection: loadedCollection,
          } = dashboardUtils.buildLayoutsAndChartsFromSaved(data);
          if (chartsWithIds.length === 0) {
            setSaveStatus(BI_UI.NO_CHARTS_IN_DASHBOARD);
            setTimeout(() => setSaveStatus(''), 2000);
            return;
          }
          dispatch(
            loadDashboard({
              charts: chartsWithIds,
              layouts: validLayouts,
              collection: loadedCollection,
            })
          );
          setCollectionInput(loadedCollection);
          setDashboardServerId(String(id));
          if (data.userId != null) setDashboardOwnerId(String(data.userId));
          setDashboardEffectiveRole(data?.effectiveRole || null);
          if (typeof data?.pendingCollaboratorSync === 'boolean') {
            setPendingCollaboratorSync(data.pendingCollaboratorSync);
          } else {
            setPendingCollaboratorSync(undefined);
          }
          const base =
            typeof window !== 'undefined' ? window.location.origin : '';
          setShareUrl(`${base}/dashboard/${id}`);
          try {
            const payloadForCompare = dashboardUtils.buildDashboardSavePayload({
              name: data?.name || 'My Dashboard',
              collection: loadedCollection,
              charts: chartsWithIds,
              layouts: validLayouts,
              logo: data?.logo,
            });
            const h = dashboardUtils.stableStringify(payloadForCompare);
            setLastSavedHash(h);
            localStorage.setItem(LAST_SAVED_HASH_KEY, h);
          } catch {
            /* ignore */
          }
          setDashboardName(deriveBaseName(data));
          if (data.logo != null && typeof data.logo === 'string')
            setDashboardLogo(data.logo);
          else setDashboardLogo(null);
          appendRecentDashboardId(id);
          setSaveStatus(BI_UI.LOADED);
          setTimeout(() => setSaveStatus(''), 2000);
        })
        .catch((err) => {
          setSaveStatus(err.message || BI_UI.LOAD_FAILED);
          setTimeout(() => setSaveStatus(''), 2000);
        });
    },
    [dispatch, appendRecentDashboardId, isReadOnly]
  );
  const handleClearPlayground = useCallback(() => {
    if (!window.confirm('Reset the playground? Unsaved changes will be lost.'))
      return;
    dispatch(resetDashboard());
    setCollectionInput('');
    setDashboardName('My Dashboard');
    setDashboardLogo(null);
    setDashboardServerId(null);
    //
    setDashboardEffectiveRole(null);
    setPendingCollaboratorSync(undefined);
    setShareUrl('');
    setLastSavedHash('');
    try {
      localStorage.removeItem(LAST_SAVED_HASH_KEY);
    } catch {
      /* ignore */
    }
    infoMessage(BI_UI.PLAYGROUND_CLEARED);
  }, [dispatch]);

  const handleSyncShared = useCallback(async () => {
    if (!dashboardServerId) {
      infoMessage(BI_UI.LOAD_OR_SAVE_DASHBOARD_FIRST);
      return;
    }
    loadingMessage(BI_UI.SYNCING_LATEST, 'sync-dash');
    try {
      const res = await syncDashboard(dashboardServerId);
      if (!isHttpSuccessStatus(res.status)) {
        throw new Error(`Sync failed (${res.status})`);
      }
      const data = res?.data || {};
      const dashboardPayload =
        data &&
        typeof data.dashboard === 'object' &&
        !Array.isArray(data.dashboard)
          ? data.dashboard
          : data;
      const ok = applyServerDashboardPayload(dashboardPayload, {
        serverId: dashboardServerId,
        skipRecent: true,
      });
      if (!ok) {
        updateMessage({
          type: 'warning',
          text: BI_UI.NO_CHARTS_IN_SYNCED_DASHBOARD,
          key: 'sync-dash',
          duration: 3,
        });
        return;
      }
      const v =
        dashboardPayload?.currentVersion != null
          ? dashboardPayload.currentVersion
          : dashboardPayload?.versionNumber;
      const statusText =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message.trim()
          : BI_UI.SYNCED_TO_LATEST;
      updateMessage({
        type: 'success',
        text: v != null && Number(v) > 0 ? `${statusText} (v${v})` : statusText,
        key: 'sync-dash',
        duration: 2,
      });
    } catch (e) {
      updateMessage({
        type: 'error',
        text: e?.message || BI_UI.SYNC_FAILED,
        key: 'sync-dash',
        duration: 3,
      });
    }
  }, [dashboardServerId, applyServerDashboardPayload]);

  const handlePrintDashboard = useCallback(async () => {
    setSaveStatus(BI_UI.PREPARING_PRINT);
    try {
      const html2canvas = (await import('html2canvas')).default;
      // Capture only the charts area (exclude zoom controls)
      const printArea = document.querySelector('.bi-playground-content');
      if (!printArea) {
        setSaveStatus(BI_UI.CANVAS_NOT_FOUND);
        setTimeout(() => setSaveStatus(''), 2000);
        return;
      }

      const canvasElement = await html2canvas(printArea, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const imgData = canvasElement.toDataURL('image/png');

      // Open a minimal print window with only the canvas image
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        setSaveStatus(BI_UI.POPUP_BLOCKED);
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dashboard Print</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                background: #ffffff;
                display: flex;
                align-items: flex-start;
                justify-content: center;
              }
              .print-container {
                width: 100%;
              }
              img {
                width: 100%;
                height: auto;
                display: block;
              }
              @media print {
                * {
                  margin: 0 !important;
                  padding: 0 !important;
                }
                body {
                  background: #ffffff !important;
                }
                img {
                  width: 100% !important;
                  height: auto !important;
                  page-break-inside: avoid;
                }
                @page {
                  size: landscape;
                  margin: 8mm;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              <img src="${imgData}" alt="Dashboard" />
            </div>
            <script>
              // Auto-trigger print once image is loaded
              const img = document.querySelector('img');
              img.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
      setSaveStatus(BI_UI.PRINT_DIALOG_OPENED);
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      setSaveStatus(BI_UI.PRINT_FAILED);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, []);

  const handleDownloadJSON = useCallback(() => {
    const name = (dashboardName && dashboardName.trim()) || 'My Dashboard';
    const dashboardData = {
      name,
      charts,
      layouts,
      logo: dashboardLogo || undefined,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName =
      name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'dashboard';
    a.download = `${safeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveStatus(BI_UI.JSON_DOWNLOADED);
    setTimeout(() => setSaveStatus(''), 2000);
  }, [charts, layouts, dashboardName, dashboardLogo]);

  const handleDownloadPDF = useCallback(async () => {
    setSaveStatus(BI_UI.GENERATING_PDF);
    setExportPdfInProgress(true);
    const pdfTitle =
      (dashboardName && String(dashboardName).trim()) || 'Dashboard Export';

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const html2canvas = (await import('html2canvas')).default;

      const target = document.querySelector('.bi-playground-content');
      if (!target) throw new Error(BI_UI.EXPORT_AREA_NOT_FOUND);

      // ── Detect content types ───────────────────────────────────────────────
      const hasCanvas = target.querySelector('canvas') !== null;
      const hasTable = target.querySelector('table') !== null;
      const isOnlyTable = hasTable && !hasCanvas;

      // ══════════════════════════════════════════════════════════════════════
      // MODE 1 — PURE TABLE ONLY → jspdf-autotable (perfect text quality)
      // ══════════════════════════════════════════════════════════════════════
      if (isOnlyTable) {
        const tableEl = target.querySelector('table');

        const theadCells = Array.from(
          tableEl.querySelectorAll(
            'thead tr:first-child th, thead tr:first-child td'
          )
        );

        const SKIP_HEADERS = [
          'createdat',
          'updatedat',
          'created_at',
          'updated_at',
          '__v',
          '_v',
          'password',
          'token',
          'refreshtoken',
        ];

        const allColumns = theadCells.map((th, idx) => ({
          idx,
          label: dashboardUtils.cleanPdfHeaderLabel(
            th.innerText ?? th.textContent ?? ''
          ),
        }));

        const columns = allColumns.filter(
          (col) =>
            !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
        );

        const tbodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
        const rows = tbodyRows.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td, th'));
          return columns.map((col) => {
            const cell = cells[col.idx];
            return cell
              ? cell.innerText?.trim() || cell.textContent?.trim() || ''
              : '';
          });
        });

        const filteredRows = rows.filter((row) =>
          row.some((cell) => cell !== '')
        );
        if (filteredRows.length === 0)
          throw new Error(BI_UI.NO_TABLE_DATA_FOR_PDF);

        const orientation = columns.length > 6 ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [1920, 1080],
          compress: true,
        });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 12;
        const headerH = 18;

        pdf.setFillColor(15, 108, 189);
        pdf.rect(0, 0, pageWidth, headerH, 'F');
        let textLeft = margin;
        if (
          dashboardLogo &&
          typeof dashboardLogo === 'string' &&
          dashboardLogo.startsWith('data:image')
        ) {
          try {
            const logoW = 16;
            const logoH = 12;
            pdf.addImage(
              dashboardLogo,
              'PNG',
              margin,
              (headerH - logoH) / 2,
              logoW,
              logoH,
              '',
              'FAST'
            );
            textLeft = margin + logoW + 4;
          } catch (err) {
            // ignore
          }
        }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text(pdfTitle, textLeft, 12);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(200, 225, 255);
        pdf.text(
          `${filteredRows.length.toLocaleString()} records  •  ${new Date().toLocaleString()}`,
          pageWidth - margin,
          12,
          { align: 'right' }
        );

        autoTable(pdf, {
          head: [columns.map((col) => col.label)],
          body: filteredRows,
          startY: 22,
          showHead: 'everyPage',
          tableWidth: pageWidth - margin * 2,
          styles: {
            fontSize: 8.5,
            cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
            font: 'helvetica',
            textColor: [32, 31, 30],
            lineColor: [218, 218, 218],
            lineWidth: 0.15,
            overflow: 'ellipsize',
            minCellHeight: 8,
          },
          headStyles: {
            fillColor: [32, 31, 30],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
            halign: 'left',
          },
          alternateRowStyles: { fillColor: [245, 249, 255] },
          bodyStyles: { halign: 'left' },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const val = data.cell.raw;
              if (val !== '' && !isNaN(val)) data.cell.styles.halign = 'right';
            }
          },
          didDrawPage: () => {
            const currentPage = pdf.internal.getCurrentPageInfo().pageNumber;
            const totalPages = pdf.internal.getNumberOfPages();
            pdf.setDrawColor(218, 218, 218);
            pdf.setLineWidth(0.2);
            pdf.line(
              margin,
              pageHeight - 10,
              pageWidth - margin,
              pageHeight - 10
            );
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(140, 140, 140);
            pdf.text(
              `Total: ${filteredRows.length.toLocaleString()} records`,
              margin,
              pageHeight - 5
            );
            pdf.text(
              `Page ${currentPage} of ${totalPages}`,
              pageWidth - margin,
              pageHeight - 5,
              { align: 'right' }
            );
          },
          margin: { top: 22, right: margin, bottom: 14, left: margin },
        });

        pdf.save(`dashboard-${Date.now()}.pdf`);
        setSaveStatus(FORMAT_PDF_DOWNLOADED_RECORDS(filteredRows.length));
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }

      // ══════════════════════════════════════════════════════════════════════
      // MODE 2 — CHARTS (ECharts canvas) + optional table
      // Each chart card captured individually → one PDF page per chart
      // ══════════════════════════════════════════════════════════════════════

      // Find all chart card containers inside the playground
      // Adjust selector to match your actual chart wrapper class
      const CHART_CARD_SELECTORS = [
        '.bi-chart-card',
        '.bi-chart-item',
        '.bi-chart-wrapper',
        '.chart-container',
        '.recharts-wrapper',
        '[class*="chart-card"]',
        '[class*="chart-item"]',
        '[class*="chart-wrapper"]',
      ];

      // Try each selector until we find chart cards
      let chartCards = [];
      for (const sel of CHART_CARD_SELECTORS) {
        const found = Array.from(target.querySelectorAll(sel));
        if (found.length > 0) {
          chartCards = found;
          break;
        }
      }

      // Fallback: if no specific card selector matched,
      // find all direct children that contain a canvas or table
      if (chartCards.length === 0) {
        chartCards = Array.from(target.children).filter((child) => {
          return child.querySelector('canvas') || child.querySelector('table');
        });
      }

      // Last resort: capture entire playground as one page
      if (chartCards.length === 0) {
        chartCards = [target];
      }

      setSaveStatus(FORMAT_PDF_BUILDING_CHARTS(chartCards.length));

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: false,
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 10;
      const headerH = 14;
      const footerH = 10;
      const usableH = pageHeight - headerH - footerH - margin;
      const usableW = pageWidth - margin * 2;

      const drawPageHeader = (pdfInstance, title, pageNum, totalPages) => {
        pdfInstance.setFillColor(15, 108, 189);
        pdfInstance.rect(0, 0, pageWidth, headerH, 'F');
        let textLeft = margin;
        if (
          dashboardLogo &&
          typeof dashboardLogo === 'string' &&
          dashboardLogo.startsWith('data:image')
        ) {
          try {
            const logoW = 14;
            const logoH = 10;
            pdfInstance.addImage(
              dashboardLogo,
              'PNG',
              margin,
              (headerH - logoH) / 2,
              logoW,
              logoH,
              '',
              'FAST'
            );
            textLeft = margin + logoW + 4;
          } catch (err) {
            console.error('Error adding dashboard logo to PDF:', err);
          }
        }
        pdfInstance.setFontSize(9);
        pdfInstance.setFont('helvetica', 'bold');
        pdfInstance.setTextColor(255, 255, 255);
        pdfInstance.text(pdfTitle, textLeft, 9);
        pdfInstance.setFontSize(7.5);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setTextColor(200, 225, 255);
        if (title)
          pdfInstance.text(title, pageWidth / 2, 9, { align: 'center' });
        pdfInstance.text(
          `Page ${pageNum} of ${totalPages}  •  ${new Date().toLocaleDateString()}`,
          pageWidth - margin,
          9,
          { align: 'right' }
        );
      };

      const drawPageFooter = (pdfInstance) => {
        pdfInstance.setDrawColor(218, 218, 218);
        pdfInstance.setLineWidth(0.2);
        pdfInstance.line(
          margin,
          pageHeight - footerH,
          pageWidth - margin,
          pageHeight - footerH
        );
        pdfInstance.setFontSize(7);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setTextColor(160, 160, 160);
        pdfInstance.text('Generated by BI Dashboard', margin, pageHeight - 5);
      };

      const normalizeLegendColor = (value) => {
        if (!value) return [107, 114, 128];
        if (Array.isArray(value) && value.length >= 3) {
          return [
            Math.max(0, Math.min(255, Number(value[0]) || 0)),
            Math.max(0, Math.min(255, Number(value[1]) || 0)),
            Math.max(0, Math.min(255, Number(value[2]) || 0)),
          ];
        }
        if (typeof value === 'string') {
          const color = value.trim();
          const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
          if (hex) {
            const raw = hex[1];
            const expanded =
              raw.length === 3
                ? raw
                    .split('')
                    .map((ch) => ch + ch)
                    .join('')
                : raw;
            return [
              parseInt(expanded.slice(0, 2), 16),
              parseInt(expanded.slice(2, 4), 16),
              parseInt(expanded.slice(4, 6), 16),
            ];
          }
          const rgb = color.match(
            /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+[\d.]+)?\s*\)$/i
          );
          if (rgb) {
            return [
              Math.max(0, Math.min(255, Number(rgb[1]) || 0)),
              Math.max(0, Math.min(255, Number(rgb[2]) || 0)),
              Math.max(0, Math.min(255, Number(rgb[3]) || 0)),
            ];
          }
        }
        return [107, 114, 128];
      };

      const collectLegendItemsFromCard = async (card) => {
        const getChartConfigByCard = () => {
          const chartHost = card.closest('[data-chart-id]');
          const chartId = chartHost?.getAttribute('data-chart-id');
          if (!chartId) return null;
          return charts.find((c) => c.id === chartId) || null;
        };

        const metricDefsFromConfig = (cfg) => {
          if (!cfg) return [];
          if (Array.isArray(cfg.metrics) && cfg.metrics.length) {
            return cfg.metrics
              .filter((m) => m && m.field)
              .map((m) => ({
                field: String(m.field),
                op: String(m.op || cfg.measure?.op || 'COUNT').toUpperCase(),
              }));
          }
          if (Array.isArray(cfg.measureFields) && cfg.measureFields.length) {
            const baseOp = String(cfg.measure?.op || 'COUNT').toUpperCase();
            return cfg.measureFields.filter(Boolean).map((field) => ({
              field: String(field),
              op: baseOp,
            }));
          }
          if (cfg.measure?.field) {
            return [
              {
                field: String(cfg.measure.field),
                op: String(cfg.measure?.op || 'COUNT').toUpperCase(),
              },
            ];
          }
          return [];
        };

        const addOpToLabel = (rawLabel, cfg) => {
          const label = String(rawLabel || '').trim();
          if (!label) return label;
          if (/\([A-Z]+\)$/.test(label)) return label;
          const defs = metricDefsFromConfig(cfg);
          if (!defs.length) return label;
          const opByField = new Map(defs.map((d) => [d.field, d.op]));

          // Handles labels like "StoreKey" and "StoreKey • Germany"
          const mainField = label.split(' • ')[0].trim();
          const op = opByField.get(mainField);
          if (!op) return label;
          if (label.includes(' • ')) {
            const suffix = label.slice(mainField.length);
            return `${mainField} (${op})${suffix}`;
          }
          return `${mainField} (${op})`;
        };

        const fallbackFromConfig = () => {
          const cfg = getChartConfigByCard();
          if (!cfg) return [];

          const defs = metricDefsFromConfig(cfg);
          if (defs.length === 0) return [];

          const paletteHex = [
            '#5470c6',
            '#91cc75',
            '#fac858',
            '#ee6666',
            '#73c0de',
            '#3ba272',
            '#fc8452',
            '#9a60b4',
            '#ea7ccc',
          ];
          return defs.map((d, idx) => ({
            label: `${d.field} (${d.op})`,
            color: normalizeLegendColor(paletteHex[idx % paletteHex.length]),
          }));
        };

        try {
          const { default: echarts } = await import('echarts');
          const chartDom =
            card.querySelector('.echarts-for-react > div') ||
            card.querySelector('[data-zr-dom-id]')?.parentElement ||
            card.querySelector('div[_echarts_instance_]') ||
            card.querySelector('canvas')?.parentElement;
          if (!chartDom) return fallbackFromConfig();
          const chartInstance = echarts.getInstanceByDom(chartDom);
          if (!chartInstance) return fallbackFromConfig();

          const option = chartInstance.getOption?.() || {};
          const palette = Array.isArray(option.color) ? option.color : [];
          const series = Array.isArray(option.series) ? option.series : [];
          if (series.length === 0) return fallbackFromConfig();

          const items = [];
          const usedLabels = new Set();
          const addItem = (label, color, fallbackIndex = 0) => {
            const text = String(label ?? '').trim();
            if (!text || usedLabels.has(text)) return;
            usedLabels.add(text);
            items.push({
              label: text,
              color: normalizeLegendColor(color || palette[fallbackIndex]),
            });
          };

          const pieSeries = series.find((s) => s?.type === 'pie');
          if (
            pieSeries &&
            Array.isArray(pieSeries.data) &&
            pieSeries.data.length
          ) {
            pieSeries.data.forEach((slice, idx) => {
              addItem(
                slice?.name,
                slice?.itemStyle?.color || slice?.color || palette[idx],
                idx
              );
            });
            return items;
          }

          series.forEach((s, idx) => {
            addItem(
              s?.name || s?.id || `Series ${idx + 1}`,
              s?.itemStyle?.color || s?.lineStyle?.color || s?.color,
              idx
            );
          });
          const cfg = getChartConfigByCard();
          if (!items.length) return fallbackFromConfig();
          if (!cfg) return items;

          const cfgFallback = fallbackFromConfig();
          const mappedItems = items.map((item) => ({
            ...item,
            label: addOpToLabel(item.label, cfg),
          }));
          // If runtime series extraction missed fields, prefer config-driven legend.
          return cfgFallback.length > mappedItems.length
            ? cfgFallback
            : mappedItems;
        } catch (err) {
          return fallbackFromConfig();
        }
      };

      const drawLegendBlock = (pdfInstance, legendItems) => {
        if (!Array.isArray(legendItems) || legendItems.length === 0) {
          return { topPad: 0, rightPad: 0 };
        }

        const safeItems = legendItems
          .map((i) => ({
            label: String(i?.label || '').trim(),
            color: normalizeLegendColor(i?.color),
          }))
          .filter((i) => i.label);
        if (safeItems.length === 0) return { topPad: 0, rightPad: 0 };

        const legendTop = headerH + margin / 2 + 1;
        const minPanelW = 56;
        const maxPanelW = Math.min(95, pageWidth * 0.34);
        const marker = 3;
        const lineH = 5.5;
        const titleGap = 5;
        const itemGap = 1;
        const panelPadX = 4;
        const panelPadY = 3;

        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setFontSize(8);
        const maxLabelWidth = safeItems.reduce((acc, item) => {
          return Math.max(acc, pdfInstance.getTextWidth(item.label));
        }, 0);
        const calcW = panelPadX * 2 + marker + 2 + maxLabelWidth;
        const panelW = Math.max(minPanelW, Math.min(maxPanelW, calcW));
        const panelH = panelPadY * 2 + titleGap + safeItems.length * lineH;
        const legendLeft = pageWidth - margin - panelW;

        pdfInstance.setFillColor(248, 250, 252);
        pdfInstance.setDrawColor(203, 213, 225);
        pdfInstance.setLineWidth(0.25);
        pdfInstance.roundedRect(
          legendLeft,
          legendTop,
          panelW,
          panelH,
          1.6,
          1.6,
          'FD'
        );

        pdfInstance.setFont('helvetica', 'bold');
        pdfInstance.setFontSize(8);
        pdfInstance.setTextColor(31, 41, 55);
        pdfInstance.text(
          'Legend',
          legendLeft + panelPadX,
          legendTop + panelPadY + 2.4
        );

        let y = legendTop + panelPadY + titleGap + 1;
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setFontSize(7.6);
        safeItems.forEach((item) => {
          const [r, g, b] = item.color;
          pdfInstance.setFillColor(r, g, b);
          pdfInstance.rect(
            legendLeft + panelPadX,
            y - marker + 0.8,
            marker,
            marker,
            'F'
          );
          pdfInstance.setTextColor(55, 65, 81);
          pdfInstance.text(
            item.label,
            legendLeft + panelPadX + marker + 2,
            y + 0.2,
            {
              maxWidth: panelW - (panelPadX * 2 + marker + 3),
            }
          );
          y += lineH + itemGap;
        });

        // Keep chart away from the legend panel and provide a small top gap.
        return { topPad: 2, rightPad: panelW + 4 };
      };

      const drawAxisFieldsBlock = (pdfInstance, cfg) => {
        const axisTypes = [
          'bar',
          'line',
          'area',
          'stackedBar',
          'waterfall',
          'scatter',
        ];
        if (!cfg || !axisTypes.includes(cfg.type)) return { topPad: 0 };

        const metricDefs =
          Array.isArray(cfg.metrics) && cfg.metrics.length
            ? cfg.metrics
                .filter((m) => m && m.field)
                .map((m) => ({
                  field: String(m.field),
                  op: String(m.op || cfg.measure?.op || 'COUNT').toUpperCase(),
                }))
            : Array.isArray(cfg.measureFields) && cfg.measureFields.length
              ? cfg.measureFields.filter(Boolean).map((f) => ({
                  field: String(f),
                  op: String(cfg.measure?.op || 'COUNT').toUpperCase(),
                }))
              : cfg.measure?.field
                ? [
                    {
                      field: String(cfg.measure.field),
                      op: String(cfg.measure?.op || 'COUNT').toUpperCase(),
                    },
                  ]
                : [];

        const xLabel = cfg.dimension || 'Category';
        const yLabel =
          metricDefs.length > 0
            ? metricDefs.map((m) => `${m.field} (${m.op})`).join(', ')
            : 'Value';

        const panelLeft = margin;
        const panelTop = headerH + margin / 2 + 1;
        const panelW = Math.min(125, pageWidth * 0.44);
        const panelH = 19;
        const padX = 3.2;

        const truncate = (text, maxWidth) => {
          const raw = String(text || '');
          if (pdfInstance.getTextWidth(raw) <= maxWidth) return raw;
          let out = raw;
          while (
            out.length > 0 &&
            pdfInstance.getTextWidth(`${out}...`) > maxWidth
          ) {
            out = out.slice(0, -1);
          }
          return out ? `${out}...` : raw;
        };

        pdfInstance.setFillColor(248, 250, 252);
        pdfInstance.setDrawColor(203, 213, 225);
        pdfInstance.setLineWidth(0.25);
        pdfInstance.roundedRect(
          panelLeft,
          panelTop,
          panelW,
          panelH,
          1.6,
          1.6,
          'FD'
        );
        pdfInstance.setFont('helvetica', 'bold');
        pdfInstance.setFontSize(8);
        pdfInstance.setTextColor(31, 41, 55);
        pdfInstance.text('Axis Fields', panelLeft + padX, panelTop + 4.4);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setFontSize(7.2);
        pdfInstance.setTextColor(55, 65, 81);
        const maxTextW = panelW - padX * 2 - 8;
        pdfInstance.text(
          `X: ${truncate(xLabel, maxTextW)}`,
          panelLeft + padX,
          panelTop + 9.5
        );
        pdfInstance.text(
          `Y: ${truncate(yLabel, maxTextW)}`,
          panelLeft + padX,
          panelTop + 14.8
        );

        return { topPad: panelH + 2 };
      };

      let isFirstPage = true;

      for (let i = 0; i < chartCards.length; i++) {
        const card = chartCards[i];

        // ── If card contains a table → use autoTable for this page ──────────
        const cardTable = card.querySelector('table');
        const cardCanvas = card.querySelector('canvas');

        if (cardTable && !cardCanvas) {
          // Table chart — use autoTable
          const theadCells = Array.from(
            cardTable.querySelectorAll(
              'thead tr:first-child th, thead tr:first-child td'
            )
          );

          const SKIP_HEADERS = [
            'createdat',
            'updatedat',
            'created_at',
            'updated_at',
            '__v',
            '_v',
            'password',
            'token',
            'refreshtoken',
          ];

          const allColumns = theadCells.map((th, idx) => ({
            idx,
            label: dashboardUtils.cleanPdfHeaderLabel(
              th.innerText ?? th.textContent ?? ''
            ),
          }));
          const columns = allColumns.filter(
            (col) =>
              !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
          );

          const tbodyRows = Array.from(cardTable.querySelectorAll('tbody tr'));
          const rows = tbodyRows.map((tr) => {
            const cells = Array.from(tr.querySelectorAll('td, th'));
            return columns.map((col) => {
              const cell = cells[col.idx];
              return cell
                ? cell.innerText?.trim() || cell.textContent?.trim() || ''
                : '';
            });
          });
          const filteredRows = rows.filter((row) => row.some((c) => c !== ''));

          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;

          // Temporarily draw placeholder header — will update total pages at end
          drawPageHeader(pdf, 'Table', i + 1, chartCards.length);

          const tableMargin = margin;
          autoTable(pdf, {
            head: [columns.map((col) => col.label)],
            body: filteredRows,
            startY: headerH + 2,
            showHead: 'everyPage',
            tableWidth: pageWidth - tableMargin * 2,
            styles: {
              fontSize: 7.5,
              cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
              font: 'helvetica',
              textColor: [32, 31, 30],
              lineColor: [218, 218, 218],
              lineWidth: 0.15,
              overflow: 'ellipsize',
            },
            headStyles: {
              fillColor: [32, 31, 30],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 7.5,
            },
            alternateRowStyles: { fillColor: [245, 249, 255] },
            didDrawPage: () => {
              drawPageFooter(pdf);
            },
            margin: {
              top: headerH + 2,
              right: tableMargin,
              bottom: footerH + 2,
              left: tableMargin,
            },
          });

          continue; // move to next chart card
        }

        // ── Chart card (ECharts canvas) → html2canvas capture ───────────────

        // Temporarily make card fully visible for capture
        const savedCardStyles = {
          height: card.style.height,
          maxHeight: card.style.maxHeight,
          overflow: card.style.overflow,
          position: card.style.position,
        };

        card.style.overflow = 'visible';
        card.style.maxHeight = 'none';

        // Also expand any inner clipped elements
        const innerClipped = Array.from(card.querySelectorAll('*')).filter(
          (el) => {
            const s = window.getComputedStyle(el);
            return (
              ['auto', 'scroll', 'hidden'].includes(s.overflow) ||
              ['auto', 'scroll', 'hidden'].includes(s.overflowY)
            );
          }
        );
        const innerSaved = innerClipped.map((el) => ({
          el,
          overflow: el.style.overflow,
          overflowY: el.style.overflowY,
          height: el.style.height,
          maxHeight: el.style.maxHeight,
        }));
        innerClipped.forEach((el) => {
          el.style.overflow = 'visible';
          el.style.overflowY = 'visible';
          el.style.maxHeight = 'none';
        });

        // Wait for ECharts to finish rendering animations
        await new Promise((r) => setTimeout(r, 400));

        let capturedCanvas;
        try {
          capturedCanvas = await html2canvas(card, {
            backgroundColor: '#ffffff',
            scale: 3,
            // scale: window.devicePixelRatio * 4,
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 15000,
            removeContainer: true,
            width: card.scrollWidth,
            height: card.scrollHeight,
            windowWidth: card.scrollWidth,
            windowHeight: card.scrollHeight,
            scrollX: 0,
            scrollY: 0,
            foreignObjectRendering: false,
          });
        } catch (captureErr) {
          continue;
        }

        // Restore card styles
        card.style.height = savedCardStyles.height;
        card.style.maxHeight = savedCardStyles.maxHeight;
        card.style.overflow = savedCardStyles.overflow;
        card.style.position = savedCardStyles.position;
        innerSaved.forEach(({ el, overflow, overflowY, height, maxHeight }) => {
          el.style.overflow = overflow;
          el.style.overflowY = overflowY;
          el.style.height = height;
          el.style.maxHeight = maxHeight;
        });

        // Add to PDF
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;

        // Get chart title from card DOM if available
        const titleEl = card.querySelector(
          '.bi-chart-title, .chart-title, [class*="title"], h3, h4'
        );
        const chartTitle = titleEl?.innerText?.trim() || `Chart ${i + 1}`;
        const chartHost = card.closest('[data-chart-id]');
        const chartId = chartHost?.getAttribute('data-chart-id');
        const chartCfg = chartId
          ? charts.find((c) => c.id === chartId) || charts[i]
          : charts[i];
        const legendItems = await collectLegendItemsFromCard(card);

        drawPageHeader(pdf, chartTitle, i + 1, chartCards.length);
        drawPageFooter(pdf);
        const axisLayout = drawAxisFieldsBlock(pdf, chartCfg);
        const legendLayout = drawLegendBlock(pdf, legendItems);
        const topPad = Math.max(
          axisLayout.topPad || 0,
          legendLayout.topPad || 0
        );

        // Fit image within usable area maintaining aspect ratio
        const imgData = capturedCanvas.toDataURL('image/png');
        const imgRatio = capturedCanvas.width / capturedCanvas.height;
        const maxW = Math.max(40, usableW - (legendLayout.rightPad || 0));
        const maxH = Math.max(20, usableH - topPad);

        let imgW = maxW;
        let imgH = imgW / imgRatio;

        if (imgH > maxH) {
          imgH = maxH;
          imgW = imgH * imgRatio;
        }

        // Center horizontally
        const xOffset = margin + (usableW - imgW) / 2;
        const yOffset = headerH + margin / 2 + topPad + (maxH - imgH) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgW, imgH, '', 'FAST');
      }

      pdf.save(`dashboard-${Date.now()}.pdf`);
      setSaveStatus(FORMAT_PDF_DOWNLOADED_CHARTS(chartCards.length));
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus(error.message || BI_UI.PDF_EXPORT_FAILED);
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setExportPdfInProgress(false);
    }
  }, [dashboardLogo, dashboardName, charts]);

  return (
    <div
      className={`${styles.biDashboard} bi-dashboard-root ${
        isPlaygroundMaximized ? styles.playgroundMaximized : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type='file'
        accept='.json,.csv,.xlsx'
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          overflow: 'hidden',
        }}
        onChange={handleFileUpload}
        aria-hidden
      />

      <input
        ref={logoInputRef}
        type='file'
        accept='image/*'
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          overflow: 'hidden',
        }}
        aria-hidden
        onChange={(e) => {
          if (isReadOnly) {
            errorMessage(BI_UI.READ_ONLY_EDITING_DISABLED);
            e.target.value = '';
            return;
          }
          const file = e.target?.files?.[0];
          if (!file || !file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            if (typeof dataUrl === 'string') setDashboardLogo(dataUrl);
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />

      {/* Main Header Section */}
      <header className={styles.biMainHeader}>
        <div className={styles.biHeaderLeft}>
          <div className={styles.biLogoContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerLogoSrc}
              alt='Dashboard logo'
              className={styles.biLogo}
              onError={(e) => {
                if (e.currentTarget.dataset.fallbackApplied === '1') {
                  e.currentTarget.onerror = null;
                  return;
                }
                e.currentTarget.dataset.fallbackApplied = '1';
                e.currentTarget.src = defaultDashboardLogoSrc;
              }}
            />
          </div>
          <h1 className={styles.biAppTitle}>{APP_NAME}</h1>
        </div>
        <div className={styles.biHeaderRight}>
          <ProfileBar
            user={me}
            loading={meLoading}
            dashboardLogo={dashboardLogoSrc || null}
            onSetDashboardImage={
              isReadOnly ? undefined : () => logoInputRef.current?.click()
            }
            onClearDashboardImage={
              isReadOnly ? undefined : () => setDashboardLogo(null)
            }
            onLogoutClick={handleLogoutClick}
          />
        </div>
      </header>

      <DashboardToolbar
        collectionInput={collectionInput}
        onCollectionChange={handleCollectionChange}
        onUpload={handleFileUpload}
        onExportJSON={handleDownloadJSON}
        onExportPDF={handleDownloadPDF}
        onPrint={handlePrintDashboard}
        onSave={handleSaveDashboard}
        canSave={Array.isArray(charts) && charts.length > 0}
        onLoad={handleLoadDashboard}
        onShare={handleShare}
        shareUrl={shareUrl}
        shareDisabled={isReadOnly || dashboardEffectiveRole !== 'Editor'}
        readOnly={isReadOnly}
        accessModeLabel={accessModeLabel}
        saveStatus={saveStatus}
        fileInputRef={fileInputRef}
        recordCount={recordCount}
        exportPdfInProgress={exportPdfInProgress}
        onViewData={() => setViewDataOpen(true)}
        dashboardName={dashboardName}
        onDashboardNameChange={isReadOnly ? undefined : setDashboardName}
        recentDashboardIds={recentDashboardIds}
        onLoadDashboardById={handleLoadDashboardById}
        onBeforeOpenLoadModal={refreshSavedDashboards}
        onRefreshDashboards={refreshSavedDashboards}
        dataFilter={dataFilter}
        onDataFilterChange={setDataFilter}
        dateFields={fields.filter(
          (f) =>
            f.type === 'date' ||
            /date|time|created|updated|year|month/i.test(f.name || '')
        )}
        isPlaygroundMaximized={isPlaygroundMaximized}
        onTogglePlaygroundMaximize={() =>
          setIsPlaygroundMaximized((prev) => !prev)
        }
        loadModalNestedRows={loadModalNestedRows}
        onSyncShared={isOwner ? handleSyncShared : undefined}
        syncDisabled={syncDisabled}
        syncHasPendingChanges={pendingCollaboratorSync}
        onClearPlayground={handleClearPlayground}
      />

      <div className={`${styles.biMain} bi-main`}>
        <aside
          className={`${styles.biSidebarLeft} bi-sidebar-left`}
          style={{ width: leftSidebarWidth, minWidth: 200, maxWidth: 600 }}
        >
          <FieldList
            collection={collection}
            onAddChart={isReadOnly ? undefined : handleAddChart}
            onFieldsLoaded={handleFieldsLoaded}
          />
        </aside>

        <div
          className={styles.biSidebarResizer}
          onMouseDown={(e) => {
            resizingRef.current = 'left';
            resizeStartXRef.current = e.clientX;
            startLeftWidthRef.current = leftSidebarWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />

        <main className={`${styles.biCanvas} bi-canvas`}>
          <ChartCanvas
            key={`canvas-${loadSurfaceKey}-${dashboardServerId || 'local'}`}
            isPlaygroundMaximized={isPlaygroundMaximized}
            charts={charts}
            selectedChartId={selectedChartId}
            onSelect={handleSelectChart}
            readOnly={isReadOnly}
            onLayoutChange={isReadOnly ? undefined : handleCanvasLayoutChange}
            savedLayouts={layouts}
            onRefresh={handleRefreshChart}
            onRemove={isReadOnly ? undefined : handleRequestRemoveChart}
            onDuplicate={isReadOnly ? undefined : handleDuplicateChart}
            onChartUpdate={isReadOnly ? undefined : handleUpdateChart}
            globalFilter={dataFilter}
          />
        </main>

        <div
          className={styles.biSidebarResizer}
          onMouseDown={(e) => {
            resizingRef.current = 'right';
            resizeStartXRef.current = e.clientX;
            startRightWidthRef.current = rightSidebarWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />

        <aside
          className={`${styles.biSidebarRight} bi-sidebarRight`}
          style={{ width: rightSidebarWidth, minWidth: 200, maxWidth: 600 }}
        >
          <ConfigPanel
            config={isReadOnly ? null : selectedChart}
            fields={fields}
            layouts={layouts}
            recordCount={recordCount}
            onUpdate={
              isReadOnly
                ? undefined
                : (updates) =>
                    selectedChart &&
                    handleUpdateChart(selectedChart.id, updates)
            }
            onRemove={isReadOnly ? undefined : handleRequestRemoveChart}
            onLayoutSizeChange={
              isReadOnly
                ? undefined
                : (id, size) => dispatch(updateChartLayout({ id, ...size }))
            }
          />
        </aside>
      </div>

      <ViewDataModal
        isOpen={viewDataOpen}
        onClose={() => setViewDataOpen(false)}
        collection={collection}
        fields={fields}
        recordCount={recordCount}
        dataFilter={dataFilter}
      />

      {/* Bottom-right minimize / restore toggle for maximized canvas */}
      <button
        type='button'
        className={styles.playgroundToggleButton}
        onClick={() => setIsPlaygroundMaximized((prev) => !prev)}
        aria-label={
          isPlaygroundMaximized
            ? 'Restore dashboard layout'
            : 'Maximize chart area'
        }
      >
        <span style={{ fontSize: 14 }}>
          {isPlaygroundMaximized ? <AiOutlineCompress /> : <AiOutlineExpand />}
        </span>
        {/* <span>{isPlaygroundMaximized ? 'Restore layout' : 'Maximize canvas'}</span> */}
      </button>

      {/* Delete chart confirmation modal */}
      {chartToDeleteId && (
        <div
          className={styles.deleteModalOverlay}
          role='dialog'
          aria-modal='true'
          aria-labelledby='delete-chart-title'
          onClick={handleCancelRemoveChart}
          onKeyDown={(e) => e.key === 'Escape' && handleCancelRemoveChart()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className={styles.deleteModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3
              id='delete-chart-title'
              style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}
            >
              Delete chart
            </h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
              Are you sure you want to delete this chart? This action cannot be
              undone.
            </p>
            <div
              style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}
            >
              <button
                type='button'
                onClick={handleCancelRemoveChart}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleConfirmRemoveChart}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#dc2626',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareDashboardModal
        open={shareModalOpen}
        dashboardId={dashboardServerId}
        onClose={() => setShareModalOpen(false)}
        onShared={() => {
          refreshSavedDashboards().catch(() => {});
          setSaveStatus(BI_UI.SHARED_OK);
          setTimeout(() => setSaveStatus(''), 2000);
        }}
      />

      {logoutConfirmOpen && (
        <div
          className={styles.deleteModalOverlay}
          role='dialog'
          aria-modal='true'
          aria-labelledby='logout-confirm-title'
          onClick={() => setLogoutConfirmOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setLogoutConfirmOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className={styles.deleteModal}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3
              id='logout-confirm-title'
              style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}
            >
              Log out
            </h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
              Are you sure you want to log out?
            </p>
            <div
              style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}
            >
              <button
                type='button'
                onClick={() => setLogoutConfirmOpen(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  performLogout();
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#0f6cbd',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Copilot Component */}
      {/* <Copilot
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onGenerateChart={handleCopilotGenerateChart}
        collection={collection}
        fields={fields}
        disabled={!collection || !collection.trim()}
      /> */}
    </div>
  );
};

export default BiDashboard;
