import { nextApi } from '@/services/http/nextApiClient';

export function getDashboardsList() {
  return nextApi.get('/api/bi/dashboards');
}

export function saveDashboard(payload) {
  return nextApi.post('/api/bi/dashboards', payload);
}

export function getDashboardById(id) {
  return nextApi.get(`/api/bi/dashboards/${id}`);
}

export function syncDashboard(dashboardId, payload = {}) {
  return nextApi.post(`/api/bi/dashboards/${dashboardId}/sync`, payload);
}

export function uploadBiFile(payload) {
  return nextApi.post('/api/bi/upload', payload, {
    timeout: 900000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
}

export function uploadGoogleDriveLink(payload, config = {}) {
  return nextApi.post('/api/bi/upload/google-drive-link', payload, config);
}

export function getUploadJob(jobId, config = {}) {
  return nextApi.get(
    `/api/bi/upload/jobs/${encodeURIComponent(String(jobId))}`,
    config
  );
}

export function postBiQuery(body) {
  return nextApi.post('/api/bi/query', body);
}

export function getBiSchema(collection) {
  return nextApi.get(
    `/api/bi/schema?collection=${encodeURIComponent(collection)}`
  );
}

export function getBiCollections() {
  return nextApi.get('/api/bi/collections');
}

export function shareDashboard(dashboardId, payload) {
  return nextApi.post(`/api/bi/dashboards/${dashboardId}/share`, payload);
}

export function replaceDashboardShares(dashboardId, payload) {
  return nextApi.put(`/api/bi/dashboards/${dashboardId}/share`, payload);
}

export function revokeDashboardShares(dashboardId) {
  return nextApi.delete(`/api/bi/dashboards/${dashboardId}/share`);
}
