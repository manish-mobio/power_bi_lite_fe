/**
 * Backend origin (no trailing path). Same as legacy `getBackendUrl()` used by auth proxy.
 * @type {string|undefined}
 */
export const getBackendBaseUrl = process.env.NEXT_PUBLIC_API_URL;
