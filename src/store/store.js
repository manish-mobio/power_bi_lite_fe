/**
 * Power BI Lite - Redux Store Configuration
 * Using next-redux-wrapper for Next.js SSR support
 */
import { configureStore } from '@reduxjs/toolkit';
import { createWrapper } from 'next-redux-wrapper';
import rootReducer from './reducers';
import { DASHBOARD_ACTION_TYPES } from '@/store/actionTypes/dashboardActionTypes';

const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [
            DASHBOARD_ACTION_TYPES.SET_LAYOUTS,
            DASHBOARD_ACTION_TYPES.LOAD_DASHBOARD,
          ],
        },
      }),
    devTools: process.env.NODE_ENV !== 'production',
  });
};

export const wrapper = createWrapper(makeStore);
