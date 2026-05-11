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
    <div className={authForm.authContainer}>
      <form onSubmit={onSubmit} className={authForm.authCard}>
        <h2 className={authForm.authTitle}>Forgot password</h2>
        <p className={authForm.authSubtitle}>
          Enter your email to receive a reset link.
        </p>

        <label className={authForm.inputLabel}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type='email'
          required
          disabled={isSubmitting}
          className={authForm.authInput}
          placeholder='Enter your email'
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

        <div className={authForm.authLinks}>
          <div>
            Back to{' '}
            <Link href='/login' className={authForm.authLink}>
              Log in
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
