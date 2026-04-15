/**
 * Power BI Lite - Main Page
 */
import React, { useEffect, useState } from 'react';
import { BiDashboard } from '@/components/bi';
import { useRouter } from 'next/router';
import SessionLoadingScreen from '@/components/auth/SessionLoadingScreen';
import { meRequest } from '@/services/authService';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';

const BiDashboardPage = () => {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    meRequest()
      .then((res) => {
        if (res.status === HTTP_STATUS.UNAUTHORIZED) {
          router.replace('/login');
          return null;
        }
        return isHttpSuccessStatus(res.status) ? res.data : null;
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
