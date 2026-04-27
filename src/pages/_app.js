/**
 * Power BI Lite - Next.js App Entry Point
 * Wraps app with Redux Provider using next-redux-wrapper
 */
import React from 'react';
import { wrapper } from '@/store/ReduxProvider';
import '@/styles/global.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default wrapper.withRedux(MyApp);
