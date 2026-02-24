/**
 * Power BI Lite - View Data Modal
 * Shows selected/uploaded collection data in table format
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AiOutlineClose } from 'react-icons/ai';
import styles from './ViewDataModal.module.css';

const ViewDataModal = ({ isOpen, onClose, collection, fields, recordCount, dataFilter }) => {
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
    const limit = typeof recordCount === 'number' && recordCount > 0 ? recordCount : 10000;
    fetch('/api/bi/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        type: 'table',
        selectedFields: fields.map((f) => f.name),
        limit,
        sortBy: 'dimension',
        sortOrder: 'asc',
        filter: dataFilter || undefined,
      }),
    })
      .then((res) => res.json())
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
          setError(err.message || 'Failed to load data');
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, collection, fields, recordCount, dataFilter]);

  if (!isOpen) return null;

  const columns = data.length > 0 ? Object.keys(data[0]) : (fields || []).map((f) => f.name);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="view-data-title">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="view-data-title">View Data — {collection || 'Collection'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
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
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx}>
                      {columns.map((col) => (
                        <td key={col}>{row[col] != null ? String(row[col]) : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <span className={styles.recordInfo}>
            {!loading && data.length > 0 && `${data.length.toLocaleString()} rows`}
          </span>
          <button type="button" className={styles.closeFooterBtn} onClick={onClose}>
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
