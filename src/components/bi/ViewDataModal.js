/**
 * Power BI Lite - View Data Modal
 * Shows selected/uploaded collection data in table format
 */
import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { AiOutlineClose } from 'react-icons/ai';
import { MaterialReactTable } from 'material-react-table';
import { VIEW_DATA_UI } from '@/utils/messages';
import { postBiQuery } from '@/services/biService';
import styles from './ViewDataModal.module.css';

const ViewDataModal = ({
  isOpen,
  onClose,
  collection,
  fields,
  recordCount,
  dataFilter,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !collection || !fields?.length) {
      setData([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const limit =
      typeof recordCount === 'number' && recordCount > 0 ? recordCount : 10000;
    postBiQuery({
      collection,
      type: 'table',
      selectedFields: fields.map((f) => f.name),
      limit,
      sortBy: 'dimension',
      sortOrder: 'asc',
      filter: dataFilter || undefined,
    })
      .then((res) => res.data)
      .then((result) => {
        if (cancelled) return;
        if (Array.isArray(result)) {
          setData(result);
        } else if (result?.error) {
          setError(result.error);
          setData([]);
        } else {
          setData([]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || VIEW_DATA_UI.FAILED_TO_LOAD_DATA);
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, collection, fields, recordCount, dataFilter]);
  const columnKeys =
    data.length > 0 ? Object.keys(data[0]) : (fields || []).map((f) => f.name);
  const mrtColumns = useMemo(
    () =>
      columnKeys.map((key) => ({
        accessorKey: key,
        header: key,
      })),
    [columnKeys]
  );

  if (!isOpen) return null;

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
          <h2 id='view-data-title'>View Data — {collection || 'Collection'}</h2>
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
          {loading && <div className={styles.loading}>Loading data…</div>}
          {error && <div className={styles.error}>{error}</div>}
          {!loading && !error && data.length === 0 && (
            <div className={styles.empty}>No rows to display.</div>
          )}
          {!loading && !error && data.length > 0 && (
            <div className={styles.tableWrap}>
              <MaterialReactTable
                columns={mrtColumns}
                data={data}
                enableColumnFilters
                enableSorting
                enableGlobalFilter
                enablePagination
                initialState={{
                  pagination: { pageIndex: 0, pageSize: 50 }, // 👈 default 50 rows
                }}
                enableStickyHeader
                enableRowVirtualization
                muiTableBodyProps={{ sx: { fontSize: 12 } }}
                muiBottomToolbarProps={{
                  sx: {
                    flex: '0 0 auto',
                    borderTop: '1px solid #e5e7eb',
                  },
                }}
                muiTablePaperProps={{
                  sx: {
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: 'none',
                    border: 'none',
                  },
                }}
                muiTableContainerProps={{
                  sx: {
                    flex: '1 1 auto',
                    minHeight: 0,
                    overflow: 'auto',
                  },
                }}
              />
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <span className={styles.recordInfo}>
            {!loading &&
              data.length > 0 &&
              `${data.length.toLocaleString()} rows`}
          </span>
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
