/**
 * Centralized API response errors and user-visible status / validation copy.
 * Keys use UPPER_SNAKE_CASE (aligned with backend constants).
 */

export const API_MSG = {
  METHOD_NOT_ALLOWED: 'Method not allowed',
  UNAUTHORIZED: 'Unauthorized',
  DASHBOARD_ID_REQUIRED: 'Dashboard id is required',
  COLLECTION_NAME_REQUIRED: 'Collection name is required',
  FILE_CONTENT_REQUIRED: 'File content is required',
  FAILED_FETCH_COLLECTIONS: 'Failed to fetch collections',
  FAILED_UPLOAD_FILE: 'Failed to upload file',
  FAILED_EXECUTE_QUERY: 'Failed to execute query',
  FAILED_FETCH_SCHEMA: 'Failed to fetch schema',
  INVALID_CONFIG_COLLECTION: 'Invalid config: requires collection',
  INVALID_CONFIG_CHART_FIELDS:
    'Invalid config: non-table charts require dimension and measure',
  REQUEST_FAILED: 'Request failed',
  SHARE_FAILED: 'Share failed',
  SYNC_FAILED: 'Sync failed',
};

export const FORMAT_COLLECTION_NOT_FOUND = (collection) =>
  `Collection "${collection}" not found`;

export const FORMAT_BACKEND_ERROR_STATUS = (status) =>
  `Backend error: ${status}`;

export const AUTH_UI = {
  LOGIN_FAILED: 'Login failed',
  LOGIN_SUCCESS: 'Login successful',
  SIGNUP_FAILED: 'Signup failed',
  SIGNUP_SUCCESS_LOGIN_REQUIRED: 'Account created successfully. Please log in.',
  FORGOT_PASSWORD_FAILED: 'Failed to send reset link',
  RESET_PASSWORD_FAILED: 'Failed to reset password',
  RESET_LINK_SENT: 'Reset link sent to your email',
  INVALID_RESET_TOKEN: 'Invalid reset token',
  PASSWORD_RESET_SUCCESS: 'Password reset successful. Redirecting to login...',
  PASSWORD_DIFFERENT: 'Current and new passwords must be different.',
  PASSWORD_MIN_LENGTH: 'New password must be at least 8 characters.',
  PASSWORDS_NO_MATCH: 'New passwords do not match.',
  PASSWORD_UPDATE_FAILED: 'Could not update password',
  PASSWORD_UPDATE_SUCCESS: 'Password updated successfully',
};

export const SHARE_UI = {
  SHARE_DASHBOARD_FAILED: 'Failed to share dashboard',
};

export const FIELD_LIST_UI = {
  FAILED_LOAD_SCHEMA: 'Failed to load schema',
  COLLECTION_NOT_FOUND_OR_SERVER: 'Collection not found or server error',
};

export const FORMAT_FIELD_LIST_NON_JSON_ERROR = (status, statusText) =>
  `Server returned ${status}: ${statusText}. Collection may not exist.`;

export const CHART_UI = {
  FAILED_TO_FETCH: 'Failed to fetch',
};

export const VIEW_DATA_UI = {
  FAILED_TO_LOAD_DATA: 'Failed to load data',
};

export const DASHBOARD_PAGE_UI = {
  LOADING: 'Loading dashboard…',
  ERROR_TITLE: 'Something went wrong',
  BACK_TO_DASHBOARD: 'Back to Dashboard',
  NOT_FOUND_DETAIL: 'Dashboard not found',
  NO_CHARTS: 'This dashboard has no charts',
  LOAD_FAILED: 'Failed to load dashboard',
};

export const FORMAT_FAILED_LOAD_DASHBOARD = (status) =>
  `Failed to load dashboard: ${status}`;

export const BI_UI = {
  EXPORT_AREA_NOT_FOUND: 'Export area not found',
  NO_TABLE_DATA_FOR_PDF: 'No table data found',
  INVALID_FILE_FORMAT: 'Invalid file format. Please upload JSON or CSV file.',
  UPLOADING_FILE: 'Uploading and parsing file...',
  DASHBOARD_LOADED_OK: 'Dashboard loaded successfully',
  UPLOAD_FAILED: 'Upload failed',
  UPLOAD_NO_COLLECTION: 'Upload successful, but collection name not returned',
  SELECT_COLLECTION_FIRST: 'Please select a collection first',
  NO_CHANGES_TO_SAVE: 'No changes to save',
  SAVING: 'Saving...',
  SAVED: 'Saved',
  SAVED_LOCAL: 'Saved (local)',
  EDITORS_ONLY_SHARE: 'Only editors can share',
  LOADED: 'Loaded',
  LOAD_FAILED: 'Load failed',
  LOADED_FROM_SERVER: 'Loaded from server',
  NO_SAVED_DASHBOARD: 'No saved dashboard',
  LOADING: 'Loading...',
  DASHBOARD_NOT_FOUND: 'Dashboard not found',
  NO_CHARTS_IN_DASHBOARD: 'No charts in this dashboard',
  PREPARING_PRINT: 'Preparing print...',
  CANVAS_NOT_FOUND: 'Canvas not found',
  POPUP_BLOCKED: 'Popup blocked — allow popups and try again',
  PRINT_DIALOG_OPENED: 'Print dialog opened',
  PRINT_FAILED: 'Print failed',
  JSON_DOWNLOADED: 'JSON downloaded',
  GENERATING_PDF: 'Generating PDF...',
  PDF_EXPORT_FAILED: 'PDF export failed',
  SHARED_OK: 'Dashboard shared successfully',
  LOGOUT_SUCCESS: 'Logged out successfully',
  LOGOUT_REDIRECT_LOGIN: 'Session ended. Redirecting to login.',
  READ_ONLY_EDITING_DISABLED: 'Read-only access (Viewer): editing is disabled',
  READ_ONLY_CANNOT_SAVE: 'Read-only access (Viewer): cannot save',
  READ_ONLY_CANNOT_LOAD_CONFIGURATION:
    'Read-only access (Viewer): cannot load another configuration',
  READ_ONLY_CANNOT_SWITCH_DASHBOARD:
    'Read-only access (Viewer): cannot switch dashboards',
  PLAYGROUND_CLEARED: 'Playground cleared',
  LOAD_OR_SAVE_DASHBOARD_FIRST: 'Load or save a dashboard first',
  SYNCING_LATEST: 'Syncing latest…',
  NO_CHARTS_IN_SYNCED_DASHBOARD: 'No charts in synced dashboard',
  SYNC_FAILED: 'Sync failed',
};

export const FORMAT_UPLOAD_ERROR = (message) =>
  `Error uploading file: ${message}`;

export const FORMAT_UPLOAD_REPLACED = (collection, recordCount) =>
  `Replaced "${collection}" with ${recordCount} records`;

export const FORMAT_UPLOAD_NEW = (recordCount, collection) =>
  `Uploaded ${recordCount} records to "${collection}"`;

export const FORMAT_PDF_BUILDING_CHARTS = (count) =>
  `Found ${count} chart(s) — building PDF...`;

export const FORMAT_PDF_DOWNLOADED_CHARTS = (count) =>
  `✓ PDF downloaded — ${count} chart(s)`;

export const FORMAT_PDF_DOWNLOADED_RECORDS = (count) =>
  `✓ PDF downloaded — ${count.toLocaleString()} records`;

export const FORMAT_FAILED_LOAD_BY_ID = (status) => `Failed to load: ${status}`;
