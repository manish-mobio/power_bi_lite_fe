/**
 * Power BI Lite - Redux Store Configuration
 * Using next-redux-wrapper for Next.js SSR support
 */
import { configureStore } from '@reduxjs/toolkit';
import { createWrapper } from 'next-redux-wrapper';
import rootReducer from './reducers';

const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['dashboard/setLayouts', 'dashboard/loadDashboard'],
        },
      }),
    devTools: process.env.NODE_ENV !== 'production',
  });
};

export const wrapper = createWrapper(makeStore);
