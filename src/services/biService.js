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

export function uploadBiFile(payload) {
  return nextApi.post('/api/bi/upload', payload);
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
