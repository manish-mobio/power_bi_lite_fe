/**
 * Power BI Lite - Shareable Dashboard Page
 * Loads a saved dashboard by ID and renders the full dashboard.
 * This page makes the "Save dashboard" share link work (e.g. /dashboard/abc123).
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { fetchAndLoadDashboardById } from '@/store/actions/dashboardActions';
import { BiDashboard } from '@/components/bi';
import { DASHBOARD_PAGE_UI } from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { meRequest } from '@/services/authService';

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
    meRequest()
      .then((r) => {
        if (r.status === HTTP_STATUS.UNAUTHORIZED) {
          router.replace(
            `/login?redirect=${encodeURIComponent(`/dashboard/${id}`)}`
          );
          return null;
        }
        return isHttpSuccessStatus(r.status) ? r.data : null;
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

    Promise.resolve(dispatch(fetchAndLoadDashboardById(id)))
      .then((data) => {
        if (cancelled || data == null) return;
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
          setErrorMessage(err.message || DASHBOARD_PAGE_UI.LOAD_FAILED);
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
          <p>{DASHBOARD_PAGE_UI.LOADING}</p>
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
              ? DASHBOARD_PAGE_UI.NOT_FOUND_DETAIL
              : DASHBOARD_PAGE_UI.ERROR_TITLE}
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
            {DASHBOARD_PAGE_UI.BACK_TO_DASHBOARD}
          </Link>
        </div>
      </div>
    );
  }

  return <BiDashboard />;
}
