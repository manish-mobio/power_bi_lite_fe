import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { AUTH_UI } from '@/utils/messages';
import { isHttpSuccessStatus } from '@/utils/statusCode';
import { signupRequest } from '@/services/authService';
import { errorMessage } from '@/utils/commonFunctions';
import authForm from '../styles/AuthForm.module.css';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await signupRequest({ name, email, password });
      const data =
        res.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : {};
      if (!isHttpSuccessStatus(res.status)) {
        errorMessage(data?.error || AUTH_UI.SIGNUP_FAILED);
        setIsSubmitting(false);
        return;
      }
      await router.replace('/login?signup=success');
    } catch (err) {
      errorMessage(err.message || AUTH_UI.SIGNUP_FAILED);
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
          Sign up
        </h2>
        <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>
          Name (optional)
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          type='text'
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            marginBottom: 10,
          }}
        />
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
        <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>
          Password
        </label>
        <div className={authForm.passwordWrap}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            disabled={isSubmitting}
            autoComplete='new-password'
            className={authForm.passwordInput}
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
              Creating your account…
            </>
          ) : (
            'Create account'
          )}
        </button>
        <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
          Already have an account? <Link href='/login'>Log in</Link>
        </div>
      </form>
    </div>
  );
}
