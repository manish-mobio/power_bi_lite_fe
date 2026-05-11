import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { AUTH_UI } from '@/utils/messages';
import { isHttpSuccessStatus } from '@/utils/statusCode';
import { loginRequest } from '@/services/authService';
import {
  errorMessage,
  infoMessage,
  successMessage,
} from '@/utils/commonFunctions';
import authForm from '../styles/AuthForm.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (router.query?.signup === 'success') {
      infoMessage(AUTH_UI.SIGNUP_SUCCESS_LOGIN_REQUIRED);
    }
  }, [router.query?.signup]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await loginRequest({ email, password });
      const data =
        res.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : {};
      if (!isHttpSuccessStatus(res.status)) {
        errorMessage(data?.error || AUTH_UI.LOGIN_FAILED);
        setIsSubmitting(false);
        return;
      }
      successMessage(AUTH_UI.LOGIN_SUCCESS);
      const redirect = router.query?.redirect;
      const target =
        typeof redirect === 'string' && redirect.trim()
          ? redirect
          : '/bi-dashboard';
      await router.replace(target);
    } catch (err) {
      errorMessage(err.message || AUTH_UI.LOGIN_FAILED);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={authForm.authContainer}>
      <form onSubmit={onSubmit} className={authForm.authCard}>
        <h2 className={authForm.authTitle}>Log in</h2>
        <p className={authForm.authSubtitle}>
          Welcome back! Please enter your details.
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

        <label className={authForm.inputLabel}>Password</label>
        <div className={authForm.passwordWrap}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            required
            disabled={isSubmitting}
            autoComplete='current-password'
            className={authForm.passwordInput}
            placeholder='Enter your password'
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

        <button
          type='submit'
          className={authForm.submitBtn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={authForm.btnSpinner} aria-hidden />
              Signing you in…
            </>
          ) : (
            'Log in'
          )}
        </button>

        <div className={authForm.authLinks}>
          <Link href='/forgot-password' className={authForm.authLink}>
            Forgot password?
          </Link>
          <div>
            New here?{' '}
            <Link href='/signup' className={authForm.authLink}>
              Create an account
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
