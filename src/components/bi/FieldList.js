/**
 * Power BI Lite - Field List (Left Sidebar)
 * Displays discovered fields from schema
 */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const FieldList = ({ collection, onAddChart, onFieldsLoaded }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!collection) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/bi/schema?collection=${encodeURIComponent(collection)}`)
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          await res.text(); // Consume response
          throw new Error(`Server returned ${res.status}: ${res.statusText}. Collection may not exist.`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          // Legacy format: just array of fields (no recordCount)
          setFields(data);
          if (onFieldsLoaded) onFieldsLoaded({ fields: data, recordCount: null });
        } else if (data?.fields || data?.schema) {
          // New format: object with fields and recordCount
          const fieldsData = data.fields || data.schema || [];
          setFields(fieldsData);
          if (onFieldsLoaded) {
            onFieldsLoaded({ 
              fields: fieldsData, 
              recordCount: data.recordCount !== undefined ? data.recordCount : null 
            });
          }
        } else if (data?.error) {
          setError(data.error);
          setFields([]);
          if (onFieldsLoaded) onFieldsLoaded({ fields: [] });
        } else {
          setFields([]);
          if (onFieldsLoaded) onFieldsLoaded({ fields: [] });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const errorMsg = err.message || 'Failed to load schema';
          setError(errorMsg.includes('JSON') ? 'Collection not found or server error' : errorMsg);
          setFields([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [collection, onFieldsLoaded]);

  const handleAddChart = (dimension, measureField, measureOp) => {
    if (onAddChart) {
      onAddChart({ dimension, measureField, measureOp });
    }
  };

  const stringFields = fields.filter((f) => f.type === 'string');
  const numberFields = fields.filter((f) => f.type === 'number');

  const defaultDimension = stringFields[0]?.name || 'gender';
  const defaultMeasure = numberFields[0]?.name || 'id';

  return (
    <div className="bi-field-list">
      <div className="bi-field-list-header">
        <h3>Fields</h3>
  
        {/* 🔹 Move Add Chart button to top for better UX */}
        {!loading && !error && fields.length > 0 && (
          <button
            type="button"
            className="bi-add-chart-btn"
            onClick={() =>
              handleAddChart(defaultDimension, defaultMeasure, 'COUNT')
            }
          >
            + Add Chart
          </button>
        )}
      </div>
  
      <div className="bi-field-list-body">
        {loading && <div className="bi-field-loading">Loading fields...</div>}
        {error && <div className="bi-field-error">{error}</div>}
        {!loading && !error && fields.length === 0 && (
          <div className="bi-field-empty">No fields found</div>
        )}
        {!loading && !error && fields.length > 0 && (
          <>
            <div className="bi-field-group">
              <div className="bi-field-group-title">Dimensions (group by)</div>
              {stringFields.map((f) => (
                <div key={f.name} className="bi-field-item">
                  {f.name}
                </div>
              ))}
            </div>
  
            <div className="bi-field-group">
              <div className="bi-field-group-title">Measures (aggregate)</div>
              {numberFields.map((f) => (
                <div key={f.name} className="bi-field-item">
                  {f.name} (number)
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
  
};

FieldList.propTypes = {
  collection: PropTypes.string,
  onAddChart: PropTypes.func,
  onFieldsLoaded: PropTypes.func,
};

export default FieldList;
