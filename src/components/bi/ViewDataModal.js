/**
 * Power BI Lite - View Data Modal
 * Shows selected/uploaded collection data in table format
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { AiOutlineClose } from 'react-icons/ai';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { VIEW_DATA_UI } from '@/utils/messages';
import { postBiQuery } from '@/services/biService';
import styles from './ViewDataModal.module.css';
import { PAGE_SIZE } from '@/utils/constants';

ModuleRegistry.registerModules([AllCommunityModule]);

const ViewDataModal = ({
  isOpen,
  onClose,
  collection,
  fields,
  recordCount,
  dataFilter,
}) => {
  const [pageData, setPageData] = useState([]);
  const [serverRowCount, setServerRowCount] = useState(0);
  const [globalData, setGlobalData] = useState([]);
  const [globalDataReady, setGlobalDataReady] = useState(false);
  const [globalDataLoading, setGlobalDataLoading] = useState(false);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [jumpPage, setJumpPage] = useState('1');
  const [jumpError, setJumpError] = useState('');
  const jumpEditingRef = useRef(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isGlobalSearch = debouncedSearchText.trim().length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setJumpPage('1');
    setJumpError('');
  }, [isOpen, collection, dataFilter]);

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setDebouncedSearchText('');
      return;
    }
    // Opening the modal should never restore a stale global-search state.
    setSearchText('');
    setDebouncedSearchText('');
  }, [isOpen, collection]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchText]);

  // When search changes, always reset to the first page.
  useEffect(() => {
    if (!isOpen) return;
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [isOpen, debouncedSearchText]);

  useEffect(() => {
    if (!isOpen || !collection || !fields?.length) {
      setPageData([]);
      setServerRowCount(0);
      setGlobalData([]);
      setGlobalDataReady(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    postBiQuery({
      collection,
      type: 'table',
      selectedFields: fields.map((f) => f.name),
      paginated: true,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sortBy: 'dimension',
      sortOrder: 'asc',
      filter: dataFilter || undefined,
    })
      .then((res) => res.data)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : result?.rows;
        const total =
          typeof result?.total === 'number'
            ? result.total
            : typeof recordCount === 'number'
              ? recordCount
              : 0;
        if (Array.isArray(rows)) {
          setPageData(rows);
          setServerRowCount(total);
        } else if (result?.error) {
          setError(result.error);
          setPageData([]);
          setServerRowCount(0);
        } else {
          setPageData([]);
          setServerRowCount(0);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || VIEW_DATA_UI.FAILED_TO_LOAD_DATA);
          setPageData([]);
          setServerRowCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    collection,
    fields,
    recordCount,
    dataFilter,
    pagination.pageIndex,
    pagination.pageSize,
  ]);

  useEffect(() => {
    if (!isOpen || !collection || !fields?.length) return;
    let cancelled = false;
    setGlobalDataLoading(true);
    setGlobalDataReady(false);
    postBiQuery({
      collection,
      type: 'table',
      selectedFields: fields.map((f) => f.name),
      paginated: false,
      limit: Math.max(recordCount || 1000, 1000),
      sortBy: 'dimension',
      sortOrder: 'asc',
      filter: dataFilter || undefined,
    })
      .then((res) => res.data)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : result?.rows;
        if (Array.isArray(rows)) {
          setGlobalData(rows);
          setGlobalDataReady(true);
        } else {
          setGlobalData([]);
          setGlobalDataReady(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGlobalData([]);
          setGlobalDataReady(false);
        }
      })
      .finally(() => {
        if (!cancelled) setGlobalDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, collection, fields, recordCount, dataFilter]);

  const safePageData = useMemo(
    () =>
      Array.isArray(pageData)
        ? pageData.filter(
            (row) => row && typeof row === 'object' && !Array.isArray(row)
          )
        : [],
    [pageData]
  );
  const safeGlobalData = useMemo(
    () =>
      Array.isArray(globalData)
        ? globalData.filter(
            (row) => row && typeof row === 'object' && !Array.isArray(row)
          )
        : [],
    [globalData]
  );
  const normalizedSearch = debouncedSearchText.trim().toLowerCase();
  const globalSearchIndex = useMemo(
    () =>
      safeGlobalData.map((row) =>
        Object.values(row || {})
          .map((value) => String(value ?? '').toLowerCase())
          .join(' ')
      ),
    [safeGlobalData]
  );
  const filteredGlobalData = useMemo(() => {
    if (!normalizedSearch) return safeGlobalData;
    if (!globalDataReady) return [];
    const rows = [];
    for (let i = 0; i < safeGlobalData.length; i += 1) {
      if (globalSearchIndex[i]?.includes(normalizedSearch)) {
        rows.push(safeGlobalData[i]);
      }
    }
    return rows;
  }, [safeGlobalData, globalSearchIndex, normalizedSearch, globalDataReady]);

  // Paginate client-side results for global search to keep UX consistent.
  const activeRowCount = isGlobalSearch
    ? filteredGlobalData.length
    : serverRowCount;
  const totalPages = Math.max(
    1,
    Math.ceil((activeRowCount || 0) / pagination.pageSize)
  );
  const currentPage = pagination.pageIndex + 1;
  const canPrev = pagination.pageIndex > 0;
  const canNext = currentPage < totalPages;

  const activeData = useMemo(() => {
    if (!isGlobalSearch) return safePageData;
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredGlobalData.slice(start, end);
  }, [
    isGlobalSearch,
    filteredGlobalData,
    pagination.pageIndex,
    pagination.pageSize,
    safePageData,
  ]);

  // AG Grid requires stable unique row IDs. When `_id` isn't present in the row,
  // relying on rowIndex/node can collapse multiple rows into a single rendered row.
  const gridRowData = useMemo(() => {
    return (Array.isArray(activeData) ? activeData : []).map((row, idx) => ({
      ...row,
      __rowId: `p${pagination.pageIndex}-i${idx}`,
    }));
  }, [activeData, pagination.pageIndex]);
  const columnKeys = useMemo(() => {
    if (activeData.length > 0) {
      return Object.keys(activeData[0] || {});
    }
    return (fields || [])
      .map((f) => f?.name)
      .filter((name) => typeof name === 'string' && name.trim() !== '');
  }, [activeData, fields]);
  const numericColumns = useMemo(() => {
    const typedNumeric = new Set(
      (fields || [])
        .filter((f) => f?.type === 'number' && typeof f?.name === 'string')
        .map((f) => f.name)
    );
    if (activeData.length === 0) return typedNumeric;
    columnKeys.forEach((key) => {
      const hasValue = activeData.some(
        (row) => row?.[key] !== null && row?.[key] !== ''
      );
      if (!hasValue) return;
      const isNumeric = activeData.every((row) => {
        const value = row?.[key];
        if (value === null || value === undefined || value === '') return true;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'string') return Number.isFinite(Number(value));
        return false;
      });
      if (isNumeric) typedNumeric.add(key);
    });
    return typedNumeric;
  }, [fields, activeData, columnKeys]);
  const agColumns = useMemo(
    () =>
      columnKeys.map((key) => ({
        field: key,
        headerName: key,
        minWidth: 140,
        flex: 1,
        type: numericColumns.has(key) ? 'numericColumn' : undefined,
        headerClass: numericColumns.has(key)
          ? styles.numericHeader
          : styles.textHeader,
        cellClass: numericColumns.has(key)
          ? styles.numericCell
          : styles.textCell,
        tooltipValueGetter: (params) => {
          const value = params?.value;
          if (value === null || value === undefined || value === '') return '—';
          return String(value);
        },
        valueFormatter: numericColumns.has(key)
          ? (params) => {
              const value = params?.value;
              if (value === null || value === undefined || value === '')
                return '—';
              const num = Number(value);
              if (!Number.isFinite(num)) return String(value);
              return num.toLocaleString();
            }
          : undefined,
      })),
    [columnKeys, numericColumns]
  );
  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true,
      minWidth: 130,
      flex: 1,
      suppressHeaderMenuButton: true,
    }),
    []
  );

  // Keep the jump input synced with current page unless user is typing.
  // IMPORTANT: must be above any early returns to keep hook ordering stable.
  useEffect(() => {
    if (!isOpen) return;
    if (jumpEditingRef.current) return;
    setJumpError('');
    setJumpPage(String(currentPage));
  }, [isOpen, currentPage]);

  if (!isOpen) return null;

  const canRenderGrid = !error && columnKeys.length > 0 && fields?.length;

  const sanitizePageInput = (raw) => String(raw ?? '').replace(/[^\d]/g, '');

  const clampPage = (n) => {
    if (!Number.isFinite(n) || n <= 0) return 1;
    if (n > totalPages) return totalPages;
    return n;
  };

  const validatePage = (rawValue) => {
    const raw = String(rawValue ?? '').trim();
    if (!raw) return 'Enter page number';
    if (!/^\d+$/.test(raw)) return 'Only positive integers are allowed';
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return 'Page must be at least 1';
    return '';
  };

  const navigateToPage = (rawValue) => {
    if (loading) return;
    const err = validatePage(rawValue);
    if (err) {
      setJumpError(err);
      return;
    }
    setJumpError('');
    const n = clampPage(parseInt(String(rawValue).trim(), 10));
    setJumpPage(String(n));
    setPagination((prev) => ({ ...prev, pageIndex: n - 1 }));
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role='dialog'
      aria-modal='true'
      aria-labelledby='view-data-title'
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <h2 id='view-data-title'>
              View Data — {collection || 'Collection'}
            </h2>
            <div className={styles.headerMeta}>
              {/* <span className={styles.metaBadge}>Server-side paging</span> */}
              <span className={styles.metaBadge}>
                {columnKeys.length} columns
              </span>
            </div>
          </div>
          <button
            type='button'
            className={styles.closeBtn}
            onClick={onClose}
            aria-label='Close'
          >
            <AiOutlineClose />
          </button>
        </div>
        <div className={styles.body}>
          {loading && !isGlobalSearch && (
            <div className={`${styles.loading} ${styles.stateCard}`}>
              <span className={styles.loaderDot} />
              Loading data...
            </div>
          )}
          {isGlobalSearch && globalDataLoading && (
            <div className={`${styles.loading} ${styles.stateCard}`}>
              <span className={styles.loaderDot} />
              Preparing global search index...
            </div>
          )}
          {error && (
            <div className={`${styles.error} ${styles.stateCard}`}>{error}</div>
          )}
          {canRenderGrid && (
            <div className={styles.tableWrap}>
              <div className={styles.toolbar}>
                <input
                  type='text'
                  className={styles.searchInput}
                  placeholder='Global search across all rows...'
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <button
                  type='button'
                  className={styles.ghostBtn}
                  onClick={() => setSearchText('')}
                  disabled={!searchText}
                >
                  Clear Search
                </button>
              </div>

              {!loading && !globalDataLoading && activeData.length === 0 && (
                <div className={`${styles.empty} ${styles.stateCard}`}>
                  {isGlobalSearch
                    ? 'No rows match your search. Clear search to see data.'
                    : 'No rows to display.'}
                </div>
              )}

              <div
                className={`${styles.tableScroller} ag-theme-alpine ${styles.agGridTheme}`}
              >
                <AgGridReact
                  style={{ width: '100%', height: '100%' }}
                  rowData={gridRowData}
                  columnDefs={agColumns}
                  defaultColDef={defaultColDef}
                  domLayout='normal'
                  enableBrowserTooltips
                  tooltipShowDelay={200}
                  getRowId={(params) =>
                    String(params?.data?.__rowId || params?.data?._id || '')
                  }
                  suppressColumnVirtualisation={false}
                  suppressRowVirtualisation={false}
                  rowBuffer={10}
                  enableCellTextSelection
                  animateRows
                />
              </div>
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <span className={styles.recordInfo}>
            {!loading &&
              activeRowCount > 0 &&
              `${activeRowCount.toLocaleString()} rows${isGlobalSearch ? ' (matching search)' : ''} • page ${currentPage}/${totalPages} • ${activeData.length.toLocaleString()} loaded`}
          </span>
          <div className={styles.paginationControls}>
            <span className={styles.pagePill}>
              {currentPage}/{totalPages}
            </span>
            <button
              type='button'
              className={styles.secondaryBtn}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: Math.max(0, prev.pageIndex - 1),
                }))
              }
              disabled={!canPrev || loading}
            >
              Prev
            </button>
            <div className={styles.jumpWrap}>
              <input
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                className={`${styles.jumpInput} ${jumpError ? styles.jumpInputError : ''}`}
                placeholder='Enter page'
                value={jumpPage}
                onFocus={() => {
                  jumpEditingRef.current = true;
                }}
                onChange={(e) => {
                  const cleaned = sanitizePageInput(e.target.value);
                  setJumpPage(cleaned);
                  if (jumpError) setJumpError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigateToPage(jumpPage);
                    jumpEditingRef.current = false;
                  }
                }}
                onBlur={() => {
                  const raw = String(jumpPage ?? '').trim();
                  jumpEditingRef.current = false;
                  if (!raw) {
                    setJumpError('');
                    setJumpPage(String(currentPage));
                    return;
                  }
                  navigateToPage(raw);
                }}
                disabled={loading || totalPages <= 1}
                aria-label='Jump to page'
              />

              {jumpError ? (
                <span className={styles.jumpError} role='alert'>
                  {jumpError}
                </span>
              ) : null}
            </div>
            <button
              type='button'
              className={styles.secondaryBtn}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: prev.pageIndex + 1,
                }))
              }
              disabled={!canNext || loading}
            >
              Next
            </button>

            <select
              className={styles.pageSizeSelect}
              value={pagination.pageSize}
              onChange={(e) =>
                setPagination({
                  pageIndex: 0,
                  pageSize: Number(e.target.value) || pagination.pageSize,
                })
              }
              disabled={loading}
            >
              {[25, 50, 100, 250].map((size) => (
                <option key={size} value={size}>
                  {size}/page
                </option>
              ))}
            </select>
          </div>
          <button
            type='button'
            className={styles.closeFooterBtn}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

ViewDataModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  collection: PropTypes.string,
  fields: PropTypes.array,
  recordCount: PropTypes.number,
  dataFilter: PropTypes.shape({
    field: PropTypes.string,
    type: PropTypes.string,
    from: PropTypes.string,
    to: PropTypes.string,
    value: PropTypes.string,
  }),
};

export default ViewDataModal;
