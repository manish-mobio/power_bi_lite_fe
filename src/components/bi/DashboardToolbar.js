/**
 * Power BI Lite - Dashboard Toolbar
 * Clean, professional menu bar with icons + tooltips (dashboard-style UI)
 */
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
} from 'react-icons/ai';
import styles from './DashboardToolbar.module.css';

const LOAD_ROW_HEIGHT = 56;
const LOAD_LIST_VIEWPORT = 300;
const LOAD_LIST_OVERSCAN = 6;

function LoadDashboardVirtualList({ items, recentIdsSet, onSelectRow }) {
  const [scrollTop, setScrollTop] = useState(0);
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

  return (
    <div
      className={styles.loadModalListScroll}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {items.length === 0 ? null : (
        <div
          style={{
            height: totalHeight,
            position: 'relative',
            width: '100%',
          }}
        >
          {items.slice(start, end).map((d, sliceIdx) => {
            const idx = start + sliceIdx;
            const rowId = String(d._id || d.id);
            const isRecent = recentIdsSet.has(rowId);
            const dateStr = d.updatedAt
              ? new Date(d.updatedAt).toLocaleDateString()
              : null;
            return (
              <button
                key={rowId}
                type='button'
                className={`${styles.loadModalRow} ${isRecent ? styles.loadModalRowRecent : ''}`}
                style={{
                  position: 'absolute',
                  top: idx * LOAD_ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: LOAD_ROW_HEIGHT,
                  boxSizing: 'border-box',
                }}
                onClick={() => onSelectRow(d)}
              >
                <span className={styles.loadModalRowMain}>
                  <div className={styles.loadModalRowName}>
                    {d.name || 'Unnamed'}
                  </div>
                  {dateStr ? (
                    <div className={styles.loadModalRowMeta}>{dateStr}</div>
                  ) : null}
                </span>
                {isRecent ? (
                  <span className={styles.loadModalRecentBadge}>Recent</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

LoadDashboardVirtualList.propTypes = {
  items: PropTypes.array.isRequired,
  recentIdsSet: PropTypes.instanceOf(Set).isRequired,
  onSelectRow: PropTypes.func.isRequired,
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
  saveStatus,
  fileInputRef,
  recordCount,
  onViewData,
  dashboardName,
  onDashboardNameChange,
  savedDashboards,
  recentDashboardIds = [],
  onLoadDashboardById,
  dataFilter,
  onDataFilterChange,
  dateFields = [],
  isPlaygroundMaximized,
  onTogglePlaygroundMaximize,
}) => {
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadSearchQuery, setLoadSearchQuery] = useState('');
  const [debouncedLoadSearch, setDebouncedLoadSearch] = useState('');
  const [loadPortalReady, setLoadPortalReady] = useState(false);
  const loadSearchInputRef = useRef(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
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

  const filteredOrderedDashboards = useMemo(() => {
    const list = Array.isArray(savedDashboards) ? savedDashboards : [];
    const q = debouncedLoadSearch.toLowerCase();
    const filtered =
      q.length > 0
        ? list.filter((d) =>
            String(d.name || 'Unnamed')
              .toLowerCase()
              .includes(q)
          )
        : list;
    return [...filtered].sort((a, b) => {
      const ida = String(a._id || a.id);
      const idb = String(b._id || b.id);
      const ra = recentIdRank.has(ida) ? recentIdRank.get(ida) : 1e9;
      const rb = recentIdRank.has(idb) ? recentIdRank.get(idb) : 1e9;
      if (ra !== rb) return ra - rb;
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
  }, [savedDashboards, debouncedLoadSearch, recentIdRank]);

  const loadModalEmptyMessage = useMemo(() => {
    const rawLen = Array.isArray(savedDashboards) ? savedDashboards.length : 0;
    if (rawLen === 0) {
      return 'No saved dashboards yet. Save a dashboard to see it listed here.';
    }
    if (debouncedLoadSearch.length > 0) {
      return 'No dashboards found matching your search.';
    }
    return 'No dashboards found.';
  }, [savedDashboards, debouncedLoadSearch]);

  const handlePickSavedDashboard = useCallback(
    (d) => {
      onLoadDashboardById(d._id || d.id);
      setLoadModalOpen(false);
    },
    [onLoadDashboardById]
  );

  // Fetch collections list on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCollections(true);

    fetch('/api/bi/collections')
      .then((res) => res.json())
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

  return (
    <header className={`${styles.toolbar} bi-dashboard-toolbar`} role='banner'>
      <div className={styles.toolbarLeft}>
        <div className={styles.collectionWrap}>
          <label
            htmlFor='bi-toolbar-collection'
            className={styles.collectionLabel}
          >
            Collection
          </label>
          <div className={styles.collectionDropdownWrap} ref={dropdownRef}>
            <select
              id='bi-toolbar-collection'
              className={styles.collectionSelect}
              value={collectionInput || ''}
              onChange={(e) => onCollectionChange(e.target.value)}
              aria-label='Collection name'
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
          />
          {onLoadDashboardById ? (
            <>
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={() => setLoadModalOpen(true)}
                title='Open saved dashboards'
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
                          Search dashboards by name
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
                            placeholder='Search by name…'
                            autoComplete='off'
                            value={loadSearchQuery}
                            onChange={(e) => setLoadSearchQuery(e.target.value)}
                            style={{ paddingLeft: 36 }}
                          />
                        </div>
                      </div>
                      {filteredOrderedDashboards.length > 0 ? (
                        <LoadDashboardVirtualList
                          key={debouncedLoadSearch}
                          items={filteredOrderedDashboards}
                          recentIdsSet={recentIdsSet}
                          onSelectRow={handlePickSavedDashboard}
                        />
                      ) : (
                        <div className={styles.loadModalListScroll}>
                          <div className={styles.loadModalEmpty}>
                            {loadModalEmptyMessage}
                          </div>
                        </div>
                      )}
                      {/* <div className={styles.loadModalFooter}>
                        <button
                          type='button'
                          className={styles.loadModalFooterBtn}
                          onClick={handleLoadFromBrowserOrLatest}
                        >
                          Load from this browser or latest on server
                        </button>
                      </div> */}
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
  saveStatus: PropTypes.string,
  fileInputRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  recordCount: PropTypes.number,
  onViewData: PropTypes.func,
  dashboardName: PropTypes.string,
  onDashboardNameChange: PropTypes.func,
  savedDashboards: PropTypes.array,
  recentDashboardIds: PropTypes.arrayOf(PropTypes.string),
  onLoadDashboardById: PropTypes.func,
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
};

export default DashboardToolbar;
export { ToolbarButton, ToolbarDropdown };
