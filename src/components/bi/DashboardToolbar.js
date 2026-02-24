/**
 * Power BI Lite - Dashboard Toolbar
 * Clean, professional menu bar with icons + tooltips (dashboard-style UI)
 */
import React, { useState, useRef, useEffect } from 'react';
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
  AiOutlinePicture,
  AiOutlineFilter,
} from 'react-icons/ai';
import styles from './DashboardToolbar.module.css';

const ToolbarButton = ({ icon: Icon, label, onClick, variant = 'default', disabled, title: titleProp, 'aria-label': ariaLabel }) => (
  <button
    type="button"
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
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className={styles.dropdownWrap} ref={ref}>
      <button
        type="button"
        className={styles.toolbarBtn}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Icon className={styles.toolbarIcon} aria-hidden />
        <span className={styles.toolbarLabel}>{label}</span>
        <AiOutlineDown className={`${styles.toolbarChevron} ${open ? styles.open : ''}`} aria-hidden />
      </button>
      {open && (
        <div className={styles.dropdownMenu} role="menu" onClick={() => setOpen(false)}>
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
  saveStatus,
  fileInputRef,
  recordCount,
  onViewData,
  dashboardName,
  onDashboardNameChange,
  savedDashboards,
  onLoadDashboardById,
  dashboardLogo,
  onSetLogo,
  onClearLogo,
  dataFilter,
  onDataFilterChange,
  dateFields = [],
}) => {
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadDropdownOpen, setLoadDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const loadDropdownRef = useRef(null);
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

  const dateFieldNames = dateFields.map((f) => f.name).join(',');
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
  }, [dataFilter, dateFieldNames]);

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

    return () => { cancelled = true; };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (loadDropdownRef.current && !loadDropdownRef.current.contains(e.target)) setLoadDropdownOpen(false);
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) setFilterDropdownOpen(false);
    };
    if (dropdownOpen || loadDropdownOpen || filterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen, loadDropdownOpen, filterDropdownOpen]);

  const applyFilter = () => {
    const field = filterField || dateFields[0]?.name;
    if (!field) return;
    if (filterType === 'date') {
      if (filterFrom || filterTo) {
        onDataFilterChange?.({ field, type: 'date', from: filterFrom || undefined, to: filterTo || undefined });
      } else {
        onDataFilterChange?.(null);
      }
    } else {
      if (filterValue) {
        onDataFilterChange?.({ field, type: filterType, value: filterValue.trim() });
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

  const updateDraft = (updates) => setFilterDraft((d) => ({ ...d, ...updates }));

  const handleSelectCollection = (collectionName) => {
    onCollectionChange(collectionName);
    setDropdownOpen(false);
  };

  // console.log('recordCount log by manish::', recordCount);
    
  return (
    <header className={`${styles.toolbar} bi-dashboard-toolbar`} role="banner">
      <div className={styles.toolbarLeft}>
        <h1 className={styles.toolbarTitle}>Power BI Lite</h1>
        <div className={styles.collectionWrap}>
          <label htmlFor="bi-toolbar-collection" className={styles.collectionLabel}>
            Collection
          </label>
          <div className={styles.collectionDropdownWrap} ref={dropdownRef}>
            <select
              id="bi-toolbar-collection"
              className={styles.collectionSelect}
              value={collectionInput || ''}
              onChange={(e) => onCollectionChange(e.target.value)}
              aria-label="Collection name"
            >
              <option value="">Select a collection</option>
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
          {(recordCount !== null && recordCount !== undefined) && (
            <span className={styles.recordCount}>
              ({typeof recordCount === 'number' ? recordCount.toLocaleString() : String(recordCount)} records)
            </span>
          )}
        </div>
        {onDashboardNameChange && (
          <div className={styles.dashboardNameWrap}>
            <label htmlFor="bi-toolbar-dashboard-name" className={styles.collectionLabel}>
              Dashboard name
            </label>
            <input
              id="bi-toolbar-dashboard-name"
              type="text"
              className={styles.dashboardNameInput}
              placeholder="My Dashboard"
              value={dashboardName ?? ''}
              onChange={(e) => onDashboardNameChange(e.target.value)}
              aria-label="Dashboard name for save/export"
            />
          </div>
        )}
      </div>

      <div className={styles.toolbarRight}>
        {onViewData && (
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              icon={AiOutlineTable}
              label="View"
              onClick={onViewData}
              disabled={!collectionInput?.trim()}
              title={collectionInput?.trim() ? 'View collection data as table' : 'Select or upload a collection first'}
            />
          </div>
        )}
        <div className={styles.toolbarGroup}>
          <ToolbarButton
            icon={AiOutlineCloudUpload}
            label="Upload"
            onClick={() => fileInputRef?.current?.click()}
            variant="success"
          />
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarDropdown icon={AiOutlineDownload} label="Export">
            <button
              type="button"
              className={styles.dropdownItem}
              onClick={() => { onExportJSON(); }}
              role="menuitem"
            >
              Export JSON
            </button>
            <button
              type="button"
              className={styles.dropdownItem}
              onClick={() => { onExportPDF(); }}
              role="menuitem"
            >
              Export PDF
            </button>
            {onSetLogo && (
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => { onSetLogo(); }}
                role="menuitem"
              >
                <AiOutlinePicture style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden />
                Set dashboard logo
              </button>
            )}
            {onClearLogo && dashboardLogo && (
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => { onClearLogo(); }}
                role="menuitem"
              >
                Clear logo
              </button>
            )}
          </ToolbarDropdown>
        </div>

        {dateFields.length > 0 && onDataFilterChange && (
          <div className={styles.toolbarGroup} ref={filterDropdownRef}>
            <div className={styles.dropdownWrap}>
              <button
                type="button"
                className={styles.toolbarBtn}
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                title="Filter data by date"
                aria-label="Filters"
                aria-expanded={filterDropdownOpen}
                aria-haspopup="true"
              >
                <AiOutlineFilter className={styles.toolbarIcon} aria-hidden />
                <span className={styles.toolbarLabel}>Filters</span>
                {dataFilter && <span className={styles.filterBadge} title="Active" aria-hidden>●</span>}
                <AiOutlineDown className={`${styles.toolbarChevron} ${filterDropdownOpen ? styles.open : ''}`} aria-hidden />
              </button>
              {filterDropdownOpen && (
                <div className={styles.filterDropdownMenu} role="dialog" onClick={(e) => e.stopPropagation()}>
                  <div className={styles.filterRow}>
                    <label className={styles.filterLabel}>Date field</label>
                    <select
                      className={styles.filterSelect}
                      value={filterField}
                      onChange={(e) => updateDraft({ field: e.target.value })}
                    >
                      {dateFields.map((f) => (
                        <option key={f.name} value={f.name}>{f.name}</option>
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
                      <option value="date">Date range</option>
                      <option value="month">Month</option>
                      <option value="quarter">Quarter</option>
                      <option value="year">Year</option>
                    </select>
                  </div>
                  {filterType === 'date' ? (
                    <>
                      <div className={styles.filterRow}>
                        <label className={styles.filterLabel}>From</label>
                        <input
                          type="date"
                          className={styles.filterInput}
                          value={filterFrom}
                          onChange={(e) => updateDraft({ from: e.target.value })}
                        />
                      </div>
                      <div className={styles.filterRow}>
                        <label className={styles.filterLabel}>To</label>
                        <input
                          type="date"
                          className={styles.filterInput}
                          value={filterTo}
                          onChange={(e) => updateDraft({ to: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <div className={styles.filterRow}>
                      <label className={styles.filterLabel}>
                        {filterType === 'month' ? 'Month (YYYY-MM)' : filterType === 'quarter' ? 'Quarter (e.g. 2024-Q1)' : 'Year (YYYY)'}
                      </label>
                      <input
                        type="text"
                        className={styles.filterInput}
                        placeholder={filterType === 'year' ? '2024' : filterType === 'month' ? '2024-01' : '2024-Q1'}
                        value={filterValue}
                        onChange={(e) => updateDraft({ value: e.target.value })}
                      />
                    </div>
                  )}
                  <div className={styles.filterActions}>
                    <button type="button" className={styles.filterApplyBtn} onClick={applyFilter}>Apply</button>
                    <button type="button" className={styles.filterClearBtn} onClick={clearFilter}>Clear filter</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.toolbarGroup}>
          <ToolbarButton icon={AiOutlinePrinter} label="Print" onClick={onPrint} />
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton icon={AiOutlineSave} label="Save" onClick={onSave} variant="primary" />
          {onLoadDashboardById && savedDashboards && savedDashboards.length > 0 ? (
            <div className={styles.loadDropdownWrap} ref={loadDropdownRef}>
              <button
                type="button"
                className={styles.toolbarBtn}
                onClick={() => setLoadDropdownOpen(!loadDropdownOpen)}
                title="Load a saved dashboard"
              >
                <AiOutlineFolderOpen className={styles.toolbarIcon} aria-hidden />
                <span className={styles.toolbarLabel}>Load</span>
                <AiOutlineDown className={`${styles.toolbarChevron} ${loadDropdownOpen ? styles.open : ''}`} aria-hidden />
              </button>
              {loadDropdownOpen && (
                <div className={`${styles.dropdownMenu} ${styles.loadDropdownMenu}`} role="menu">
                  {savedDashboards.map((d) => (
                    <button
                      key={d._id || d.id}
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        onLoadDashboardById(d._id || d.id);
                        setLoadDropdownOpen(false);
                      }}
                      role="menuitem"
                    >
                      {d.name || 'Unnamed'} {d.updatedAt && `(${new Date(d.updatedAt).toLocaleDateString()})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ToolbarButton icon={AiOutlineFolderOpen} label="Load" onClick={onLoad} title="Load latest from server or local" />
          )}
        </div>

        {onShare && (
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              icon={AiOutlineShareAlt}
              label="Share"
              onClick={onShare}
              disabled={!shareUrl}
              title={shareUrl ? 'Copy share link' : 'Save dashboard first to share'}
            />
          </div>
        )}

        {saveStatus && (
          <span className={styles.status} role="status" aria-live="polite">
            {saveStatus}
          </span>
        )}
      </div>

      {shareUrl && (
        <div className={styles.shareUrlWrap}>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className={styles.shareUrlInput}
            aria-label="Shareable dashboard URL"
          />
        </div>
      )}
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
  saveStatus: PropTypes.string,
  fileInputRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  recordCount: PropTypes.number,
  onViewData: PropTypes.func,
  dashboardName: PropTypes.string,
  onDashboardNameChange: PropTypes.func,
  savedDashboards: PropTypes.array,
  onLoadDashboardById: PropTypes.func,
  dashboardLogo: PropTypes.string,
  onSetLogo: PropTypes.func,
  onClearLogo: PropTypes.func,
  dataFilter: PropTypes.shape({
    field: PropTypes.string,
    type: PropTypes.oneOf(['date', 'month', 'quarter', 'year']),
    from: PropTypes.string,
    to: PropTypes.string,
    value: PropTypes.string,
  }),
  onDataFilterChange: PropTypes.func,
  dateFields: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, type: PropTypes.string })),
};

export default DashboardToolbar;
export { ToolbarButton, ToolbarDropdown };