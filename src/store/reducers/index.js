/**
 * Power BI Lite - Root Reducer
 * Combines all reducers
 */
import { combineReducers } from '@reduxjs/toolkit';
import dashboardReducer from './dashboardReducer';

const rootReducer = combineReducers({
  dashboard: dashboardReducer,
});

export default rootReducer;
