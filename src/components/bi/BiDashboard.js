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
const { jsPDF } = await import('jspdf');
const { html2canvas } = await import('html2canvas');
import styles from './BiDashboard.module.css';
import DashboardToolbar from './DashboardToolbar';

const STORAGE_KEY = 'powerbi-dashboard';

const BiDashboard = () => {
  const dispatch = useDispatch();
  const { collection, charts, selectedChartId, layouts } = useSelector((state) => state.dashboard);
  const [fields, setFields] = useState([]);
  const [recordCount, setRecordCount] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [collectionInput, setCollectionInput] = useState(collection);
  const [shareUrl, setShareUrl] = useState('');
  const debounceTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedChart = charts.find((c) => c.id === selectedChartId);

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
      dispatch(
        addChart({
          collection,
          dimension,
          measure: { field: measureField, op: measureOp || 'COUNT' },
          type: 'bar',
          limit: 10,
        })
      );
    },
    [dispatch, collection]
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
    try {
      const res = await fetch('/api/bi/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Dashboard',
          charts,
          layouts,
        }),
      });
      if (res.ok) {
        try {
          const json = await res.json();
          const id = json?.id || json?._id;
          if (id) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts }));
            setSaveStatus('Saved');
            const base = typeof window !== 'undefined' ? window.location.origin : '';
            setShareUrl(`${base}/dashboard/${id}`);
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts }));
            setSaveStatus('Saved (local)');
          }
        } catch {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts }));
          setSaveStatus('Saved (local)');
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts }));
        setSaveStatus('Saved (local)');
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ charts, layouts }));
      setSaveStatus('Saved (local)');
    }
    setTimeout(() => setSaveStatus(''), 2000);
  }, [charts, layouts]);

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
        const { charts: savedCharts, layouts: savedLayouts } = JSON.parse(stored);
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

          dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts }));
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

              dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts }));
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

  // Print only the chart canvas (middle playground); CSS hides header/sidebars
  const handlePrintDashboard = useCallback(() => {
    window.print();
  }, []);

  // Download JSON config
  const handleDownloadJSON = useCallback(() => {
    const dashboardData = {
      name: 'My Dashboard',
      charts,
      layouts,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveStatus('JSON downloaded');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [charts, layouts]);

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
  const handleDownloadPDF = useCallback(async () => {
    setSaveStatus('Generating PDF...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = document.querySelector('.bi-chart-canvas');
      if (!canvas) {
        setSaveStatus('Canvas not found');
        setTimeout(() => setSaveStatus(''), 2000);
        return;
      }

      const canvasElement = await html2canvas(canvas, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const imgData = canvasElement.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = 297;
      const imgHeight = (canvasElement.height * imgWidth) / canvasElement.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`dashboard-${Date.now()}.pdf`);

      setSaveStatus('PDF downloaded');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('PDF export failed', error);
      setSaveStatus('PDF export failed');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, []);


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

      {/* Main Header Section */}
      <header className={styles.biMainHeader}>
        <div className={styles.biHeaderLeft}>
          {/* <div className={styles.biLogoContainer}> */}
          {/* <img 
              src="/logo.png" 
              alt="Power BI Lite" 
              className={styles.biLogo}
              onError={(e) => {
                // Fallback if logo doesn't exist - show icon/text instead
                e.target.style.display = 'none';
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = 'flex';
              }}
            /> */}
          {/* <div className={styles.biLogoFallback} style={{ display: 'none' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="var(--color-blue)"/>
                <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div> */}
          {/* </div> */}
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
            onRemove={handleRemoveChart}
            onDuplicate={handleDuplicateChart}
            onChartUpdate={handleUpdateChart}
          />
        </main>

        <aside className={`${styles.biSidebarRight} bi-sidebar-right`}>
          <ConfigPanel
            config={selectedChart}
            fields={fields}
            layouts={layouts}
            onUpdate={(updates) => selectedChart && handleUpdateChart(selectedChart.id, updates)}
            onRemove={handleRemoveChart}
            onLayoutSizeChange={(id, size) => dispatch(updateChartLayout({ id, ...size }))}
          />
        </aside>
      </div>
    </div>
  );
};

export default BiDashboard;
