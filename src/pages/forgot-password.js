import React, { useState } from 'react';
import Link from 'next/link';
import { AUTH_UI } from '@/utils/messages';
import { isHttpSuccessStatus } from '@/utils/statusCode';
import { forgotPasswordRequest } from '@/services/authService';
import { errorMessage, successMessage } from '@/utils/commonFunctions';
import authForm from '../styles/AuthForm.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await forgotPasswordRequest({ email });
      const data = res.data && typeof res.data === 'object' ? res.data : {};
      if (!isHttpSuccessStatus(res.status)) {
        errorMessage(data?.error || AUTH_UI.FORGOT_PASSWORD_FAILED);
        setIsSubmitting(false);
        return;
      }
      successMessage(data?.message || AUTH_UI.RESET_LINK_SENT);
      setIsSubmitting(false);
    } catch (err) {
      errorMessage(err.message || AUTH_UI.FORGOT_PASSWORD_FAILED);
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
          Forgot password
        </h2>
        <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type='email'
          required
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            marginBottom: 10,
          }}
        />
        <button
          type='submit'
          className={authForm.submitBtn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={authForm.btnSpinner} aria-hidden />
              Sending reset link...
            </>
          ) : (
            'Send reset link'
          )}
        </button>
        <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
          Back to <Link href='/login'>Log in</Link>
        </div>
      </form>
    </div>
  );
}
