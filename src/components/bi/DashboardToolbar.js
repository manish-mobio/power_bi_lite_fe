/**
 * Power BI Lite - Dashboard Toolbar
 * Clean, professional menu bar with icons + tooltips (dashboard-style UI)
 */
import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  AiOutlineCloudUpload,
  AiOutlineDownload,
  AiOutlinePrinter,
  AiOutlineSave,
  AiOutlineFolderOpen,
  AiOutlineShareAlt,
  AiOutlineDown,
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
}) => {
    console.log('recordCount log by manish::', recordCount);
    
  return (
    <header className={`${styles.toolbar} bi-dashboard-toolbar`} role="banner">
      <div className={styles.toolbarLeft}>
        <h1 className={styles.toolbarTitle}>Power BI Lite</h1>
        <div className={styles.collectionWrap}>
          <label htmlFor="bi-toolbar-collection" className={styles.collectionLabel}>
            Collection
          </label>
          <input
            id="bi-toolbar-collection"
            type="text"
            className={styles.collectionInput}
            value={collectionInput}
            onChange={(e) => onCollectionChange(e.target.value)}
            placeholder="e.g. users"
            aria-label="Collection name"
          />
          {recordCount !== null && recordCount !== undefined && (
            <span className={styles.recordCount}>
              ({typeof recordCount === 'number' ? recordCount.toLocaleString() : recordCount} records)
            </span>
          )}
        </div>
      </div>

      <div className={styles.toolbarRight}>
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
          </ToolbarDropdown>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton icon={AiOutlinePrinter} label="Print" onClick={onPrint} />
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton icon={AiOutlineSave} label="Save" onClick={onSave} variant="primary" />
          <ToolbarButton icon={AiOutlineFolderOpen} label="Load" onClick={onLoad} />
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
};

export default DashboardToolbar;
export { ToolbarButton, ToolbarDropdown };