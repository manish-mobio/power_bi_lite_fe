import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  getDashboardById,
  replaceDashboardShares,
  revokeDashboardShares,
  shareDashboard,
} from '@/services/biService';
import { isHttpSuccessStatus } from '@/utils/statusCode';
import { loadingMessage, updateMessage } from '@/utils/commonFunctions';
import styles from './DashboardAccessModal.module.css';
import { normalizeSharedUser } from '@/utils/dashboard';

async function replaceSharesWithFallback(dashboardId, shares) {
  try {
    return await replaceDashboardShares(dashboardId, {
      shares,
      replaceExisting: true,
      mode: 'replace',
    });
  } catch {
    return shareDashboard(dashboardId, {
      shares,
      replaceExisting: true,
      mode: 'replace',
    });
  }
}

async function revokeSharesWithFallback(dashboardId) {
  try {
    return await revokeDashboardShares(dashboardId);
  } catch {
    return replaceSharesWithFallback(dashboardId, []);
  }
}

export default function DashboardAccessModal({
  open,
  dashboardId,
  dashboardName,
  startInRevokeConfirm = false,
  onClose,
  onAccessUpdated,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const shareCount = users.length;

  useEffect(() => {
    if (!open || !dashboardId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setConfirmRevokeAll(Boolean(startInRevokeConfirm));

    getDashboardById(dashboardId)
      .then((res) => {
        if (cancelled) return;
        if (!isHttpSuccessStatus(res.status)) {
          throw new Error('Failed to load access list');
        }
        const data = res?.data || {};
        const sharedWith = Array.isArray(data?.sharedWith)
          ? data.sharedWith
          : [];
        setUsers(sharedWith.map(normalizeSharedUser));
      })
      .catch((e) => {
        if (!cancelled) {
          setUsers([]);
          setError(e?.message || 'Failed to load access list');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, dashboardId, startInRevokeConfirm]);

  const emptyState = useMemo(() => {
    if (loading) return 'Loading access list...';
    if (error) return error;
    return 'This dashboard is not shared with anyone right now.';
  }, [loading, error]);

  const removeUser = async (userId) => {
    if (!dashboardId || saving) return;
    const nextUsers = users.filter((user) => user.userId !== String(userId));
    setSaving(true);
    setError('');
    loadingMessage('Updating dashboard access...', 'dashboard-access');
    try {
      const res = await replaceSharesWithFallback(
        dashboardId,
        nextUsers.map((user) => ({
          userId: user.userId,
          email: user.email || undefined,
          role: user.role,
        }))
      );
      if (!isHttpSuccessStatus(res.status)) {
        throw new Error(
          res?.data?.error || 'Could not remove this user from the dashboard'
        );
      }
      setUsers(nextUsers);
      updateMessage({
        type: 'success',
        text: 'Access updated',
        key: 'dashboard-access',
        duration: 2,
      });
      onAccessUpdated?.();
    } catch (e) {
      setError(e?.message || 'Could not update dashboard access');
      updateMessage({
        type: 'error',
        text: e?.message || 'Could not update dashboard access',
        key: 'dashboard-access',
        duration: 3,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!dashboardId || saving) return;
    setSaving(true);
    setError('');
    loadingMessage('Stopping sharing for all users...', 'dashboard-access');
    try {
      const res = await revokeSharesWithFallback(dashboardId);
      if (!isHttpSuccessStatus(res.status)) {
        throw new Error(res?.data?.error || 'Could not stop sharing');
      }
      setUsers([]);
      setConfirmRevokeAll(false);
      updateMessage({
        type: 'success',
        text: 'Sharing removed for all users',
        key: 'dashboard-access',
        duration: 2,
      });
      onAccessUpdated?.();
    } catch (e) {
      setError(e?.message || 'Could not stop sharing');
      updateMessage({
        type: 'error',
        text: e?.message || 'Could not stop sharing',
        key: 'dashboard-access',
        duration: 3,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-labelledby='dashboard-access-title'
      onClick={() => !saving && onClose?.()}
      onKeyDown={(e) => e.key === 'Escape' && !saving && onClose?.()}
      tabIndex={-1}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title} id='dashboard-access-title'>
              Manage access
            </h3>
            <p className={styles.subtitle}>
              {dashboardName || 'Dashboard'}{' '}
              {shareCount > 0
                ? `is shared with ${shareCount} user${shareCount === 1 ? '' : 's'}.`
                : 'has no active collaborators.'}
            </p>
          </div>
          <button
            type='button'
            className={styles.closeBtn}
            onClick={() => onClose?.()}
            disabled={saving}
            aria-label='Close'
          >
            X
          </button>
        </div>

        <div className={styles.ownerBanner}>
          <span className={styles.ownerBadge}>Owner</span>
          <span className={styles.ownerText}>
            You can remove individual users or stop sharing for everyone.
          </span>
        </div>

        {confirmRevokeAll ? (
          <div className={styles.confirmCard}>
            <div className={styles.confirmTitle}>
              Stop sharing with all users?
            </div>
            <div className={styles.confirmText}>
              Everyone except you will lose access to this dashboard
              immediately.
            </div>
            <div className={styles.confirmActions}>
              <button
                type='button'
                className={styles.secondaryBtn}
                onClick={() => setConfirmRevokeAll(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type='button'
                className={styles.dangerBtn}
                onClick={handleRevokeAll}
                disabled={saving}
              >
                {saving ? 'Stopping...' : 'Stop sharing'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.toolbar}>
            <div className={styles.countPill}>
              {shareCount} active {shareCount === 1 ? 'user' : 'users'}
            </div>
            <button
              type='button'
              className={styles.dangerGhostBtn}
              onClick={() => setConfirmRevokeAll(true)}
              disabled={saving || loading || shareCount === 0}
            >
              Stop sharing with all
            </button>
          </div>
        )}

        <div className={styles.listWrap}>
          {users.length === 0 ? (
            <div className={styles.emptyState}>{emptyState}</div>
          ) : (
            <div className={styles.userList}>
              {users.map((user) => (
                <div key={user.userId} className={styles.userRow}>
                  <div className={styles.userMeta}>
                    <div className={styles.userPrimary}>
                      {user.name || user.email || `User ${user.userId}`}
                    </div>
                    <div className={styles.userSecondary}>
                      {user.email || user.userId}
                    </div>
                  </div>
                  <div className={styles.userActions}>
                    <span className={styles.roleBadge}>
                      {user.role || 'Viewer'}
                    </span>
                    <button
                      type='button'
                      className={styles.removeBtn}
                      onClick={() => removeUser(user.userId)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.footer}>
          <button
            type='button'
            className={styles.secondaryBtn}
            onClick={() => onClose?.()}
            disabled={saving}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

DashboardAccessModal.propTypes = {
  open: PropTypes.bool,
  dashboardId: PropTypes.string,
  dashboardName: PropTypes.string,
  startInRevokeConfirm: PropTypes.bool,
  onClose: PropTypes.func,
  onAccessUpdated: PropTypes.func,
};
