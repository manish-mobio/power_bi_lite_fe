import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  AiOutlineDown,
  AiOutlineLogout,
  AiOutlinePicture,
  AiOutlineLock,
  AiOutlineDelete,
  AiOutlineEye,
  AiOutlineEyeInvisible,
} from 'react-icons/ai';
import { AUTH_UI } from '@/utils/messages';
import { isHttpSuccessStatus } from '@/utils/statusCode';
import { changePasswordRequest } from '@/services/authService';
import { errorMessage, successMessage } from '@/utils/commonFunctions';
import authForm from '@/styles/AuthForm.module.css';
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    if (String(currentPassword) === String(newPassword)) {
      setPwdError(AUTH_UI.PASSWORD_DIFFERENT);
      setPwdSubmitting(false);
      return;
    }
    if (newPassword.length < 8) {
      setPwdError(AUTH_UI.PASSWORD_MIN_LENGTH);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError(AUTH_UI.PASSWORDS_NO_MATCH);
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await changePasswordRequest({ currentPassword, newPassword });
      const data =
        res.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : {};
      if (!isHttpSuccessStatus(res.status)) {
        const msg = data?.error || AUTH_UI.PASSWORD_UPDATE_FAILED;
        setPwdError(msg);
        errorMessage(msg);
        setPwdSubmitting(false);
        return;
      }
      successMessage(AUTH_UI.PASSWORD_UPDATE_SUCCESS);
      closePwdModal();
      setOpen(false);
    } catch (err) {
      const msg = err.message || AUTH_UI.PASSWORD_UPDATE_FAILED;
      setPwdError(msg);
      errorMessage(msg);
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
              <div className={authForm.passwordWrap}>
                <input
                  id='profile-current-pwd'
                  type={showCurrentPassword ? 'text' : 'password'}
                  autoComplete='current-password'
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className={authForm.passwordInput}
                />
                <button
                  type='button'
                  className={authForm.togglePwd}
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  aria-label={
                    showCurrentPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showCurrentPassword ? (
                    <AiOutlineEyeInvisible size={20} aria-hidden />
                  ) : (
                    <AiOutlineEye size={20} aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor='profile-new-pwd'>New password</label>
              <div className={authForm.passwordWrap}>
                <input
                  id='profile-new-pwd'
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete='new-password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className={authForm.passwordInput}
                />
                <button
                  type='button'
                  className={authForm.togglePwd}
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={
                    showNewPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showNewPassword ? (
                    <AiOutlineEyeInvisible size={20} aria-hidden />
                  ) : (
                    <AiOutlineEye size={20} aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor='profile-confirm-pwd'>Confirm new password</label>
              <div className={authForm.passwordWrap}>
                <input
                  id='profile-confirm-pwd'
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete='new-password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={authForm.passwordInput}
                />
                <button
                  type='button'
                  className={authForm.togglePwd}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showConfirmPassword ? (
                    <AiOutlineEyeInvisible size={20} aria-hidden />
                  ) : (
                    <AiOutlineEye size={20} aria-hidden />
                  )}
                </button>
              </div>
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
