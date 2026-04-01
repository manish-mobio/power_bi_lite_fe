import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  AiOutlineDown,
  AiOutlineLogout,
  AiOutlinePicture,
  AiOutlineLock,
  AiOutlineDelete,
} from 'react-icons/ai';
import styles from './ProfileBar.module.css';

function ProfileBar({
  user,
  loading,
  dashboardLogo,
  onSetDashboardImage,
  onClearDashboardImage,
  onLogoutClick,
}) {
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const closePwdModal = useCallback(() => {
    setPwdOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdError('');
    setPwdSubmitting(false);
  }, []);

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    if (String(currentPassword) === String(newPassword)) {
      setPwdError('Current and new passwords must be different.');
      setPwdSubmitting(false);
      return;
    }
    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwdError(data?.error || 'Could not update password');
        setPwdSubmitting(false);
        return;
      }
      closePwdModal();
      setOpen(false);
    } catch (err) {
      setPwdError(err.message || 'Could not update password');
      setPwdSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.skeleton} aria-hidden title='Loading profile' />
    );
  }

  const email = user?.email || '';
  const name = user?.name || '-';
  const display =
    user?.name?.trim() || (email ? email.split('@')[0] : 'Account');
  const initial = String(display || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type='button'
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup='true'
      >
        <div className={styles.avatar} aria-hidden>
          {initial}
        </div>
        <div className={styles.meta}>
          <div className={styles.displayName}>{display}</div>
          {email ? <div className={styles.emailLine}>{email}</div> : null}
        </div>
        <AiOutlineDown
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className={styles.menu} role='menu'>
          <div className={styles.menuHeader}>
            <div className={styles.menuHeaderLabel}>
              Signed in as ( {name} )
            </div>
            <div className={styles.menuHeaderEmail}>{email || '—'}</div>
          </div>
          <div className={styles.menuActions}>
            <button
              type='button'
              className={styles.menuBtn}
              role='menuitem'
              onClick={() => {
                setPwdOpen(true);
                setOpen(false);
              }}
            >
              <AiOutlineLock className={styles.menuIcon} aria-hidden />
              Change password
            </button>
            <button
              type='button'
              className={styles.menuBtn}
              role='menuitem'
              onClick={() => {
                onSetDashboardImage?.();
                setOpen(false);
              }}
            >
              <AiOutlinePicture className={styles.menuIcon} aria-hidden />
              Set dashboard image
            </button>
            {dashboardLogo && onClearDashboardImage ? (
              <button
                type='button'
                className={styles.menuBtn}
                role='menuitem'
                onClick={() => {
                  onClearDashboardImage();
                  setOpen(false);
                }}
              >
                <AiOutlineDelete className={styles.menuIcon} aria-hidden />
                Clear dashboard image
              </button>
            ) : null}
            <button
              type='button'
              className={`${styles.menuBtn} ${styles.menuBtnDanger}`}
              role='menuitem'
              onClick={() => {
                setOpen(false);
                onLogoutClick?.();
              }}
            >
              <AiOutlineLogout className={styles.menuIcon} aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}

      {pwdOpen && (
        <div
          className={styles.overlay}
          role='dialog'
          aria-modal='true'
          aria-labelledby='profile-change-pwd-title'
          onClick={closePwdModal}
          onKeyDown={(e) => e.key === 'Escape' && closePwdModal()}
        >
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitChangePassword}
          >
            <h3 id='profile-change-pwd-title'>Change password</h3>
            <div className={styles.field}>
              <label htmlFor='profile-current-pwd'>Current password</label>
              <input
                id='profile-current-pwd'
                type='password'
                autoComplete='current-password'
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor='profile-new-pwd'>New password</label>
              <input
                id='profile-new-pwd'
                type='password'
                autoComplete='new-password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor='profile-confirm-pwd'>Confirm new password</label>
              <input
                id='profile-confirm-pwd'
                type='password'
                autoComplete='new-password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {pwdError ? (
              <div className={styles.modalError}>{pwdError}</div>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type='button'
                className={styles.btnSecondary}
                onClick={closePwdModal}
                disabled={pwdSubmitting}
              >
                Cancel
              </button>
              <button
                type='submit'
                className={styles.btnPrimary}
                disabled={pwdSubmitting}
              >
                {pwdSubmitting ? (
                  <>
                    <span className={styles.btnSpinner} aria-hidden />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

ProfileBar.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    email: PropTypes.string,
    name: PropTypes.string,
  }),
  loading: PropTypes.bool,
  dashboardLogo: PropTypes.string,
  onSetDashboardImage: PropTypes.func,
  onClearDashboardImage: PropTypes.func,
  onLogoutClick: PropTypes.func,
};

ProfileBar.defaultProps = {
  user: null,
  loading: false,
  dashboardLogo: null,
  onSetDashboardImage: undefined,
  onClearDashboardImage: undefined,
  onLogoutClick: undefined,
};

export default ProfileBar;
