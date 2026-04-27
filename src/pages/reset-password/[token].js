import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { AUTH_UI } from '@/utils/messages';
import { isHttpSuccessStatus } from '@/utils/statusCode';
import { resetPasswordRequest } from '@/services/authService';
import { errorMessage, successMessage } from '@/utils/commonFunctions';
import authForm from '../../styles/AuthForm.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      errorMessage(AUTH_UI.PASSWORDS_NO_MATCH);
      return;
    }

    const token = String(router.query?.token || '').trim();
    if (!token) {
      errorMessage(AUTH_UI.INVALID_RESET_TOKEN);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordRequest({ token, password });
      const data = res.data && typeof res.data === 'object' ? res.data : {};
      if (!isHttpSuccessStatus(res.status)) {
        errorMessage(data?.error || AUTH_UI.RESET_PASSWORD_FAILED);
        setIsSubmitting(false);
        return;
      }
      successMessage(data?.message || AUTH_UI.PASSWORD_RESET_SUCCESS);
      setIsSubmitting(false);
      setTimeout(() => {
        router.replace('/login');
      }, 1200);
    } catch (err) {
      errorMessage(err.message || AUTH_UI.RESET_PASSWORD_FAILED);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f8fafc',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 360,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 12, textAlign: 'center' }}>
          Reset password
        </h2>
        <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>
          New password
        </label>
        <div className={authForm.passwordWrap}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            minLength={8}
            required
            disabled={isSubmitting}
            className={authForm.passwordInput}
            style={{ marginBottom: 10 }}
          />
          <button
            type='button'
            className={authForm.togglePwd}
            onClick={() => setShowPassword((v) => !v)}
            disabled={isSubmitting}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {showPassword ? (
              <AiOutlineEyeInvisible size={20} aria-hidden />
            ) : (
              <AiOutlineEye size={20} aria-hidden />
            )}
          </button>
        </div>
        <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>
          Confirm password
        </label>
        <div className={authForm.passwordWrap}>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type={showConfirmPassword ? 'text' : 'password'}
            minLength={8}
            required
            disabled={isSubmitting}
            className={authForm.passwordInput}
          />
          <button
            type='button'
            className={authForm.togglePwd}
            onClick={() => setShowConfirmPassword((v) => !v)}
            disabled={isSubmitting}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {showConfirmPassword ? (
              <AiOutlineEyeInvisible size={20} aria-hidden />
            ) : (
              <AiOutlineEye size={20} aria-hidden />
            )}
          </button>
        </div>
        <button
          type='submit'
          className={authForm.submitBtn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={authForm.btnSpinner} aria-hidden />
              Resetting password...
            </>
          ) : (
            'Reset password'
          )}
        </button>
        <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
          Back to <Link href='/login'>Log in</Link>
        </div>
      </form>
    </div>
  );
}
