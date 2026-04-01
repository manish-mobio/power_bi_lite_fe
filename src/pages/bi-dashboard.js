/**
 * Power BI Lite - Main Page
 */
import React, { useEffect, useState } from 'react';
import { BiDashboard } from '@/components/bi';
import { useRouter } from 'next/router';
import SessionLoadingScreen from '@/components/auth/SessionLoadingScreen';

const BiDashboardPage = () => {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        router.replace('/login');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return <SessionLoadingScreen />;
  }
  return <BiDashboard />;
};

export default BiDashboardPage;
