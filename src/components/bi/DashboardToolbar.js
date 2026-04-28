import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  AiOutlineCloudUpload,
  AiOutlineDownload,
  AiOutlinePrinter,
  AiOutlineSave,
  AiOutlineFolderOpen,
  AiOutlineShareAlt,
  AiOutlineDown,
  AiOutlineTable,
  AiOutlineFilter,
  AiOutlineExpand,
  AiOutlineCompress,
  AiOutlineClose,
  AiOutlineSearch,
  AiOutlineSync,
  AiOutlineClear,
} from 'react-icons/ai';
import { getBiCollections } from '@/services/biService';
import DashboardAccessModal from './DashboardAccessModal';
import styles from './DashboardToolbar.module.css';
import {
  LOAD_LIST_OVERSCAN,
  LOAD_LIST_VIEWPORT,
  LOAD_ROW_HEIGHT,
} from '@/utils/constants';

function sortNestedBlocksByRecent(rows, recentIdRank) {
  const r = Array.isArray(rows) ? rows : [];
  const blocks = [];
  let i = 0;
  while (i < r.length) {
    if (r[i].kind !== 'folder') {
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    while (i < r.length && r[i].kind === 'version') i += 1;
    blocks.push(r.slice(start, i));
  }
  blocks.sort((a, b) => {
    const fa = a[0];
    const fb = b[0];
    const ida = String(fa.loadId);
    const idb = String(fb.loadId);
    const ra = recentIdRank.has(ida) ? recentIdRank.get(ida) : 1e9;
    const rb = recentIdRank.has(idb) ? recentIdRank.get(idb) : 1e9;
    if (ra !== rb) return ra - rb;
    const ta = fa.latestUpdatedAt ? new Date(fa.latestUpdatedAt).getTime() : 0;
    const tb = fb.latestUpdatedAt ? new Date(fb.latestUpdatedAt).getTime() : 0;
    return tb - ta;
  });
  return blocks.flat();
}

function filterNestedRows(rows, searchRaw) {
  const r = Array.isArray(rows) ? rows : [];
  const q = String(searchRaw || '')
    .trim()
    .toLowerCase();
  if (!q) return r;
  const out = [];
  let i = 0;
  while (i < r.length) {
    if (r[i].kind !== 'folder') {
      i += 1;
      continue;
    }
    const folder = r[i];
    const children = [];
    let j = i + 1;
    while (j < r.length && r[j].kind === 'version') children.push(r[j++]);
    const parentMatch = String(folder.label || '')
      .toLowerCase()
      .includes(q);
    const matchedChildren = children.filter((c) =>
      String(c.label || '')
        .toLowerCase()
        .includes(q)
    );
    if (parentMatch) {
      out.push(folder, ...children);
    } else if (matchedChildren.length) {
      out.push(folder, ...matchedChildren);
    }
    i = j;
  }
  return out;
}

function formatSharedMeta(row, dateStr) {
  const parts = [];
  if (dateStr) parts.push(`Updated ${dateStr}`);
  if (row?.isShared && !row?.isOwnedByMe) parts.push('Shared with you');
  if (row?.canManageAccess && row?.shareCount > 0) {
    parts.push(
      `Shared with ${row.shareCount} user${row.shareCount === 1 ? '' : 's'}`
    );
  }
  return parts.join(' • ');
}

function LoadDashboardNestedList({
  items,
  recentIdsSet,
  onSelectRow,
  onManageAccess,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [menuRowKey, setMenuRowKey] = useState(null);
  const menuRef = useRef(null);
  const totalHeight = items.length * LOAD_ROW_HEIGHT;
  const start = Math.max(
    0,
    Math.floor(scrollTop / LOAD_ROW_HEIGHT) - LOAD_LIST_OVERSCAN
  );
  const end = Math.min(
    items.length,
    Math.ceil(
      scrollTop / LOAD_ROW_HEIGHT + LOAD_LIST_VIEWPORT / LOAD_ROW_HEIGHT
    ) + LOAD_LIST_OVERSCAN
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuRowKey(null);
      }
    };
    if (menuRowKey) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuRowKey]);

  return (
    <div
      className={styles.loadModalListScroll}
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
        setMenuRowKey(null);
      }}
    >
      {items.length === 0 ? null : (
        <div
          style={{
            height: totalHeight,
            position: 'relative',
            width: '100%',
          }}
        >
          {items.slice(start, end).map((row, sliceIdx) => {
            const idx = start + sliceIdx;
            const isFolder = row.kind === 'folder';
            const recentKey = String(row.loadId);
            const isRecent = recentIdsSet.has(recentKey);
            const dateRaw = isFolder ? row.latestUpdatedAt : null;
            const dateStr = dateRaw
              ? new Date(dateRaw).toLocaleDateString()
              : null;
            const metaText = formatSharedMeta(row, dateStr);
            return (
              <div
                key={row.rowKey}
                className={`${styles.loadModalRow} ${isRecent ? styles.loadModalRowRecent : ''} ${isFolder ? styles.loadModalRowFolder : styles.loadModalRowVersion}`}
                style={{
                  position: 'absolute',
                  top: idx * LOAD_ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: LOAD_ROW_HEIGHT,
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type='button'
                  className={styles.loadModalRowButton}
                  onClick={() => onSelectRow(row)}
                >
                  <span className={styles.loadModalRowMain}>
                    <div
                      className={
                        isFolder
                          ? styles.loadModalRowName
                          : styles.loadModalRowVersionLabel
                      }
                    >
                      {row.label}
                    </div>
                    {isFolder && metaText ? (
                      <div className={styles.loadModalRowMeta}>{metaText}</div>
                    ) : null}
                  </span>
                  {isRecent ? (
                    <span className={styles.loadModalRecentBadge}>Recent</span>
                  ) : null}
                </button>
                {isFolder && row.canManageAccess ? (
                  <div className={styles.loadModalActionWrap} ref={menuRef}>
                    <button
                      type='button'
                      className={styles.loadModalActionBtn}
                      aria-label={`Manage sharing for ${row.label}`}
                      aria-haspopup='menu'
                      aria-expanded={menuRowKey === row.rowKey}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuRowKey((prev) =>
                          prev === row.rowKey ? null : row.rowKey
                        );
                      }}
                    >
                      ⋯
                    </button>
                    {menuRowKey === row.rowKey ? (
                      <div className={styles.loadModalActionMenu} role='menu'>
                        <button
                          type='button'
                          className={styles.loadModalActionItem}
                          role='menuitem'
                          onClick={() => {
                            setMenuRowKey(null);
                            onManageAccess?.(row);
                          }}
                        >
                          Manage access
                        </button>
                        <button
                          type='button'
                          className={`${styles.loadModalActionItem} ${styles.loadModalActionItemDanger}`}
                          role='menuitem'
                          onClick={() => {
                            setMenuRowKey(null);
                            onManageAccess?.(row, {
                              startInRevokeConfirm: true,
                            });
                          }}
                        >
                          Stop sharing with all
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

LoadDashboardNestedList.propTypes = {
  items: PropTypes.array.isRequired,
  recentIdsSet: PropTypes.instanceOf(Set).isRequired,
  onSelectRow: PropTypes.func.isRequired,
  onManageAccess: PropTypes.func,
};

const ToolbarButton = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  disabled,
  title: titleProp,
  'aria-label': ariaLabel,
}) => (
  <button
    type='button'
    className={`${styles.toolbarBtn} ${styles[variant] || ''}`}
    onClick={onClick}
    disabled={disabled}
    title={titleProp || label}
    aria-label={ariaLabel || label}
  >
    <Icon className={styles.toolbarIcon} aria-hidden />
    <span className={styles.toolbarLabel}>{label}</span>
  </button>
);

ToolbarButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'danger']),
  disabled: PropTypes.bool,
  title: PropTypes.string,
  'aria-label': PropTypes.string,
};

const ToolbarDropdown = ({ icon: Icon, label, children, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className={styles.dropdownWrap} ref={ref}>
      <button
        type='button'
        className={styles.toolbarBtn}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup='true'
      >
        <Icon className={styles.toolbarIcon} aria-hidden />
        <span className={styles.toolbarLabel}>{label}</span>
        <AiOutlineDown
          className={`${styles.toolbarChevron} ${open ? styles.open : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className={styles.dropdownMenu}
          role='menu'
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

ToolbarDropdown.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
};

const DashboardToolbar = ({
  collectionInput,
  onCollectionChange,
  onExportJSON,
  onExportPDF,
  onPrint,
  onSave,
  onLoad,
  onShare,
  shareUrl,
  shareDisabled,
  readOnly = false,
  accessModeLabel = '',
  canSave = true,
  saveStatus,
  fileInputRef,
  recordCount,
  onViewData,
  dashboardName,
  onDashboardNameChange,
  recentDashboardIds = [],
  onLoadDashboardById,
  onBeforeOpenLoadModal,
  onRefreshDashboards,
  dataFilter,
  onDataFilterChange,
  dateFields = [],
  isPlaygroundMaximized,
  onTogglePlaygroundMaximize,
  loadModalNestedRows = [],
  onSyncShared,
  syncDisabled = true,
  syncHasPendingChanges,
  onClearPlayground,
}) => {
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadModalPreparing, setLoadModalPreparing] = useState(false);
  const [loadSearchQuery, setLoadSearchQuery] = useState('');
  const [debouncedLoadSearch, setDebouncedLoadSearch] = useState('');
  const [loadPortalReady, setLoadPortalReady] = useState(false);
  const loadSearchInputRef = useRef(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [accessModalRow, setAccessModalRow] = useState(null);
  const dropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);

  const [filterDraft, setFilterDraft] = useState(() => ({
    field: dateFields[0]?.name || '',
    type: 'date',
    value: '',
    from: '',
    to: '',
  }));

  const filterField = filterDraft.field || dateFields[0]?.name || '';
  const filterType = filterDraft.type;
  const filterValue = filterDraft.value;
  const filterFrom = filterDraft.from;
  const filterTo = filterDraft.to;

  useEffect(() => {
    if (dataFilter) {
      setFilterDraft((d) => ({
        field: dataFilter.field || dateFields[0]?.name || d.field,
        type: dataFilter.type || 'date',
        value: dataFilter.value ?? '',
        from: dataFilter.from ?? '',
        to: dataFilter.to ?? '',
      }));
    } else {
      setFilterDraft((d) => ({
        ...d,
        field: dateFields[0]?.name || d.field,
        type: 'date',
        value: '',
        from: '',
        to: '',
      }));
    }
  }, [dataFilter, dateFields]);

  useEffect(() => {
    setLoadPortalReady(true);
  }, []);

  useEffect(() => {
    if (!loadModalOpen) return;
    setLoadSearchQuery('');
    setDebouncedLoadSearch('');
  }, [loadModalOpen]);

  useEffect(() => {
    if (!loadModalOpen) return undefined;
    const id = window.setTimeout(() => {
      setDebouncedLoadSearch(loadSearchQuery.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [loadSearchQuery, loadModalOpen]);

  useEffect(() => {
    if (!loadModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLoadModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [loadModalOpen]);

  useEffect(() => {
    if (!loadModalOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [loadModalOpen]);

  useEffect(() => {
    if (!loadModalOpen) return undefined;
    const raf = requestAnimationFrame(() => {
      loadSearchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [loadModalOpen]);

  const recentIdRank = useMemo(() => {
    const m = new Map();
    recentDashboardIds.forEach((rid, i) => {
      m.set(String(rid), i);
    });
    return m;
  }, [recentDashboardIds]);

  const recentIdsSet = useMemo(
    () => new Set(recentDashboardIds.map(String)),
    [recentDashboardIds]
  );

  const orderedNestedRows = useMemo(() => {
    const rows = Array.isArray(loadModalNestedRows) ? loadModalNestedRows : [];
    return sortNestedBlocksByRecent(rows, recentIdRank);
  }, [loadModalNestedRows, recentIdRank]);

  const filteredNestedLoadRows = useMemo(
    () => filterNestedRows(orderedNestedRows, debouncedLoadSearch),
    [orderedNestedRows, debouncedLoadSearch]
  );

  const loadModalFolderCount = useMemo(
    () =>
      (Array.isArray(loadModalNestedRows) ? loadModalNestedRows : []).filter(
        (r) => r.kind === 'folder'
      ).length,
    [loadModalNestedRows]
  );

  const loadModalEmptyMessage = useMemo(() => {
    if (loadModalFolderCount === 0) {
      return 'No saved dashboards yet. Save a dashboard to see it listed here.';
    }
    if (debouncedLoadSearch.length > 0) {
      return 'No dashboards found matching your search.';
    }
    return 'No dashboards found.';
  }, [loadModalFolderCount, debouncedLoadSearch]);

  const handlePickLoadRow = useCallback(
    (row) => {
      if (row?.loadId) onLoadDashboardById(String(row.loadId));
      setLoadModalOpen(false);
    },
    [onLoadDashboardById]
  );

  const handleOpenLoadModal = useCallback(async () => {
    if (loadModalPreparing) return;
    setLoadModalPreparing(true);
    try {
      await onBeforeOpenLoadModal?.();
      setLoadModalOpen(true);
    } finally {
      setLoadModalPreparing(false);
    }
  }, [loadModalPreparing, onBeforeOpenLoadModal]);

  const handleManageAccess = useCallback((row, options = {}) => {
    setAccessModalRow(row ? { ...row, ...options } : null);
  }, []);

  const handleAccessUpdated = useCallback(async () => {
    await onRefreshDashboards?.();
  }, [onRefreshDashboards]);

  // Fetch collections list on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCollections(true);

    getBiCollections()
      .then((res) => res.data)
      .then((data) => {
        if (!cancelled) {
          setCollections(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch collections:', err);
        if (!cancelled) {
          setCollections([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCollections(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target)
      )
        setFilterDropdownOpen(false);
    };
    if (dropdownOpen || filterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen, filterDropdownOpen]);

  const applyFilter = () => {
    const field = filterField || dateFields[0]?.name;
    if (!field) return;
    if (filterType === 'date') {
      if (filterFrom || filterTo) {
        onDataFilterChange?.({
          field,
          type: 'date',
          from: filterFrom || undefined,
          to: filterTo || undefined,
        });
      } else {
        onDataFilterChange?.(null);
      }
    } else {
      if (filterValue) {
        onDataFilterChange?.({
          field,
          type: filterType,
          value: filterValue.trim(),
        });
      } else {
        onDataFilterChange?.(null);
      }
    }
    setFilterDropdownOpen(false);
  };

  const clearFilter = () => {
    onDataFilterChange?.(null);
    setFilterDraft((d) => ({ ...d, value: '', from: '', to: '' }));
    setFilterDropdownOpen(false);
  };

  const updateDraft = (updates) =>
    setFilterDraft((d) => ({ ...d, ...updates }));

  const toolbarRestricted = Boolean(readOnly);

  return (
    <header
      className={`${styles.toolbar} bi-dashboard-toolbar ${toolbarRestricted ? styles.toolbarRestricted : ''}`}
      role='banner'
      data-access-restricted={toolbarRestricted ? 'true' : undefined}
    >
      <div className={styles.toolbarLeft}>
        <div className={styles.collectionWrap}>
          <label
            htmlFor='bi-toolbar-collection'
            className={styles.collectionLabel}
          >
            Collection
          </label>
          {accessModeLabel ? (
            <span className={styles.accessModeBadge} title={accessModeLabel}>
              {accessModeLabel}
            </span>
          ) : null}
          <div className={styles.collectionDropdownWrap} ref={dropdownRef}>
            <select
              id='bi-toolbar-collection'
              className={styles.collectionSelect}
              value={collectionInput || ''}
              onChange={(e) => onCollectionChange(e.target.value)}
              aria-label='Collection name'
              disabled={readOnly}
              title={
                readOnly
                  ? 'Read-only (Viewer): collection cannot be changed'
                  : 'Choose data collection'
              }
            >
              <option value=''>Select a collection</option>
              {collections.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {loadingCollections && (
              <span className={styles.collectionLoading}>Loading...</span>
            )}
          </div>
          {recordCount !== null && recordCount !== undefined && (
            <span className={styles.recordCount}>
              (
              {typeof recordCount === 'number'
                ? recordCount.toLocaleString()
                : String(recordCount)}{' '}
              records)
            </span>
          )}
        </div>
        {onDashboardNameChange && (
          <div className={styles.dashboardNameWrap}>
            <label
              htmlFor='bi-toolbar-dashboard-name'
              className={styles.collectionLabel}
            >
              Dashboard name
            </label>
            <input
              id='bi-toolbar-dashboard-name'
              type='text'
              className={styles.dashboardNameInput}
              placeholder='My Dashboard'
              value={dashboardName ?? ''}
              onChange={(e) => onDashboardNameChange(e.target.value)}
              aria-label='Dashboard name for save/export'
              disabled={readOnly}
            />
          </div>
        )}
      </div>

      <div className={styles.toolbarRight}>
        {onViewData && (
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              icon={AiOutlineTable}
              label='View'
              onClick={onViewData}
              disabled={!collectionInput?.trim()}
              title={
                collectionInput?.trim()
                  ? 'View collection data as table'
                  : 'Select or upload a collection first'
              }
            />
          </div>
        )}
        <div className={styles.toolbarGroup}>
          <ToolbarButton
            icon={AiOutlineCloudUpload}
            label='Upload'
            onClick={() => fileInputRef?.current?.click()}
            variant='success'
            disabled={readOnly}
            title={
              readOnly
                ? 'Read-only (Viewer): upload disabled'
                : 'Upload CSV, JSON, or XLSX data'
            }
          />
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarDropdown icon={AiOutlineDownload} label='Export'>
            <button
              type='button'
              className={styles.dropdownItem}
              onClick={() => {
                onExportJSON();
              }}
              role='menuitem'
            >
              Export JSON
            </button>
            <button
              type='button'
              className={styles.dropdownItem}
              onClick={() => {
                onExportPDF();
              }}
              role='menuitem'
            >
              Export PDF
            </button>
          </ToolbarDropdown>
        </div>

        {dateFields.length > 0 && onDataFilterChange && (
          <div className={styles.toolbarGroup} ref={filterDropdownRef}>
            <div className={styles.dropdownWrap}>
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                title='Filter data by date'
                aria-label='Filters'
                aria-expanded={filterDropdownOpen}
                aria-haspopup='true'
              >
                <AiOutlineFilter className={styles.toolbarIcon} aria-hidden />
                <span className={styles.toolbarLabel}>Filters</span>
                {dataFilter && (
                  <span
                    className={styles.filterBadge}
                    title='Active'
                    aria-hidden
                  >
                    ●
                  </span>
                )}
                <AiOutlineDown
                  className={`${styles.toolbarChevron} ${filterDropdownOpen ? styles.open : ''}`}
                  aria-hidden
                />
              </button>
              {filterDropdownOpen && (
                <div
                  className={styles.filterDropdownMenu}
                  role='dialog'
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.filterRow}>
                    <label className={styles.filterLabel}>Date field</label>
                    <select
                      className={styles.filterSelect}
                      value={filterField}
                      onChange={(e) => updateDraft({ field: e.target.value })}
                    >
                      {dateFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterRow}>
                    <label className={styles.filterLabel}>Filter by</label>
                    <select
                      className={styles.filterSelect}
                      value={filterType}
                      onChange={(e) => updateDraft({ type: e.target.value })}
                    >
                      <option value='date'>Date range</option>
                      <option value='month'>Month</option>
                      <option value='quarter'>Quarter</option>
                      <option value='year'>Year</option>
                    </select>
                  </div>
                  {filterType === 'date' ? (
                    <>
                      <div className={styles.filterRow}>
                        <label className={styles.filterLabel}>From</label>
                        <input
                          type='date'
                          className={styles.filterInput}
                          value={filterFrom}
                          onChange={(e) =>
                            updateDraft({ from: e.target.value })
                          }
                        />
                      </div>
                      <div className={styles.filterRow}>
                        <label className={styles.filterLabel}>To</label>
                        <input
                          type='date'
                          className={styles.filterInput}
                          value={filterTo}
                          onChange={(e) => updateDraft({ to: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <div className={styles.filterRow}>
                      <label className={styles.filterLabel}>
                        {filterType === 'month'
                          ? 'Month (YYYY-MM)'
                          : filterType === 'quarter'
                            ? 'Quarter (e.g. 2024-Q1)'
                            : 'Year (YYYY)'}
                      </label>
                      <input
                        type='text'
                        className={styles.filterInput}
                        placeholder={
                          filterType === 'year'
                            ? '2024'
                            : filterType === 'month'
                              ? '2024-01'
                              : '2024-Q1'
                        }
                        value={filterValue}
                        onChange={(e) => updateDraft({ value: e.target.value })}
                      />
                    </div>
                  )}
                  <div className={styles.filterActions}>
                    <button
                      type='button'
                      className={styles.filterApplyBtn}
                      onClick={applyFilter}
                    >
                      Apply
                    </button>
                    <button
                      type='button'
                      className={styles.filterClearBtn}
                      onClick={clearFilter}
                    >
                      Clear filter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {onTogglePlaygroundMaximize && (
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              icon={isPlaygroundMaximized ? AiOutlineCompress : AiOutlineExpand}
              label={isPlaygroundMaximized ? 'Minimize' : 'Maximize'}
              onClick={onTogglePlaygroundMaximize}
              title={
                isPlaygroundMaximized
                  ? 'Exit full-screen canvas'
                  : 'Maximize chart canvas area'
              }
              aria-label={
                isPlaygroundMaximized
                  ? 'Minimize playground'
                  : 'Maximize playground'
              }
            />
          </div>
        )}

        <div className={styles.toolbarGroup}>
          <ToolbarButton
            icon={AiOutlinePrinter}
            label='Print'
            onClick={onPrint}
          />
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton
            icon={AiOutlineSave}
            label='Save'
            onClick={onSave}
            variant='primary'
            disabled={readOnly || !canSave}
            title={
              readOnly
                ? 'Read-only (Viewer): save disabled'
                : !canSave
                  ? 'Add at least one chart before saving'
                  : 'Save dashboard'
            }
          />
          {onLoadDashboardById ? (
            <>
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={handleOpenLoadModal}
                disabled={readOnly || loadModalPreparing}
                title={
                  readOnly
                    ? 'Read-only (Viewer): loading another dashboard is disabled'
                    : loadModalPreparing
                      ? 'Refreshing saved dashboards...'
                      : 'Open saved dashboards'
                }
                aria-haspopup='dialog'
                aria-expanded={loadModalOpen}
              >
                <AiOutlineFolderOpen
                  className={styles.toolbarIcon}
                  aria-hidden
                />
                <span className={styles.toolbarLabel}>Load</span>
              </button>
              {loadPortalReady &&
                loadModalOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    className={styles.loadModalBackdrop}
                    role='presentation'
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) setLoadModalOpen(false);
                    }}
                  >
                    <div
                      className={styles.loadModalPanel}
                      role='dialog'
                      aria-modal='true'
                      aria-labelledby='load-dashboard-dialog-title'
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className={styles.loadModalHeader}>
                        <h2
                          id='load-dashboard-dialog-title'
                          className={styles.loadModalTitle}
                        >
                          Load dashboard
                        </h2>
                        <button
                          type='button'
                          className={styles.loadModalClose}
                          onClick={() => setLoadModalOpen(false)}
                          aria-label='Close'
                        >
                          <AiOutlineClose size={18} aria-hidden />
                        </button>
                      </div>
                      <div className={styles.loadModalSearchWrap}>
                        <label
                          htmlFor='bi-load-dashboard-search'
                          className={styles.visuallyHidden}
                        >
                          Search dashboards or versions
                        </label>
                        <div
                          style={{
                            position: 'relative',
                          }}
                        >
                          <AiOutlineSearch
                            aria-hidden
                            style={{
                              position: 'absolute',
                              left: 12,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#9ca3af',
                              pointerEvents: 'none',
                            }}
                            size={16}
                          />
                          <input
                            id='bi-load-dashboard-search'
                            ref={loadSearchInputRef}
                            type='search'
                            className={styles.loadModalSearch}
                            placeholder='Search by name or version…'
                            autoComplete='off'
                            value={loadSearchQuery}
                            onChange={(e) => setLoadSearchQuery(e.target.value)}
                            style={{ paddingLeft: 36 }}
                          />
                        </div>
                      </div>
                      {filteredNestedLoadRows.length > 0 ? (
                        <LoadDashboardNestedList
                          key={debouncedLoadSearch}
                          items={filteredNestedLoadRows}
                          recentIdsSet={recentIdsSet}
                          onSelectRow={handlePickLoadRow}
                          onManageAccess={handleManageAccess}
                        />
                      ) : (
                        <div className={styles.loadModalListScroll}>
                          <div className={styles.loadModalEmpty}>
                            {loadModalEmptyMessage}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
            </>
          ) : (
            <ToolbarButton
              icon={AiOutlineFolderOpen}
              label='Load'
              onClick={onLoad}
              title='Load latest from server or local'
            />
          )}
        </div>

        {onSyncShared && (
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              icon={AiOutlineSync}
              label='Sync'
              onClick={onSyncShared}
              disabled={syncDisabled}
              title={
                syncDisabled
                  ? 'Only the owner can merge collaborator edits into a new version'
                  : syncHasPendingChanges === false
                    ? 'No pending collaborator changes were detected, but you can still run sync to refresh from the server'
                    : 'Merge latest collaborator edits into a new version on your dashboard'
              }
            />
          </div>
        )}
        {onClearPlayground && (
          <ToolbarButton
            icon={AiOutlineClear}
            label='Clear'
            onClick={onClearPlayground}
            disabled={readOnly}
            title={
              readOnly
                ? 'Read-only: clear disabled'
                : 'Reset playground (unsaved work is lost)'
            }
          />
        )}

        {onShare && (
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              icon={AiOutlineShareAlt}
              label='Share'
              onClick={onShare}
              disabled={!shareUrl || shareDisabled}
              title={
                shareDisabled
                  ? 'Only editors can share'
                  : shareUrl
                    ? 'Share dashboard with users'
                    : 'Save dashboard first to share'
              }
            />
          </div>
        )}

        {saveStatus && (
          <span className={styles.status} role='status' aria-live='polite'>
            {saveStatus}
          </span>
        )}
      </div>

      <DashboardAccessModal
        open={Boolean(accessModalRow)}
        dashboardId={accessModalRow?.loadId || null}
        dashboardName={accessModalRow?.label || ''}
        startInRevokeConfirm={Boolean(accessModalRow?.startInRevokeConfirm)}
        onClose={() => setAccessModalRow(null)}
        onAccessUpdated={handleAccessUpdated}
      />

      {/* shareUrl is used only to enable/disable the Share action */}
    </header>
  );
};

DashboardToolbar.propTypes = {
  collectionInput: PropTypes.string.isRequired,
  onCollectionChange: PropTypes.func.isRequired,
  onUpload: PropTypes.func.isRequired,
  onExportJSON: PropTypes.func.isRequired,
  onExportPDF: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onLoad: PropTypes.func.isRequired,
  onShare: PropTypes.func,
  shareUrl: PropTypes.string,
  shareDisabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  accessModeLabel: PropTypes.string,
  canSave: PropTypes.bool,
  saveStatus: PropTypes.string,
  fileInputRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  recordCount: PropTypes.number,
  onViewData: PropTypes.func,
  dashboardName: PropTypes.string,
  onDashboardNameChange: PropTypes.func,
  recentDashboardIds: PropTypes.arrayOf(PropTypes.string),
  onLoadDashboardById: PropTypes.func,
  onBeforeOpenLoadModal: PropTypes.func,
  onRefreshDashboards: PropTypes.func,
  dataFilter: PropTypes.shape({
    field: PropTypes.string,
    type: PropTypes.oneOf(['date', 'month', 'quarter', 'year']),
    from: PropTypes.string,
    to: PropTypes.string,
    value: PropTypes.string,
  }),
  onDataFilterChange: PropTypes.func,
  dateFields: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, type: PropTypes.string })
  ),
  isPlaygroundMaximized: PropTypes.bool,
  onTogglePlaygroundMaximize: PropTypes.func,
  loadModalNestedRows: PropTypes.arrayOf(
    PropTypes.shape({
      rowKey: PropTypes.string.isRequired,
      kind: PropTypes.oneOf(['folder', 'version']).isRequired,
      label: PropTypes.string.isRequired,
      loadId: PropTypes.string.isRequired,
    })
  ),
  onSyncShared: PropTypes.func,
  syncDisabled: PropTypes.bool,
  syncHasPendingChanges: PropTypes.bool,
};

export default DashboardToolbar;
export { ToolbarButton, ToolbarDropdown };
