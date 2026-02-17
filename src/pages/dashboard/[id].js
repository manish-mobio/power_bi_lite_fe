/**
 * Power BI Lite - Shareable dashboard by ID
 * Loads full layout, charts, and config from backend and renders BiDashboard
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { loadDashboard } from '@/store/reducers/dashboardReducer';
import { BiDashboard } from '@/components/bi';

function normalizeLayouts(loadedLayouts, chartIds) {
  if (!chartIds.length) return {};
  const validLayouts = {};

  if (loadedLayouts?.lg && Array.isArray(loadedLayouts.lg)) {
    const savedLg = loadedLayouts.lg;
    const hasValidSaved =
      savedLg.length === chartIds.length &&
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
  return validLayouts;
}

const DashboardByIdPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const dispatch = useDispatch();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setStatus('loading');

    fetch(`/api/bi/dashboards/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : 'Failed to load');
        return res.json();
      })
      .then((doc) => {
        if (cancelled) return;
        const charts = doc.charts ?? [];
        const layouts = doc.layouts ?? {};
        const chartIds = charts.map((c) => c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
        const chartsWithIds = charts.map((c, idx) => ({
          ...c,
          id: c.id || chartIds[idx],
        }));
        const validLayouts = normalizeLayouts(layouts, chartIds);
        dispatch(loadDashboard({ charts: chartsWithIds, layouts: validLayouts }));
        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) setStatus('error');
      });

    return () => { cancelled = true; };
  }, [id, dispatch]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Dashboard not found or failed to load.</p>
        <a href="/bi-dashboard">Back to Dashboard</a>
      </div>
    );
  }

  return <BiDashboard />;
};

export default DashboardByIdPage;
