import React from 'react';
import styles from './SessionLoadingScreen.module.css';

export default function SessionLoadingScreen({
  title = 'Verifying your session',
  subtitle = 'Please wait while we secure your workspace…',
}) {
  return (
    <div
      className={styles.root}
      role='status'
      aria-live='polite'
      aria-busy='true'
    >
      <div className={styles.inner}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.title}>{title}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>
  );
}
