/**
 * Power BI Lite - Main Dashboard (3-column layout)
 * Left: Field List | Middle: Chart Canvas | Right: Config Panel
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from '@/store/reducers/dashboardReducer';
import FieldList from './FieldList';
import ChartCanvas from './ChartCanvas';
import ConfigPanel from './ConfigPanel';
import ViewDataModal from './ViewDataModal';
// import Copilot from './Copilot';
const { jsPDF } = await import('jspdf');
const { html2canvas } = await import('html2canvas');
import styles from './BiDashboard.module.css';
import DashboardToolbar from './DashboardToolbar';

const STORAGE_KEY = 'powerbi-dashboard';

function buildLayoutsAndChartsFromSaved(dashboard) {
  const cfg = dashboard?.charts ?? [];
  if (!Array.isArray(cfg) || cfg.length === 0) {
    return { chartsWithIds: [], validLayouts: {}, collection: '' };
  }
  const chartIds = cfg.map((c) => c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const validLayouts = {};
  if (dashboard?.layouts?.lg && Array.isArray(dashboard.layouts.lg)) {
    const savedLg = dashboard.layouts.lg;
    const hasValidSaved = savedLg.length === chartIds.length && chartIds.every((id) => savedLg.some((item) => item.i === id));
    if (hasValidSaved) {
      validLayouts.lg = savedLg;
      validLayouts.md = dashboard.layouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
      validLayouts.sm = dashboard.layouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
    } else {
      const items = chartIds.map((id, idx) => ({ i: id, x: (idx % 2) * 6, y: Math.floor(idx / 2) * 2, w: 6, h: 2 }));
      validLayouts.lg = items;
      validLayouts.md = items.map((l) => ({ ...l, w: 5 }));
      validLayouts.sm = items.map((l) => ({ ...l, w: 6 }));
    }
  } else {
    const items = chartIds.map((id, idx) => ({ i: id, x: (idx % 2) * 6, y: Math.floor(idx / 2) * 2, w: 6, h: 2 }));
    validLayouts.lg = items;
    validLayouts.md = items.map((l) => ({ ...l, w: 5 }));
    validLayouts.sm = items.map((l) => ({ ...l, w: 6 }));
  }
  const chartsWithIds = cfg.map((c, idx) => ({ ...c, id: c.id || chartIds[idx] }));
  const collection = (chartsWithIds[0] && chartsWithIds[0].collection) || dashboard?.collection || '';
  return { chartsWithIds, validLayouts, collection };
}

/** Strip sort indicator from table header text so PDF shows only column name (e.g. "State Code ▲" → "State Code") */
function cleanPdfHeaderLabel(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/\s*[▲▼↑↓↗↘%²]\s*$/g, '')
    .replace(/\s+[^\w\s]+$/g, '')
    .trim() || str.trim();
}

const BiDashboard = () => {
  const dispatch = useDispatch();
  const { collection, charts, selectedChartId, layouts } = useSelector((state) => state.dashboard);
  const [fields, setFields] = useState([]);
  const [recordCount, setRecordCount] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [collectionInput, setCollectionInput] = useState(collection);
  const [shareUrl, setShareUrl] = useState('');
  const [chartToDeleteId, setChartToDeleteId] = useState(null);
  const [exportPdfInProgress, setExportPdfInProgress] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);
  const [viewDataOpen, setViewDataOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [savedDashboards, setSavedDashboards] = useState([]);
  const [dashboardLogo, setDashboardLogo] = useState(null); // base64 data URL for dashboard logo
  const [dataFilter, setDataFilter] = useState(null); // { field, type: 'date'|'month'|'quarter'|'year', from?, to?, value? }

  // const [copilotOpen, setCopilotOpen] = useState(false);
  const debounceTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const selectedChart = charts.find((c) => c.id === selectedChartId);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bi/dashboards')
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled) setSavedDashboards(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (!cancelled) setSavedDashboards([]); });
    return () => { cancelled = true; };
  }, []);

  // Sync collectionInput with collection from store
  useEffect(() => {
    setCollectionInput(collection);
  }, [collection]);

  // Debounced collection update
  const handleCollectionChange = useCallback((value) => {
    setCollectionInput(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      dispatch(setCollection(value));
    }, 500);
  }, [dispatch]);

  const handleFieldsLoaded = useCallback((data) => {
    if (Array.isArray(data)) {
      // Legacy format: just array of fields
      setFields(data || []);
      setRecordCount(null);
    } else if (data && typeof data === 'object') {
      // New format: object with fields and recordCount
      setFields(data.fields || data.schema || []);
      setRecordCount(data.recordCount !== undefined && data.recordCount !== null ? data.recordCount : null);
    } else {
      setFields([]);
      setRecordCount(null);
    }
  }, []);
  // File upload handler - uploads data to backend and creates collection
  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isJSON = fileName.endsWith('.json');
    const isCSV = fileName.endsWith('.csv');

    if (!isJSON && !isCSV) {
      setSaveStatus('Invalid file format. Please upload JSON or CSV file.');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    setSaveStatus('Uploading and parsing file...');

    try {
      const text = await file.text();

      // Check if it's a dashboard config file (has charts array)
      try {
        const parsedData = JSON.parse(text);
        if (parsedData?.charts && Array.isArray(parsedData.charts)) {
          // It's a dashboard config file, load it directly
          const loadedCharts = parsedData.charts;
          const loadedLayouts = parsedData.layouts || {};

          // Generate proper layouts if not provided or invalid
          const chartIds = loadedCharts.map((c) => c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
          const validLayouts = {};

          if (loadedLayouts?.lg && Array.isArray(loadedLayouts.lg)) {
            const savedLg = loadedLayouts.lg;
            const hasValidSaved = savedLg.length === chartIds.length &&
              chartIds.every((id) => savedLg.some((item) => item.i === id));

            if (hasValidSaved) {
              validLayouts.lg = savedLg;
              validLayouts.md = loadedLayouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
              validLayouts.sm = loadedLayouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
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

          const chartsWithIds = loadedCharts.map((c, idx) => ({
            ...c,
            id: c.id || chartIds[idx],
          }));

          dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts }));
          if (parsedData.logo != null && typeof parsedData.logo === 'string') {
            setDashboardLogo(parsedData.logo);
          } else {
            setDashboardLogo(null);
          }
          if (parsedData.name) setDashboardName(parsedData.name);
          setSaveStatus('Dashboard loaded successfully');
          setTimeout(() => setSaveStatus(''), 2000);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      } catch {
        // Not a dashboard config, continue with data upload
      }

      // Upload data file to backend for parsing and storage
      console.log('upload file log by manish::bi dashboards');

      const response = await fetch('/api/bi/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileContent: text,
          fileType: isJSON ? 'json' : 'csv',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        setSaveStatus(errorData.error || 'Upload failed');
        setTimeout(() => setSaveStatus(''), 3000);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      const result = await response.json();

      // Successfully uploaded - switch to the new collection
      if (result.collection) {
        // Set fields immediately from upload response (faster than waiting for FieldList fetch)
        if (result.schema && Array.isArray(result.schema) && result.schema.length > 0) {
          handleFieldsLoaded({ fields: result.schema, recordCount: result.recordCount });
        } else if (result.recordCount !== undefined && result.recordCount !== null) {
          setRecordCount(result.recordCount);
        }

        // Set collection in Redux - this will trigger FieldList to fetch schema (as backup/refresh)
        dispatch(setCollection(result.collection));

        // Show appropriate message based on whether it was replaced or new
        const statusMsg = result.replaced
          ? `Replaced "${result.collection}" with ${result.recordCount || 0} records`
          : `Uploaded ${result.recordCount || 0} records to "${result.collection}"`;

        setSaveStatus(statusMsg);
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Upload successful, but collection name not returned');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (error) {
      setSaveStatus(`Error uploading file: ${error.message}`);
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [dispatch, handleFieldsLoaded]);

  const handleAddChart = useCallback(
    ({ dimension, measureField, measureOp }) => {
      // Prevent adding chart if no collection is selected
      if (!collection || !collection.trim()) {
        setSaveStatus('Please select a collection first');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      dispatch(
        addChart({
          collection: collection.trim(),
          dimension,
          measure: { field: measureField, op: measureOp || 'COUNT' },
          type: 'bar',
          limit: typeof recordCount === 'number' && recordCount > 0 ? recordCount : 10,
        })
      );
    },
    [dispatch, collection, recordCount]
  );

  const handleUpdateChart = useCallback(
    (id, updates) => {
      dispatch(updateChart({ id, updates }));
    },
    [dispatch]
  );

  const handleRemoveChart = useCallback(
    (id) => {
      dispatch(removeChart(id));
    },
    [dispatch]
  );

  const handleRequestRemoveChart = useCallback((id) => {
    setChartToDeleteId(id);
  }, []);

  const handleConfirmRemoveChart = useCallback(() => {
    if (chartToDeleteId) {
      dispatch(removeChart(chartToDeleteId));
      setChartToDeleteId(null);
    }
  }, [chartToDeleteId, dispatch]);

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
      dispatch(duplicateChart(chart));
    },
    [dispatch]
  );

  const handleRefreshChart = useCallback(
    (id) => {
      // Force re-render by updating the chart (triggers useEffect in SmartChart)
      dispatch(updateChart({ id, updates: { refreshedAt: Date.now() } }));
    },
    [dispatch]
  );

  const handleSelectChart = useCallback(
    (id) => {
      dispatch(setSelectedChart(id));
    },
    [dispatch]
  );



  const handleSaveDashboard = useCallback(async () => {
    setSaveStatus('Saving...');
    setShareUrl('');
    const name = (dashboardName && dashboardName.trim()) || 'My Dashboard';
    try {
      const res = await fetch('/api/bi/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          charts,
          layouts,
          logo: dashboardLogo || undefined,
        }),
      });
      if (res.ok) {
        try {
          const json = await res.json();
          const id = json?.id || json?._id;
          if (id) {
            if (json.name) setDashboardName(json.name);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts, collection, dashboardName: name, logo: dashboardLogo || undefined }));
            setSaveStatus('Saved');
            const base = typeof window !== 'undefined' ? window.location.origin : '';
            setShareUrl(`${base}/dashboard/${id}`);
            fetch('/api/bi/dashboards').then((r) => r.json()).then((list) => setSavedDashboards(Array.isArray(list) ? list : []));
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts, collection, logo: dashboardLogo || undefined }));
            setSaveStatus('Saved (local)');
          }
        } catch {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts, collection, logo: dashboardLogo || undefined }));
          setSaveStatus('Saved (local)');
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts, collection, logo: dashboardLogo || undefined }));
        setSaveStatus('Saved (local)');
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts, collection, logo: dashboardLogo || undefined }));
      setSaveStatus('Saved (local)');
    }
    setTimeout(() => setSaveStatus(''), 2000);
  }, [charts, layouts, collection, dashboardName, dashboardLogo]);

  const handleShare = useCallback(() => {
    if (shareUrl && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl);
      setSaveStatus('Link copied to clipboard');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [shareUrl]);

  const handleLoadDashboard = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const { charts: savedCharts, layouts: savedLayouts, collection: savedCollection } = parsed;
        if (savedCharts?.length) {
          // Generate proper layouts if not provided or invalid
          const chartIds = savedCharts.map((c) => c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
          const validLayouts = {};

          if (savedLayouts?.lg && Array.isArray(savedLayouts.lg)) {
            const savedLg = savedLayouts.lg;
            const hasValidSaved = savedLg.length === chartIds.length &&
              chartIds.every((id) => savedLg.some((item) => item.i === id));

            if (hasValidSaved) {
              validLayouts.lg = savedLg;
              validLayouts.md = savedLayouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
              validLayouts.sm = savedLayouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
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

          // Ensure all charts have IDs
          const chartsWithIds = savedCharts.map((c, idx) => ({
            ...c,
            id: c.id || chartIds[idx],
          }));

          const loadedCollection = savedCollection || (savedCharts[0] && savedCharts[0].collection) || collection;
          dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts, collection: loadedCollection }));
          setCollectionInput(loadedCollection);
          if (parsed.dashboardName != null) setDashboardName(parsed.dashboardName);
          if (parsed.logo != null && typeof parsed.logo === 'string') setDashboardLogo(parsed.logo);
          else setDashboardLogo(null);
          setSaveStatus('Loaded');
          setTimeout(() => setSaveStatus(''), 2000);
        }
      } catch {
        setSaveStatus('Load failed');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } else {
      fetch('/api/bi/dashboards')
        .then((res) => res.json())
        .then((list) => {
          if (list?.length) {
            const latest = list[list.length - 1];
            const cfg = latest?.charts ?? latest;
            if (Array.isArray(cfg) && cfg.length) {
              // Generate proper layouts
              const chartIds = cfg.map((c) => c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
              const validLayouts = {};

              if (latest?.layouts?.lg && Array.isArray(latest.layouts.lg)) {
                const savedLg = latest.layouts.lg;
                const hasValidSaved = savedLg.length === chartIds.length &&
                  chartIds.every((id) => savedLg.some((item) => item.i === id));

                if (hasValidSaved) {
                  validLayouts.lg = savedLg;
                  validLayouts.md = latest.layouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
                  validLayouts.sm = latest.layouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
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

              const chartsWithIds = cfg.map((c, idx) => ({
                ...c,
                id: c.id || chartIds[idx],
              }));

              const loadedCollection = (chartsWithIds[0] && chartsWithIds[0].collection) || (latest && latest.collection) || collection;
              dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts, collection: loadedCollection }));
              setCollectionInput(loadedCollection);
              setSaveStatus('Loaded from server');
            } else {
              setSaveStatus('No saved dashboard');
            }
          } else {
            setSaveStatus('No saved dashboard');
          }
          setTimeout(() => setSaveStatus(''), 2000);
        })
        .catch(() => {
          setSaveStatus('Load failed');
          setTimeout(() => setSaveStatus(''), 2000);
        });
    }
  }, [dispatch]);

  const handleLoadDashboardById = useCallback((id) => {
    if (!id) return;
    setSaveStatus('Loading...');
    fetch(`/api/bi/dashboards/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setSaveStatus('Dashboard not found');
          setTimeout(() => setSaveStatus(''), 2000);
          return null;
        }
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data == null) return;
        const { chartsWithIds, validLayouts, collection: loadedCollection } = buildLayoutsAndChartsFromSaved(data);
        if (chartsWithIds.length === 0) {
          setSaveStatus('No charts in this dashboard');
          setTimeout(() => setSaveStatus(''), 2000);
          return;
        }
        dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts, collection: loadedCollection }));
        setCollectionInput(loadedCollection);
        if (data.name) setDashboardName(data.name);
        if (data.logo != null && typeof data.logo === 'string') setDashboardLogo(data.logo);
        else setDashboardLogo(null);
        setSaveStatus('Loaded');
        setTimeout(() => setSaveStatus(''), 2000);
      })
      .catch((err) => {
        setSaveStatus(err.message || 'Load failed');
        setTimeout(() => setSaveStatus(''), 2000);
      });
  }, [dispatch]);


  const handlePrintDashboard = useCallback(async () => {
    setSaveStatus('Preparing print...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      // Capture only the charts area (exclude zoom controls)
      const printArea = document.querySelector('.bi-playground-content');
      if (!printArea) {
        setSaveStatus('Canvas not found');
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
        setSaveStatus('Popup blocked — allow popups and try again');
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
      setSaveStatus('Print dialog opened');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Print failed', error);
      setSaveStatus('Print failed');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, []);


  // Download JSON config

  // const handlePrintDashboard = useCallback(async () => {
  //   setSaveStatus('Preparing print...');

  //   try {
  //     const { jsPDF }   = await import('jspdf');
  //     const autoTable   = (await import('jspdf-autotable')).default;
  //     const html2canvas = (await import('html2canvas')).default;

  //     const target = document.querySelector('.bi-playground-content');
  //     if (!target) throw new Error('Export area not found');

  //     // ── Detect content types (identical to handleDownloadPDF) ──────────────
  //     const hasCanvas   = target.querySelector('canvas') !== null;
  //     const hasTable    = target.querySelector('table')  !== null;
  //     const isOnlyTable = hasTable && !hasCanvas;
  //     const hasCharts   = hasCanvas;

  //     // ── Shared: trigger print dialog from PDF (replaces pdf.save) ──────────
  //     const triggerPrint = (pdf) => {
  //       pdf.autoPrint(); // ✅ tells browser to open print dialog automatically
  //       const dataUri = pdf.output('datauristring');
  //       const iframe  = document.createElement('iframe');
  //       iframe.style.position = 'fixed';
  //       iframe.style.width    = '0';
  //       iframe.style.height   = '0';
  //       iframe.style.border   = 'none';
  //       iframe.style.opacity  = '0';
  //       iframe.src = dataUri;
  //       document.body.appendChild(iframe);
  //       // Remove iframe after print dialog closes
  //       iframe.onload = () => {
  //         setTimeout(() => document.body.removeChild(iframe), 30000);
  //       };
  //     };

  //     // ══════════════════════════════════════════════════════════════
  //     // MODE 1 — PURE TABLE ONLY → jspdf-autotable → print
  //     // Identical to handleDownloadPDF MODE 1
  //     // ══════════════════════════════════════════════════════════════
  //     if (isOnlyTable) {
  //       const tableEl    = target.querySelector('table');
  //       const theadCells = Array.from(
  //         tableEl.querySelectorAll('thead tr:first-child th, thead tr:first-child td')
  //       );

  //       const SKIP_HEADERS = [
  //         'createdat','updatedat','created_at','updated_at',
  //         '__v','_v','password','token','refreshtoken',
  //       ];

  //       const allColumns = theadCells.map((th, idx) => ({
  //         idx,
  //         label: th.innerText?.trim() || th.textContent?.trim() || '',
  //       }));
  //       const columns = allColumns.filter(
  //         (col) => !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
  //       );

  //       const tbodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
  //       const rows = tbodyRows.map((tr) => {
  //         const cells = Array.from(tr.querySelectorAll('td, th'));
  //         return columns.map((col) => {
  //           const cell = cells[col.idx];
  //           return cell ? (cell.innerText?.trim() || cell.textContent?.trim() || '') : '';
  //         });
  //       });
  //       const filteredRows = rows.filter((row) => row.some((c) => c !== ''));
  //       if (filteredRows.length === 0) throw new Error('No table data found');

  //       const orientation = columns.length > 6 ? 'landscape' : 'portrait';
  //       const pdf        = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
  //       const pageWidth  = pdf.internal.pageSize.getWidth();
  //       const pageHeight = pdf.internal.pageSize.getHeight();
  //       const margin     = 12;

  //       pdf.setFillColor(15, 108, 189);
  //       pdf.rect(0, 0, pageWidth, 18, 'F');
  //       pdf.setFontSize(11);
  //       pdf.setFont('helvetica', 'bold');
  //       pdf.setTextColor(255, 255, 255);
  //       pdf.text('Dashboard Export', margin, 12);
  //       pdf.setFontSize(8);
  //       pdf.setFont('helvetica', 'normal');
  //       pdf.setTextColor(200, 225, 255);
  //       pdf.text(
  //         `${filteredRows.length.toLocaleString()} records  •  ${new Date().toLocaleString()}`,
  //         pageWidth - margin, 12, { align: 'right' }
  //       );

  //       autoTable(pdf, {
  //         head: [columns.map((col) => col.label)],
  //         body: filteredRows,
  //         startY: 22,
  //         showHead: 'everyPage',
  //         tableWidth: pageWidth - margin * 2,
  //         styles: {
  //           fontSize: 8.5,
  //           cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
  //           font: 'helvetica',
  //           textColor: [32, 31, 30],
  //           lineColor: [218, 218, 218],
  //           lineWidth: 0.15,
  //           overflow: 'ellipsize',
  //           minCellHeight: 8,
  //         },
  //         headStyles: {
  //           fillColor: [32, 31, 30],
  //           textColor: [255, 255, 255],
  //           fontStyle: 'bold',
  //           fontSize: 8.5,
  //           cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
  //           halign: 'left',
  //         },
  //         alternateRowStyles: { fillColor: [245, 249, 255] },
  //         bodyStyles: { halign: 'left' },
  //         didParseCell: (data) => {
  //           if (data.section === 'body') {
  //             const val = data.cell.raw;
  //             if (val !== '' && !isNaN(val)) data.cell.styles.halign = 'right';
  //           }
  //         },
  //         didDrawPage: () => {
  //           const currentPage = pdf.internal.getCurrentPageInfo().pageNumber;
  //           const totalPages  = pdf.internal.getNumberOfPages();
  //           pdf.setDrawColor(218, 218, 218);
  //           pdf.setLineWidth(0.2);
  //           pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
  //           pdf.setFontSize(7.5);
  //           pdf.setFont('helvetica', 'normal');
  //           pdf.setTextColor(140, 140, 140);
  //           pdf.text(`Total: ${filteredRows.length.toLocaleString()} records`, margin, pageHeight - 5);
  //           pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  //         },
  //         margin: { top: 22, right: margin, bottom: 14, left: margin },
  //       });

  //       triggerPrint(pdf); // ✅ same PDF as download, opens print dialog
  //       setSaveStatus('Print dialog opened');
  //       setTimeout(() => setSaveStatus(''), 2000);
  //       return;
  //     }

  //     // ══════════════════════════════════════════════════════════════
  //     // MODE 2 — CHARTS / MIXED → identical to handleDownloadPDF
  //     // ══════════════════════════════════════════════════════════════

  //     // Step 1: Expand all clipped/scrollable containers
  //     const allEls     = Array.from(target.querySelectorAll('*'));
  //     const clippedEls = allEls.filter((el) => {
  //       const s = window.getComputedStyle(el);
  //       return (
  //         ['auto', 'scroll', 'hidden'].includes(s.overflow)  ||
  //         ['auto', 'scroll', 'hidden'].includes(s.overflowY) ||
  //         (s.height !== 'auto' && el.scrollHeight > el.clientHeight)
  //       );
  //     });

  //     const savedStyles = clippedEls.map((el) => ({
  //       el,
  //       height:    el.style.height,
  //       maxHeight: el.style.maxHeight,
  //       overflow:  el.style.overflow,
  //       overflowY: el.style.overflowY,
  //     }));

  //     clippedEls.forEach((el) => {
  //       el.style.height    = el.scrollHeight + 'px';
  //       el.style.maxHeight = 'none';
  //       el.style.overflow  = 'visible';
  //       el.style.overflowY = 'visible';
  //     });

  //     const savedTarget = {
  //       height:    target.style.height,
  //       maxHeight: target.style.maxHeight,
  //       overflow:  target.style.overflow,
  //     };
  //     target.style.height    = target.scrollHeight + 'px';
  //     target.style.maxHeight = 'none';
  //     target.style.overflow  = 'visible';

  //     // Step 2: Wait for ECharts to finish rendering
  //     await new Promise((r) => setTimeout(r, 500));

  //     // Step 3: Capture full playground
  //     const capturedCanvas = await html2canvas(target, {
  //       backgroundColor: '#ffffff',
  //       scale: 3,
  //       useCORS: true,
  //       allowTaint: true,
  //       logging: false,
  //       imageTimeout: 15000,
  //       removeContainer: true,
  //       width:        target.scrollWidth,
  //       height:       target.scrollHeight,
  //       windowWidth:  target.scrollWidth,
  //       windowHeight: target.scrollHeight,
  //       scrollX: 0,
  //       scrollY: 0,
  //       foreignObjectRendering: false,
  //     });

  //     // Step 4: Restore all styles
  //     savedStyles.forEach(({ el, height, maxHeight, overflow, overflowY }) => {
  //       el.style.height    = height;
  //       el.style.maxHeight = maxHeight;
  //       el.style.overflow  = overflow;
  //       el.style.overflowY = overflowY;
  //     });
  //     target.style.height    = savedTarget.height;
  //     target.style.maxHeight = savedTarget.maxHeight;
  //     target.style.overflow  = savedTarget.overflow;

  //     // Step 5: Build PDF — identical to handleDownloadPDF
  //     const pdf        = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  //     const pageWidth  = pdf.internal.pageSize.getWidth();
  //     const pageHeight = pdf.internal.pageSize.getHeight();
  //     const margin     = 8;
  //     const headerH    = 13;
  //     const footerH    = 8;
  //     const usableW    = pageWidth  - margin * 2;
  //     const usableH    = pageHeight - headerH - footerH - margin;

  //     const drawHeader = (pageNum, totalPages) => {
  //       pdf.setFillColor(15, 108, 189);
  //       pdf.rect(0, 0, pageWidth, headerH, 'F');
  //       pdf.setFontSize(9);
  //       pdf.setFont('helvetica', 'bold');
  //       pdf.setTextColor(255, 255, 255);
  //       pdf.text('Dashboard Export', margin, 9);
  //       pdf.setFontSize(7.5);
  //       pdf.setFont('helvetica', 'normal');
  //       pdf.setTextColor(200, 225, 255);
  //       pdf.text(new Date().toLocaleString(), pageWidth / 2, 9, { align: 'center' });
  //       pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, 9, { align: 'right' });
  //     };

  //     const drawFooter = () => {
  //       pdf.setDrawColor(218, 218, 218);
  //       pdf.setLineWidth(0.15);
  //       pdf.line(margin, pageHeight - footerH, pageWidth - margin, pageHeight - footerH);
  //       pdf.setFontSize(7);
  //       pdf.setFont('helvetica', 'normal');
  //       pdf.setTextColor(160, 160, 160);
  //       pdf.text('Generated by BI Dashboard', margin, pageHeight - 4);
  //     };

  //     const imgData       = capturedCanvas.toDataURL('image/png');
  //     const imgRatio      = capturedCanvas.width / capturedCanvas.height;
  //     let imgW            = usableW;
  //     let imgH            = imgW / imgRatio;
  //     const totalImgPages = Math.ceil(imgH / usableH);
  //     const tableExists   = hasTable && hasCharts;
  //     const totalPages    = totalImgPages + (tableExists ? 1 : 0);

  //     for (let p = 0; p < totalImgPages; p++) {
  //       if (p > 0) pdf.addPage();
  //       drawHeader(p + 1, totalPages);
  //       drawFooter();
  //       const yShift = headerH + margin / 2 - p * usableH;
  //       pdf.addImage(imgData, 'PNG', margin, yShift, imgW, imgH, '', 'FAST');
  //     }

  //     // Mixed: add table as final page
  //     if (tableExists) {
  //       const tableEl    = target.querySelector('table');
  //       const theadCells = Array.from(
  //         tableEl.querySelectorAll('thead tr:first-child th, thead tr:first-child td')
  //       );
  //       const SKIP_HEADERS = [
  //         'createdat','updatedat','created_at','updated_at',
  //         '__v','_v','password','token','refreshtoken',
  //       ];
  //       const allColumns = theadCells.map((th, idx) => ({
  //         idx,
  //         label: th.innerText?.trim() || th.textContent?.trim() || '',
  //       }));
  //       const columns = allColumns.filter(
  //         (col) => !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
  //       );
  //       const tbodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
  //       const rows = tbodyRows.map((tr) => {
  //         const cells = Array.from(tr.querySelectorAll('td, th'));
  //         return columns.map((col) => {
  //           const cell = cells[col.idx];
  //           return cell ? (cell.innerText?.trim() || cell.textContent?.trim() || '') : '';
  //         });
  //       });
  //       const filteredRows = rows.filter((row) => row.some((c) => c !== ''));

  //       if (filteredRows.length > 0) {
  //         pdf.addPage();
  //         drawHeader(totalPages, totalPages);
  //         autoTable(pdf, {
  //           head: [columns.map((col) => col.label)],
  //           body: filteredRows,
  //           startY: headerH + 2,
  //           showHead: 'everyPage',
  //           tableWidth: pageWidth - margin * 2,
  //           styles: {
  //             fontSize: 7.5,
  //             cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
  //             font: 'helvetica',
  //             textColor: [32, 31, 30],
  //             lineColor: [218, 218, 218],
  //             lineWidth: 0.15,
  //             overflow: 'ellipsize',
  //             minCellHeight: 7,
  //           },
  //           headStyles: {
  //             fillColor: [32, 31, 30],
  //             textColor: [255, 255, 255],
  //             fontStyle: 'bold',
  //             fontSize: 7.5,
  //           },
  //           alternateRowStyles: { fillColor: [245, 249, 255] },
  //           bodyStyles: { halign: 'left' },
  //           didParseCell: (data) => {
  //             if (data.section === 'body') {
  //               const val = data.cell.raw;
  //               if (val !== '' && !isNaN(val)) data.cell.styles.halign = 'right';
  //             }
  //           },
  //           didDrawPage: () => {
  //             const cp = pdf.internal.getCurrentPageInfo().pageNumber;
  //             const tp = pdf.internal.getNumberOfPages();
  //             pdf.setDrawColor(218, 218, 218);
  //             pdf.setLineWidth(0.15);
  //             pdf.line(margin, pageHeight - footerH, pageWidth - margin, pageHeight - footerH);
  //             pdf.setFontSize(7);
  //             pdf.setFont('helvetica', 'normal');
  //             pdf.setTextColor(160, 160, 160);
  //             pdf.text(`Total: ${filteredRows.length.toLocaleString()} records`, margin, pageHeight - 4);
  //             pdf.text(`Page ${cp} of ${tp}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
  //           },
  //           margin: { top: headerH + 2, right: margin, bottom: footerH + 4, left: margin },
  //         });
  //       }
  //     }

  //     // Step 6: Print — same PDF as download, just trigger print instead of save
  //     triggerPrint(pdf);
  //     setSaveStatus('Print dialog opened');
  //     setTimeout(() => setSaveStatus(''), 2000);

  //   } catch (error) {
  //     console.error('Print failed:', error);
  //     setSaveStatus(error.message || 'Print failed');
  //     setTimeout(() => setSaveStatus(''), 3000);
  //   }
  // }, []);

  // const handlePrintDashboard = useCallback(async () => {
  //   setSaveStatus('Preparing print...');
  //   try {
  //     const html2canvas = (await import('html2canvas')).default;

  //     const target = document.querySelector('.bi-playground-content');
  //     if (!target) throw new Error('Print area not found');

  //     // ─────────────────────────────────────────────
  //     // Detect chart cards (same logic as PDF)
  //     // ─────────────────────────────────────────────
  //     const SELECTORS = [
  //       '.bi-chart-card',
  //       '.bi-chart-item',
  //       '.bi-chart-wrapper',
  //       '.chart-container',
  //       '.recharts-wrapper',
  //       '[class*="chart-card"]',
  //       '[class*="chart-item"]',
  //       '[class*="chart-wrapper"]',
  //     ];

  //     let cards = [];
  //     for (const sel of SELECTORS) {
  //       const found = Array.from(target.querySelectorAll(sel));
  //       if (found.length) {
  //         cards = found;
  //         break;
  //       }
  //     }

  //     // Fallback → children with canvas/table
  //     if (cards.length === 0) {
  //       cards = Array.from(target.children).filter(
  //         (child) => child.querySelector('canvas') || child.querySelector('table')
  //       );
  //     }

  //     // Last fallback → whole dashboard
  //     if (cards.length === 0) {
  //       cards = [target];
  //     }

  //     // ─────────────────────────────────────────────
  //     // Capture each card in FULL (not viewport)
  //     // ─────────────────────────────────────────────
  //     const images = [];

  //     for (let i = 0; i < cards.length; i++) {
  //       const card = cards[i];

  //       // Save original styles
  //       const original = {
  //         overflow: card.style.overflow,
  //         maxHeight: card.style.maxHeight,
  //         height: card.style.height,
  //       };

  //       // Expand fully (CRITICAL for full data printing)
  //       card.style.overflow = 'visible';
  //       card.style.maxHeight = 'none';
  //       card.style.height = 'auto';

  //       // Expand inner scroll containers (tables especially)
  //       const scrollEls = Array.from(card.querySelectorAll('*')).filter((el) => {
  //         const s = window.getComputedStyle(el);
  //         return ['auto', 'scroll', 'hidden'].includes(s.overflowY);
  //       });

  //       const savedScroll = scrollEls.map((el) => ({
  //         el,
  //         overflow: el.style.overflow,
  //         overflowY: el.style.overflowY,
  //         maxHeight: el.style.maxHeight,
  //       }));

  //       scrollEls.forEach((el) => {
  //         el.style.overflow = 'visible';
  //         el.style.overflowY = 'visible';
  //         el.style.maxHeight = 'none';
  //       });

  //       // Wait for charts (ECharts/Recharts) to fully render
  //       await new Promise((r) => setTimeout(r, 400));

  //       const canvas = await html2canvas(card, {
  //         backgroundColor: '#ffffff',
  //         scale: 3,
  //         useCORS: true,
  //         allowTaint: true,
  //         width: card.scrollWidth,
  //         height: card.scrollHeight,
  //         windowWidth: card.scrollWidth,
  //         windowHeight: card.scrollHeight,
  //         scrollX: 0,
  //         scrollY: 0,
  //       });

  //       images.push(canvas.toDataURL('image/png'));

  //       // Restore styles (VERY IMPORTANT)
  //       card.style.overflow = original.overflow;
  //       card.style.maxHeight = original.maxHeight;
  //       card.style.height = original.height;

  //       savedScroll.forEach(({ el, overflow, overflowY, maxHeight }) => {
  //         el.style.overflow = overflow;
  //         el.style.overflowY = overflowY;
  //         el.style.maxHeight = maxHeight;
  //       });
  //     }

  //     // ─────────────────────────────────────────────
  //     // Build professional multi-page print document
  //     // (NOT single long image like your current version)
  //     // ─────────────────────────────────────────────
  //     const printWindow = window.open('', '_blank');
  //     if (!printWindow) {
  //       setSaveStatus('Popup blocked — allow popups');
  //       return;
  //     }

  //     const pagesHTML = images
  //       .map(
  //         (img, index) => `
  //         <div class="print-page">
  //           <div class="print-header">
  //             <div class="title">Dashboard Export</div>
  //             <div class="meta">Page ${index + 1} • ${new Date().toLocaleString()}</div>
  //           </div>
  //           <img src="${img}" />
  //         </div>
  //       `
  //       )
  //       .join('');

  //     printWindow.document.write(`
  //       <!DOCTYPE html>
  //       <html>
  //         <head>
  //           <title>Dashboard Print</title>
  //           <style>
  //             * {
  //               margin: 0;
  //               padding: 0;
  //               box-sizing: border-box;
  //               -webkit-print-color-adjust: exact;
  //               print-color-adjust: exact;
  //             }
  
  //             body {
  //               background: #ffffff;
  //               font-family: Arial, sans-serif;
  //             }
  
  //             .print-page {
  //               width: 100%;
  //               page-break-after: always;
  //               padding: 12mm;
  //             }
  
  //             .print-header {
  //               display: flex;
  //               justify-content: space-between;
  //               align-items: center;
  //               margin-bottom: 10px;
  //               border-bottom: 1px solid #ddd;
  //               padding-bottom: 6px;
  //             }
  
  //             .title {
  //               font-size: 14px;
  //               font-weight: bold;
  //               color: #0f6cbd;
  //             }
  
  //             .meta {
  //               font-size: 10px;
  //               color: #666;
  //             }
  
  //             img {
  //               width: 100%;
  //               height: auto;
  //               display: block;
  //               page-break-inside: avoid;
  //             }
  
  //             @media print {
  //               @page {
  //                 size: A4 landscape;
  //                 margin: 0;
  //               }
  //               body {
  //                 background: white;
  //               }
  //             }
  //           </style>
  //         </head>
  //         <body>
  //           ${pagesHTML}
  //           <script>
  //             window.onload = () => {
  //               setTimeout(() => {
  //                 window.print();
  //                 window.close();
  //               }, 500);
  //             };
  //           </script>
  //         </body>
  //       </html>
  //     `);

  //     printWindow.document.close();
  //     setSaveStatus(`Print ready — ${images.length} page(s)`);
  //     setTimeout(() => setSaveStatus(''), 3000);
  //   } catch (error) {
  //     console.error('Print failed:', error);
  //     setSaveStatus(error.message || 'Print failed');
  //     setTimeout(() => setSaveStatus(''), 3000);
  //   }
  // }, []);
  // const handlePrintDashboard = useCallback(async () => {
  //   setSaveStatus('Preparing print...');
    
  //   try {
  //     const html2canvas = (await import('html2canvas')).default;
  //     const autoTable = (await import('jspdf-autotable')).default;
      
  //     // We'll use jsPDF to generate a print-optimized document
  //     const { jsPDF } = await import('jspdf');
      
  //     const target = document.querySelector('.bi-playground-content');
  //     if (!target) throw new Error('Print area not found');
  
  //     // ── Detect content types ───────────────────────────────────────────────
  //     const hasCanvas = target.querySelector('canvas') !== null;
  //     const hasTable = target.querySelector('table') !== null;
  //     const isOnlyTable = hasTable && !hasCanvas;
  
  //     // ══════════════════════════════════════════════════════════════════════
  //     // MODE 1 — PURE TABLE ONLY → jspdf-autotable (perfect text quality)
  //     // ══════════════════════════════════════════════════════════════════════
  //     if (isOnlyTable) {
  //       const tableEl = target.querySelector('table');
  
  //       const theadCells = Array.from(
  //         tableEl.querySelectorAll('thead tr:first-child th, thead tr:first-child td')
  //       );
  
  //       const SKIP_HEADERS = [
  //         'createdat', 'updatedat', 'created_at', 'updated_at',
  //         '__v', '_v', 'password', 'token', 'refreshtoken',
  //       ];
  
  //       const allColumns = theadCells.map((th, idx) => ({
  //         idx,
  //         label: cleanPdfHeaderLabel(th.innerText ?? th.textContent ?? ''),
  //       }));
  
  //       const columns = allColumns.filter(
  //         (col) => !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
  //       );
  
  //       const tbodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
  //       const rows = tbodyRows.map((tr) => {
  //         const cells = Array.from(tr.querySelectorAll('td, th'));
  //         return columns.map((col) => {
  //           const cell = cells[col.idx];
  //           return cell ? (cell.innerText?.trim() || cell.textContent?.trim() || '') : '';
  //         });
  //       });
  
  //       const filteredRows = rows.filter((row) => row.some((cell) => cell !== ''));
  //       if (filteredRows.length === 0) throw new Error('No table data found');
  
  //       const orientation = columns.length > 6 ? 'landscape' : 'portrait';
  //       const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
  //       const pageWidth = pdf.internal.pageSize.getWidth();
  //       const pageHeight = pdf.internal.pageSize.getHeight();
  //       const margin = 12;
  
  //       // Add header
  //       pdf.setFillColor(15, 108, 189);
  //       pdf.rect(0, 0, pageWidth, 18, 'F');
  //       pdf.setFontSize(11);
  //       pdf.setFont('helvetica', 'bold');
  //       pdf.setTextColor(255, 255, 255);
  //       pdf.text('Dashboard Print', margin, 12);
  //       pdf.setFontSize(8);
  //       pdf.setFont('helvetica', 'normal');
  //       pdf.setTextColor(200, 225, 255);
  //       pdf.text(
  //         `${filteredRows.length.toLocaleString()} records  •  ${new Date().toLocaleString()}`,
  //         pageWidth - margin, 12, { align: 'right' }
  //       );
  
  //       // Add table
  //       autoTable(pdf, {
  //         head: [columns.map((col) => col.label)],
  //         body: filteredRows,
  //         startY: 22,
  //         showHead: 'everyPage',
  //         tableWidth: pageWidth - margin * 2,
  //         styles: {
  //           fontSize: 8.5,
  //           cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
  //           font: 'helvetica',
  //           textColor: [32, 31, 30],
  //           lineColor: [218, 218, 218],
  //           lineWidth: 0.15,
  //           overflow: 'ellipsize',
  //           minCellHeight: 8,
  //         },
  //         headStyles: {
  //           fillColor: [32, 31, 30],
  //           textColor: [255, 255, 255],
  //           fontStyle: 'bold',
  //           fontSize: 8.5,
  //           cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
  //           halign: 'left',
  //         },
  //         alternateRowStyles: { fillColor: [245, 249, 255] },
  //         bodyStyles: { halign: 'left' },
  //         didParseCell: (data) => {
  //           if (data.section === 'body') {
  //             const val = data.cell.raw;
  //             if (val !== '' && !isNaN(val)) data.cell.styles.halign = 'right';
  //           }
  //         },
  //         didDrawPage: () => {
  //           const currentPage = pdf.internal.getCurrentPageInfo().pageNumber;
  //           const totalPages = pdf.internal.getNumberOfPages();
  //           pdf.setDrawColor(218, 218, 218);
  //           pdf.setLineWidth(0.2);
  //           pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
  //           pdf.setFontSize(7.5);
  //           pdf.setFont('helvetica', 'normal');
  //           pdf.setTextColor(140, 140, 140);
  //           pdf.text(`Total: ${filteredRows.length.toLocaleString()} records`, margin, pageHeight - 5);
  //           pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  //         },
  //         margin: { top: 22, right: margin, bottom: 14, left: margin },
  //       });
  
  //       // Generate PDF blob and open in new window for printing
  //       const pdfBlob = pdf.output('blob');
  //       const pdfUrl = URL.createObjectURL(pdfBlob);
        
  //       const printWindow = window.open(pdfUrl, '_blank');
  //       if (!printWindow) {
  //         setSaveStatus('Popup blocked — allow popups and try again');
  //         setTimeout(() => setSaveStatus(''), 3000);
  //         return;
  //       }
        
  //       // Clean up URL object after a delay
  //       setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        
  //       setSaveStatus(`✓ Print ready — ${filteredRows.length.toLocaleString()} records`);
  //       setTimeout(() => setSaveStatus(''), 3000);
  //       return;
  //     }
  
  //     // ══════════════════════════════════════════════════════════════════════
  //     // MODE 2 — CHARTS (ECharts canvas) + optional table
  //     // Each chart card captured individually → one PDF page per chart
  //     // ══════════════════════════════════════════════════════════════════════
  
  //     // Find all chart card containers inside the playground
  //     const CHART_CARD_SELECTORS = [
  //       '.bi-chart-card',
  //       '.bi-chart-item',
  //       '.bi-chart-wrapper',
  //       '.chart-container',
  //       '.recharts-wrapper',
  //       '[class*="chart-card"]',
  //       '[class*="chart-item"]',
  //       '[class*="chart-wrapper"]',
  //     ];
  
  //     // Try each selector until we find chart cards
  //     let chartCards = [];
  //     for (const sel of CHART_CARD_SELECTORS) {
  //       const found = Array.from(target.querySelectorAll(sel));
  //       if (found.length > 0) {
  //         chartCards = found;
  //         break;
  //       }
  //     }
  
  //     // Fallback: if no specific card selector matched,
  //     // find all direct children that contain a canvas or table
  //     if (chartCards.length === 0) {
  //       chartCards = Array.from(target.children).filter((child) => {
  //         return child.querySelector('canvas') || child.querySelector('table');
  //       });
  //     }
  
  //     // Last resort: capture entire playground as one page
  //     if (chartCards.length === 0) {
  //       chartCards = [target];
  //     }
  
  //     setSaveStatus(`Found ${chartCards.length} chart(s) — preparing print...`);
  
  //     const pdf = new jsPDF({
  //       orientation: 'landscape',
  //       unit: 'mm',
  //       format: 'a4',
  //       compress: false,
  //     });
  
  //     const pageWidth = pdf.internal.pageSize.getWidth();   // 297mm
  //     const pageHeight = pdf.internal.pageSize.getHeight();  // 210mm
  //     const margin = 10;
  //     const headerH = 14;
  //     const footerH = 10;
  //     const usableH = pageHeight - headerH - footerH - margin;
  //     const usableW = pageWidth - margin * 2;
  
  //     const drawPageHeader = (pdfInstance, title, pageNum, totalPages) => {
  //       pdfInstance.setFillColor(15, 108, 189);
  //       pdfInstance.rect(0, 0, pageWidth, headerH, 'F');
  //       pdfInstance.setFontSize(9);
  //       pdfInstance.setFont('helvetica', 'bold');
  //       pdfInstance.setTextColor(255, 255, 255);
  //       pdfInstance.text('Dashboard Print', margin, 9);
  //       pdfInstance.setFontSize(7.5);
  //       pdfInstance.setFont('helvetica', 'normal');
  //       pdfInstance.setTextColor(200, 225, 255);
  //       if (title) pdfInstance.text(title, pageWidth / 2, 9, { align: 'center' });
  //       pdfInstance.text(
  //         `Page ${pageNum} of ${totalPages}  •  ${new Date().toLocaleDateString()}`,
  //         pageWidth - margin, 9, { align: 'right' }
  //       );
  //     };
  
  //     const drawPageFooter = (pdfInstance) => {
  //       pdfInstance.setDrawColor(218, 218, 218);
  //       pdfInstance.setLineWidth(0.2);
  //       pdfInstance.line(margin, pageHeight - footerH, pageWidth - margin, pageHeight - footerH);
  //       pdfInstance.setFontSize(7);
  //       pdfInstance.setFont('helvetica', 'normal');
  //       pdfInstance.setTextColor(160, 160, 160);
  //       pdfInstance.text('Generated by BI Dashboard', margin, pageHeight - 5);
  //     };
  
  //     let isFirstPage = true;
  
  //     for (let i = 0; i < chartCards.length; i++) {
  //       const card = chartCards[i];
  
  //       // ── If card contains a table → use autoTable for this page ──────────
  //       const cardTable = card.querySelector('table');
  //       const cardCanvas = card.querySelector('canvas');
  
  //       if (cardTable && !cardCanvas) {
  //         // Table chart — use autoTable
  //         const theadCells = Array.from(
  //           cardTable.querySelectorAll('thead tr:first-child th, thead tr:first-child td')
  //         );
  
  //         const SKIP_HEADERS = [
  //           'createdat', 'updatedat', 'created_at', 'updated_at',
  //           '__v', '_v', 'password', 'token', 'refreshtoken',
  //         ];
  
  //         const allColumns = theadCells.map((th, idx) => ({
  //           idx,
  //           label: cleanPdfHeaderLabel(th.innerText ?? th.textContent ?? ''),
  //         }));
  //         const columns = allColumns.filter(
  //           (col) => !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
  //         );
  
  //         const tbodyRows = Array.from(cardTable.querySelectorAll('tbody tr'));
  //         const rows = tbodyRows.map((tr) => {
  //           const cells = Array.from(tr.querySelectorAll('td, th'));
  //           return columns.map((col) => {
  //             const cell = cells[col.idx];
  //             return cell ? (cell.innerText?.trim() || cell.textContent?.trim() || '') : '';
  //           });
  //         });
  //         const filteredRows = rows.filter((row) => row.some((c) => c !== ''));
  
  //         if (!isFirstPage) pdf.addPage();
  //         isFirstPage = false;
  
  //         drawPageHeader(pdf, 'Table', i + 1, chartCards.length);
  
  //         const tableMargin = margin;
  //         autoTable(pdf, {
  //           head: [columns.map((col) => col.label)],
  //           body: filteredRows,
  //           startY: headerH + 2,
  //           showHead: 'everyPage',
  //           tableWidth: pageWidth - tableMargin * 2,
  //           styles: {
  //             fontSize: 7.5,
  //             cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
  //             font: 'helvetica',
  //             textColor: [32, 31, 30],
  //             lineColor: [218, 218, 218],
  //             lineWidth: 0.15,
  //             overflow: 'ellipsize',
  //           },
  //           headStyles: {
  //             fillColor: [32, 31, 30],
  //             textColor: [255, 255, 255],
  //             fontStyle: 'bold',
  //             fontSize: 7.5,
  //           },
  //           alternateRowStyles: { fillColor: [245, 249, 255] },
  //           didDrawPage: () => {
  //             drawPageFooter(pdf);
  //           },
  //           margin: { top: headerH + 2, right: tableMargin, bottom: footerH + 2, left: tableMargin },
  //         });
  
  //         continue; // move to next chart card
  //       }
  
  //       // ── Chart card (ECharts canvas) → html2canvas capture ───────────────
  
  //       // Temporarily make card fully visible for capture
  //       const savedCardStyles = {
  //         height: card.style.height,
  //         maxHeight: card.style.maxHeight,
  //         overflow: card.style.overflow,
  //         position: card.style.position,
  //       };
  
  //       card.style.overflow = 'visible';
  //       card.style.maxHeight = 'none';
  
  //       // Also expand any inner clipped elements
  //       const innerClipped = Array.from(card.querySelectorAll('*')).filter((el) => {
  //         const s = window.getComputedStyle(el);
  //         return (
  //           ['auto', 'scroll', 'hidden'].includes(s.overflow) ||
  //           ['auto', 'scroll', 'hidden'].includes(s.overflowY)
  //         );
  //       });
  //       const innerSaved = innerClipped.map((el) => ({
  //         el,
  //         overflow: el.style.overflow,
  //         overflowY: el.style.overflowY,
  //         height: el.style.height,
  //         maxHeight: el.style.maxHeight,
  //       }));
  //       innerClipped.forEach((el) => {
  //         el.style.overflow = 'visible';
  //         el.style.overflowY = 'visible';
  //         el.style.maxHeight = 'none';
  //       });
  
  //       // Wait for ECharts to finish rendering animations
  //       await new Promise((r) => setTimeout(r, 400));
  
  //       let capturedCanvas;
  //       try {
  //         capturedCanvas = await html2canvas(card, {
  //           backgroundColor: '#ffffff',
  //           scale: 3,
  //           useCORS: true,
  //           allowTaint: true,
  //           logging: false,
  //           imageTimeout: 15000,
  //           removeContainer: true,
  //           width: card.scrollWidth,
  //           height: card.scrollHeight,
  //           windowWidth: card.scrollWidth,
  //           windowHeight: card.scrollHeight,
  //           scrollX: 0,
  //           scrollY: 0,
  //           foreignObjectRendering: false,
  //         });
  //       } catch (captureErr) {
  //         console.warn(`Chart ${i + 1} capture failed, skipping:`, captureErr);
  //         continue;
  //       }
  
  //       // Restore card styles
  //       card.style.height = savedCardStyles.height;
  //       card.style.maxHeight = savedCardStyles.maxHeight;
  //       card.style.overflow = savedCardStyles.overflow;
  //       card.style.position = savedCardStyles.position;
  //       innerSaved.forEach(({ el, overflow, overflowY, height, maxHeight }) => {
  //         el.style.overflow = overflow;
  //         el.style.overflowY = overflowY;
  //         el.style.height = height;
  //         el.style.maxHeight = maxHeight;
  //       });
  
  //       // Add to PDF
  //       if (!isFirstPage) pdf.addPage();
  //       isFirstPage = false;
  
  //       // Get chart title from card DOM if available
  //       const titleEl = card.querySelector(
  //         '.bi-chart-title, .chart-title, [class*="title"], h3, h4'
  //       );
  //       const chartTitle = titleEl?.innerText?.trim() || `Chart ${i + 1}`;
  
  //       drawPageHeader(pdf, chartTitle, i + 1, chartCards.length);
  //       drawPageFooter(pdf);
  
  //       // Fit image within usable area maintaining aspect ratio
  //       const imgData = capturedCanvas.toDataURL('image/png');
  //       const imgRatio = capturedCanvas.width / capturedCanvas.height;
  //       const maxW = usableW;
  //       const maxH = usableH;
  
  //       let imgW = maxW;
  //       let imgH = imgW / imgRatio;
  
  //       if (imgH > maxH) {
  //         imgH = maxH;
  //         imgW = imgH * imgRatio;
  //       }
  
  //       // Center horizontally
  //       const xOffset = margin + (usableW - imgW) / 2;
  //       const yOffset = headerH + (usableH - imgH) / 2 + margin / 2;
  
  //       pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgW, imgH, '', 'FAST');
  //     }
  
  //     // Generate PDF blob and open in new window for printing
  //     const pdfBlob = pdf.output('blob');
  //     const pdfUrl = URL.createObjectURL(pdfBlob);
      
  //     const printWindow = window.open(pdfUrl, '_blank');
  //     if (!printWindow) {
  //       setSaveStatus('Popup blocked — allow popups and try again');
  //       setTimeout(() => setSaveStatus(''), 3000);
  //       return;
  //     }
      
  //     // Clean up URL object after a delay
  //     setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
      
  //     setSaveStatus(`✓ Print ready — ${chartCards.length} chart(s)`);
  //     setTimeout(() => setSaveStatus(''), 3000);
  
  //   } catch (error) {
  //     console.error('Print failed:', error);
  //     setSaveStatus(error.message || 'Print failed');
  //     setTimeout(() => setSaveStatus(''), 3000);
  //   }
  // }, []);
  
  

  const handleDownloadJSON = useCallback(() => {
    const name = (dashboardName && dashboardName.trim()) || 'My Dashboard';
    const dashboardData = {
      name,
      charts,
      layouts,
      logo: dashboardLogo || undefined,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'dashboard';
    a.download = `${safeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveStatus('JSON downloaded');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [charts, layouts, dashboardName, dashboardLogo]);

  // Download PNG (canvas export)
  const handleDownloadPNG = useCallback(async () => {
    setSaveStatus('Generating PNG...');
    try {
      const canvas = document.querySelector('.bi-chart-canvas');
      if (!canvas) {
        setSaveStatus('Canvas not found');
        setTimeout(() => setSaveStatus(''), 2000);
        return;
      }

      // Use html2canvas if available, otherwise fallback
      try {
        // Dynamic import of html2canvas

        const canvasElement = await html2canvas(canvas, {
          backgroundColor: '#f9fafb',
          scale: 2,
        });
        canvasElement.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `dashboard-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setSaveStatus('PNG downloaded');
          setTimeout(() => setSaveStatus(''), 2000);
        });
      } catch (error) {
        // Fallback: screenshot using browser API
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          setSaveStatus('Please use browser screenshot or install html2canvas');
          setTimeout(() => setSaveStatus(''), 3000);
        } else {
          throw error;
        }
      }
    } catch (error) {
      setSaveStatus('PNG export failed. Install html2canvas package.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, []);

  // Download PDF (optional)


  // const handleDownloadPDF = useCallback(async () => {
  //   setSaveStatus('Generating PDF...');
  //   try {
  //     const html2canvas = (await import('html2canvas')).default;
  //     const { jsPDF } = await import('jspdf');

  //     const printArea = document.querySelector('.bi-playground-content');
  //     if (!printArea) {
  //       setSaveStatus('Canvas not found');
  //       setTimeout(() => setSaveStatus(''), 2000);
  //       return;
  //     }

  //     // Scroll to top-left so full content is in view; capture full content dimensions
  //     const scrollParent = printArea.closest('[style*="overflow"]') || printArea.parentElement;
  //     if (scrollParent && scrollParent.scrollTo) {
  //       scrollParent.scrollTop = 0;
  //       scrollParent.scrollLeft = 0;
  //     }
  //     const fullWidth = printArea.scrollWidth || printArea.offsetWidth;
  //     const fullHeight = printArea.scrollHeight || printArea.offsetHeight;

  //     const canvasElement = await html2canvas(printArea, {
  //       backgroundColor: '#ffffff',
  //       scale: 2,
  //       width: fullWidth,
  //       height: fullHeight,
  //       useCORS: true,
  //       allowTaint: false,
  //       logging: false,
  //       imageTimeout: 15000,
  //       removeContainer: true,
  //       scrollX: 0,
  //       scrollY: 0,
  //     });

  //     // Use PNG for lossless quality — never use JPEG for charts/text
  //     const imgData = canvasElement.toDataURL('image/png');

  //     const pdf = new jsPDF({
  //       orientation: 'landscape',
  //       unit: 'mm',
  //       format: 'a4',
  //       compress: false,           // ✅ no compression = best quality
  //     });

  //     const pageWidth = pdf.internal.pageSize.getWidth();   // 297mm
  //     const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

  //     const imgWidth = pageWidth;
  //     const imgHeight = (canvasElement.height * pageWidth) / canvasElement.width;

  //     // If content is taller than one page — add multiple pages
  //     if (imgHeight <= pageHeight) {
  //       // Single page — center vertically
  //       const yOffset = (pageHeight - imgHeight) / 2;
  //       pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight, '', 'FAST');
  //     } else {
  //       // Multi-page — slice image across pages
  //       let remainingHeight = imgHeight;
  //       let yPosition = 0;

  //       while (remainingHeight > 0) {
  //         pdf.addImage(
  //           imgData, 'PNG',
  //           0, -yPosition,
  //           imgWidth, imgHeight,
  //           '', 'FAST'
  //         );
  //         remainingHeight -= pageHeight;
  //         yPosition += pageHeight;
  //         if (remainingHeight > 0) pdf.addPage();
  //       }
  //     }

  //     pdf.save(`dashboard-${Date.now()}.pdf`);
  //     setSaveStatus('PDF downloaded');
  //     setTimeout(() => setSaveStatus(''), 2000);
  //   } catch (error) {
  //     console.error('PDF export failed', error);
  //     setSaveStatus('PDF export failed');
  //     setTimeout(() => setSaveStatus(''), 3000);
  //   }
  // }, []);


  // popup solution
  // const handleDownloadPDF = useCallback(async () => {
  //   setSaveStatus('Generating PDF...');

  //   try {
  //     const html2canvas = (await import('html2canvas')).default;
  //     const { jsPDF } = await import('jspdf');

  //     const target = document.querySelector('.bi-playground-content');
  //     if (!target) {
  //       throw new Error('Export area not found');
  //     }

  //     // Store original scroll positions
  //     const scrollableElements = [];
  //     const findScrollableElements = (element) => {
  //       const style = window.getComputedStyle(element);
  //       if (style.overflow === 'auto' || style.overflow === 'scroll' || 
  //           style.overflowY === 'auto' || style.overflowY === 'scroll') {
  //         scrollableElements.push({
  //           element,
  //           scrollTop: element.scrollTop,
  //           scrollLeft: element.scrollLeft
  //         });
  //       }
  //       Array.from(element.children).forEach(child => findScrollableElements(child));
  //     };
  //     findScrollableElements(target);

  //     // Create a new window for rendering full content
  //     const printWindow = window.open('', '_blank');
  //     if (!printWindow) {
  //       throw new Error('Popup blocked. Please allow popups.');
  //     }

  //     // Get all styles
  //     const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
  //     let stylesHTML = '';
  //     styles.forEach(style => {
  //       if (style.tagName === 'STYLE') {
  //         stylesHTML += style.outerHTML;
  //       } else if (style.tagName === 'LINK') {
  //         stylesHTML += style.outerHTML;
  //       }
  //     });

  //     // Clone the target with full content
  //     const cloneNode = (node) => {
  //       const clone = node.cloneNode(false);

  //       // Copy attributes
  //       Array.from(node.attributes).forEach(attr => {
  //         clone.setAttribute(attr.name, attr.value);
  //       });

  //       // Recursively clone children
  //       Array.from(node.childNodes).forEach(child => {
  //         if (child.nodeType === 1) { // Element node
  //           clone.appendChild(cloneNode(child));
  //         } else if (child.nodeType === 3) { // Text node
  //           clone.appendChild(document.createTextNode(child.textContent));
  //         }
  //       });

  //       return clone;
  //     };

  //     const targetClone = cloneNode(target);

  //     // Process the clone to make all content visible
  //     const processElement = (element) => {
  //       // Remove any height/overflow restrictions
  //       element.style.height = 'auto';
  //       element.style.maxHeight = 'none';
  //       element.style.minHeight = 'auto';
  //       element.style.overflow = 'visible';
  //       element.style.overflowY = 'visible';
  //       element.style.overflowX = 'visible';

  //       // Handle tables
  //       if (element.tagName === 'TABLE') {
  //         element.style.width = '100%';
  //         element.style.tableLayout = 'auto';
  //       }

  //       // Handle flex containers
  //       if (element.style.display === 'flex' || element.style.display === 'inline-flex') {
  //         element.style.flexWrap = 'wrap';
  //       }

  //       // Process children
  //       Array.from(element.children).forEach(child => processElement(child));
  //     };

  //     processElement(targetClone);

  //     // Handle canvas elements (charts)
  //     const canvases = targetClone.querySelectorAll('canvas');
  //     canvases.forEach((canvas, index) => {
  //       try {
  //         // Create a new canvas with same dimensions
  //         const newCanvas = document.createElement('canvas');
  //         newCanvas.width = canvas.width;
  //         newCanvas.height = canvas.height;
  //         newCanvas.style.width = canvas.style.width;
  //         newCanvas.style.height = canvas.style.height;

  //         // Copy drawing context
  //         const ctx = newCanvas.getContext('2d');
  //         ctx.drawImage(canvas, 0, 0);

  //         // Replace with data URL image for reliability
  //         const img = document.createElement('img');
  //         img.src = newCanvas.toDataURL('image/png');
  //         img.style.width = canvas.style.width || canvas.width + 'px';
  //         img.style.height = canvas.style.height || canvas.height + 'px';
  //         img.style.display = 'block';

  //         canvas.parentNode.replaceChild(img, canvas);
  //       } catch (e) {
  //         console.warn('Canvas conversion failed:', e);
  //       }
  //     });

  //     // Handle SVG elements
  //     const svgs = targetClone.querySelectorAll('svg');
  //     svgs.forEach(svg => {
  //       try {
  //         const svgData = new XMLSerializer().serializeToString(svg);
  //         const img = document.createElement('img');
  //         img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  //         img.style.width = svg.style.width || svg.getAttribute('width') || '100%';
  //         img.style.height = svg.style.height || svg.getAttribute('height') || 'auto';
  //         svg.parentNode.replaceChild(img, svg);
  //       } catch (e) {
  //         console.warn('SVG conversion failed:', e);
  //       }
  //     });

  //     // Write to new window
  //     printWindow.document.write(`
  //       <!DOCTYPE html>
  //       <html>
  //         <head>
  //           <title>Dashboard Export</title>
  //           ${stylesHTML}
  //           <style>
  //             * {
  //               overflow: visible !important;
  //               height: auto !important;
  //               max-height: none !important;
  //               page-break-inside: avoid;
  //             }
  //             body {
  //               margin: 0;
  //               padding: 20px;
  //               background: white;
  //             }
  //             table {
  //               page-break-inside: auto;
  //               width: 100% !important;
  //             }
  //             tr {
  //               page-break-inside: avoid;
  //               page-break-after: auto;
  //             }
  //             thead {
  //               display: table-header-group;
  //             }
  //             tfoot {
  //               display: table-footer-group;
  //             }
  //             @page {
  //               size: A4 landscape;
  //               margin: 1cm;
  //             }
  //             @media print {
  //               body { 
  //                 margin: 0; 
  //                 padding: 0.5in;
  //               }
  //             }
  //           </style>
  //         </head>
  //         <body>
  //           ${targetClone.outerHTML}
  //           <script>
  //             // Wait for images to load
  //             window.onload = function() {
  //               const images = document.getElementsByTagName('img');
  //               let loadedCount = 0;

  //               if (images.length === 0) {
  //                 generatePDF();
  //                 return;
  //               }

  //               Array.from(images).forEach(img => {
  //                 if (img.complete) {
  //                   loadedCount++;
  //                 } else {
  //                   img.onload = img.onerror = function() {
  //                     loadedCount++;
  //                     if (loadedCount === images.length) {
  //                       generatePDF();
  //                     }
  //                   };
  //                 }
  //               });

  //               if (loadedCount === images.length) {
  //                 generatePDF();
  //               }
  //             };

  //             function generatePDF() {
  //               setTimeout(() => {
  //                 window.print();
  //                 setTimeout(() => window.close(), 1000);
  //               }, 500);
  //             }
  //           </script>
  //         </body>
  //       </html>
  //     `);

  //     printWindow.document.close();

  //     setSaveStatus('PDF generation started...');

  //     // Monitor window close
  //     const checkInterval = setInterval(() => {
  //       if (printWindow.closed) {
  //         clearInterval(checkInterval);

  //         // Restore original scroll positions
  //         scrollableElements.forEach(item => {
  //           item.element.scrollTop = item.scrollTop;
  //           item.element.scrollLeft = item.scrollLeft;
  //         });

  //         setSaveStatus('PDF downloaded');
  //         setTimeout(() => setSaveStatus(''), 2000);
  //       }
  //     }, 500);

  //   } catch (error) {
  //     console.error('PDF export failed:', error);
  //     setSaveStatus(error.message || 'PDF export failed');
  //     setTimeout(() => setSaveStatus(''), 3000);
  //   }
  // }, []);

  // complete work
  const handleDownloadPDF = useCallback(async () => {
    setSaveStatus('Generating PDF...');
    const pdfTitle = (dashboardName && String(dashboardName).trim()) || 'Dashboard Export';

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const html2canvas = (await import('html2canvas')).default;

      const target = document.querySelector('.bi-playground-content');
      if (!target) throw new Error('Export area not found');

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
          tableEl.querySelectorAll('thead tr:first-child th, thead tr:first-child td')
        );

        const SKIP_HEADERS = [
          'createdat', 'updatedat', 'created_at', 'updated_at',
          '__v', '_v', 'password', 'token', 'refreshtoken',
        ];

        const allColumns = theadCells.map((th, idx) => ({
          idx,
          label: cleanPdfHeaderLabel(th.innerText ?? th.textContent ?? ''),
        }));

        const columns = allColumns.filter(
          (col) => !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
        );

        const tbodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
        const rows = tbodyRows.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td, th'));
          return columns.map((col) => {
            const cell = cells[col.idx];
            return cell ? (cell.innerText?.trim() || cell.textContent?.trim() || '') : '';
          });
        });

        const filteredRows = rows.filter((row) => row.some((cell) => cell !== ''));
        if (filteredRows.length === 0) throw new Error('No table data found');

        const orientation = columns.length > 6 ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 12;
        const headerH = 18;

        pdf.setFillColor(15, 108, 189);
        pdf.rect(0, 0, pageWidth, headerH, 'F');
        let textLeft = margin;
        if (dashboardLogo && typeof dashboardLogo === 'string' && dashboardLogo.startsWith('data:image')) {
          try {
            const logoW = 16;
            const logoH = 12;
            pdf.addImage(dashboardLogo, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH, '', 'FAST');
            textLeft = margin + logoW + 4;
          } catch (err) {
            console.warn('PDF logo draw failed', err);
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
          pageWidth - margin, 12, { align: 'right' }
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
            pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(140, 140, 140);
            pdf.text(`Total: ${filteredRows.length.toLocaleString()} records`, margin, pageHeight - 5);
            pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
          },
          margin: { top: 22, right: margin, bottom: 14, left: margin },
        });

        pdf.save(`dashboard-${Date.now()}.pdf`);
        setSaveStatus(`✓ PDF downloaded — ${filteredRows.length.toLocaleString()} records`);
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

      setSaveStatus(`Found ${chartCards.length} chart(s) — building PDF...`);

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: false,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();   // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight();  // 210mm
      const margin = 10;
      const headerH = 14;
      const footerH = 10;
      const usableH = pageHeight - headerH - footerH - margin;
      const usableW = pageWidth - margin * 2;

      const drawPageHeader = (pdfInstance, title, pageNum, totalPages) => {
        pdfInstance.setFillColor(15, 108, 189);
        pdfInstance.rect(0, 0, pageWidth, headerH, 'F');
        let textLeft = margin;
        if (dashboardLogo && typeof dashboardLogo === 'string' && dashboardLogo.startsWith('data:image')) {
          try {
            const logoW = 14;
            const logoH = 10;
            pdfInstance.addImage(dashboardLogo, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH, '', 'FAST');
            textLeft = margin + logoW + 4;
          } catch (err) {
            console.warn('PDF logo draw failed', err);
          }
        }
        pdfInstance.setFontSize(9);
        pdfInstance.setFont('helvetica', 'bold');
        pdfInstance.setTextColor(255, 255, 255);
        pdfInstance.text(pdfTitle, textLeft, 9);
        pdfInstance.setFontSize(7.5);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setTextColor(200, 225, 255);
        if (title) pdfInstance.text(title, pageWidth / 2, 9, { align: 'center' });
        pdfInstance.text(
          `Page ${pageNum} of ${totalPages}  •  ${new Date().toLocaleDateString()}`,
          pageWidth - margin, 9, { align: 'right' }
        );
      };

      const drawPageFooter = (pdfInstance) => {
        pdfInstance.setDrawColor(218, 218, 218);
        pdfInstance.setLineWidth(0.2);
        pdfInstance.line(margin, pageHeight - footerH, pageWidth - margin, pageHeight - footerH);
        pdfInstance.setFontSize(7);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setTextColor(160, 160, 160);
        pdfInstance.text('Generated by BI Dashboard', margin, pageHeight - 5);
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
            cardTable.querySelectorAll('thead tr:first-child th, thead tr:first-child td')
          );

          const SKIP_HEADERS = [
            'createdat', 'updatedat', 'created_at', 'updated_at',
            '__v', '_v', 'password', 'token', 'refreshtoken',
          ];

          const allColumns = theadCells.map((th, idx) => ({
            idx,
            label: cleanPdfHeaderLabel(th.innerText ?? th.textContent ?? ''),
          }));
          const columns = allColumns.filter(
            (col) => !SKIP_HEADERS.includes(col.label.toLowerCase().replace(/\s/g, ''))
          );

          const tbodyRows = Array.from(cardTable.querySelectorAll('tbody tr'));
          const rows = tbodyRows.map((tr) => {
            const cells = Array.from(tr.querySelectorAll('td, th'));
            return columns.map((col) => {
              const cell = cells[col.idx];
              return cell ? (cell.innerText?.trim() || cell.textContent?.trim() || '') : '';
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
            margin: { top: headerH + 2, right: tableMargin, bottom: footerH + 2, left: tableMargin },
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
        const innerClipped = Array.from(card.querySelectorAll('*')).filter((el) => {
          const s = window.getComputedStyle(el);
          return (
            ['auto', 'scroll', 'hidden'].includes(s.overflow) ||
            ['auto', 'scroll', 'hidden'].includes(s.overflowY)
          );
        });
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
          console.warn(`Chart ${i + 1} capture failed, skipping:`, captureErr);
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

        drawPageHeader(pdf, chartTitle, i + 1, chartCards.length);
        drawPageFooter(pdf);

        // Fit image within usable area maintaining aspect ratio
        const imgData = capturedCanvas.toDataURL('image/png');
        const imgRatio = capturedCanvas.width / capturedCanvas.height;
        const maxW = usableW;
        const maxH = usableH;

        let imgW = maxW;
        let imgH = imgW / imgRatio;

        if (imgH > maxH) {
          imgH = maxH;
          imgW = imgH * imgRatio;
        }

        // Center horizontally
        const xOffset = margin + (usableW - imgW) / 2;
        const yOffset = headerH + (usableH - imgH) / 2 + margin / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgW, imgH, '', 'FAST');
      }

      pdf.save(`dashboard-${Date.now()}.pdf`);
      setSaveStatus(`✓ PDF downloaded — ${chartCards.length} chart(s)`);
      setTimeout(() => setSaveStatus(''), 3000);

    } catch (error) {
      console.error('PDF export failed:', error);
      setSaveStatus(error.message || 'PDF export failed');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [dashboardLogo, dashboardName]);







  // console.log('testing of git pull');


  return (
    <div className={`${styles.biDashboard} bi-dashboard-root`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
        onChange={handleFileUpload}
        aria-hidden
      />

      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
        aria-hidden
        onChange={(e) => {
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
          {dashboardLogo ? (
            <div className={styles.biLogoContainer}>
              <img src={dashboardLogo} alt="Dashboard logo" className={styles.biLogo} />
            </div>
          ) : null}
          <h1 className={styles.biAppTitle}>Power BI Lite</h1>
        </div>
        <div className={styles.biHeaderRight}>
          {/* Optional: Add user profile or other header actions here */}
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
        onLoad={handleLoadDashboard}
        onShare={handleShare}
        shareUrl={shareUrl}
        saveStatus={saveStatus}
        fileInputRef={fileInputRef}
        recordCount={recordCount}
        exportPdfInProgress={exportPdfInProgress}
        onViewData={() => setViewDataOpen(true)}
        dashboardName={dashboardName}
        onDashboardNameChange={setDashboardName}
        savedDashboards={savedDashboards}
        onLoadDashboardById={handleLoadDashboardById}
        dashboardLogo={dashboardLogo}
        onSetLogo={() => logoInputRef.current?.click()}
        onClearLogo={() => setDashboardLogo(null)}
        dataFilter={dataFilter}
        onDataFilterChange={setDataFilter}
        dateFields={fields.filter((f) => f.type === 'date' || /date|time|created|updated|year|month/i.test(f.name || ''))}
      />

      <div className={`${styles.biMain} bi-main`}>
        <aside className={`${styles.biSidebarLeft} bi-sidebar-left`}>
          <FieldList
            collection={collection}
            onAddChart={handleAddChart}
            onFieldsLoaded={handleFieldsLoaded}
          />
        </aside>

        <main className={`${styles.biCanvas} bi-canvas`}>
          <ChartCanvas
            charts={charts}
            selectedChartId={selectedChartId}
            onSelect={handleSelectChart}
            onLayoutChange={(allLayouts) => dispatch(setLayouts(allLayouts))}
            savedLayouts={layouts}
            onRefresh={handleRefreshChart}
            onRemove={handleRequestRemoveChart}
            onDuplicate={handleDuplicateChart}
            onChartUpdate={handleUpdateChart}
            globalFilter={dataFilter}
          />
        </main>

        <aside className={`${styles.biSidebarRight} bi-sidebar-right`}>
          <ConfigPanel
            config={selectedChart}
            fields={fields}
            layouts={layouts}
            recordCount={recordCount}
            onUpdate={(updates) => selectedChart && handleUpdateChart(selectedChart.id, updates)}
            onRemove={handleRequestRemoveChart}
            onLayoutSizeChange={(id, size) => dispatch(updateChartLayout({ id, ...size }))}
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

      {/* Delete chart confirmation modal */}
      {chartToDeleteId && (
        <div
          className={styles.deleteModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-chart-title"
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
            <h3 id="delete-chart-title" style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>
              Delete chart
            </h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
              Are you sure you want to delete this chart? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
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
                type="button"
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
