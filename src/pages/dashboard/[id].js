/**
 * Power BI Lite - Shareable Dashboard Page
 * Loads a saved dashboard by ID and renders the full dashboard.
 * This page makes the "Save dashboard" share link work (e.g. /dashboard/abc123).
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { loadDashboard } from '@/store/reducers/dashboardReducer';
import { BiDashboard } from '@/components/bi';

function buildLayoutsAndCharts(dashboard) {
  const cfg = dashboard?.charts ?? [];
  if (!Array.isArray(cfg) || cfg.length === 0) {
    return { chartsWithIds: [], validLayouts: {} };
  }

  const chartIds = cfg.map(
    (c) =>
      c.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const validLayouts = {};

  if (dashboard?.layouts?.lg && Array.isArray(dashboard.layouts.lg)) {
    const savedLg = dashboard.layouts.lg;
    const hasValidSaved =
      savedLg.length === chartIds.length &&
      chartIds.every((id) => savedLg.some((item) => item.i === id));

    if (hasValidSaved) {
      validLayouts.lg = savedLg;
      validLayouts.md =
        dashboard.layouts.md || savedLg.map((l) => ({ ...l, w: 5 }));
      validLayouts.sm =
        dashboard.layouts.sm || savedLg.map((l) => ({ ...l, w: 6 }));
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

  const collection =
    (chartsWithIds[0] && chartsWithIds[0].collection) ||
    dashboard?.collection ||
    '';

  return { chartsWithIds, validLayouts, collection };
}

export default function SharedDashboardPage() {
  const router = useRouter();
  const { id } = router.query;
  const dispatch = useDispatch();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'notfound'
  const [errorMessage, setErrorMessage] = useState('');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          router.replace(
            `/login?redirect=${encodeURIComponent(`/dashboard/${id}`)}`
          );
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((me) => {
        if (!cancelled && me) setAuthed(true);
      })
      .catch(() => {
        router.replace(
          `/login?redirect=${encodeURIComponent(`/dashboard/${id}`)}`
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    if (!id || !authed) return;

    let cancelled = false;

    fetch(`/api/bi/dashboards/${id}`)
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) {
            setStatus('notfound');
            setErrorMessage('Dashboard not found');
          }
          return null;
        }
        if (!res.ok) throw new Error(`Failed to load dashboard: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled || data == null) return;

        const { chartsWithIds, validLayouts, collection } =
          buildLayoutsAndCharts(data);

        if (chartsWithIds.length === 0) {
          setStatus('notfound');
          setErrorMessage('This dashboard has no charts');
          return;
        }

        dispatch(
          loadDashboard({
            charts: chartsWithIds,
            layouts: validLayouts,
            collection: collection || '',
          })
        );
        try {
          localStorage.setItem(
            'powerbi-active-dashboard-meta',
            JSON.stringify({
              id: String(id),
              effectiveRole: data?.effectiveRole || null,
            })
          );
        } catch {
          /* ignore */
        }
        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(err.message || 'Failed to load dashboard');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, authed, dispatch]);

  // Still loading or waiting for id
  if (!id || status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid #e2e8f0',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p>Loading dashboard…</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <h1 style={{ fontSize: 24, color: '#1e293b', marginBottom: 8 }}>
            {status === 'notfound'
              ? 'Dashboard not found'
              : 'Something went wrong'}
          </h1>
          <p style={{ color: '#64748b', marginBottom: 24 }}>{errorMessage}</p>
          <Link
            href='/bi-dashboard'
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#667eea',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <BiDashboard />;
}
