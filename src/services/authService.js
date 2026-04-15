import { nextApi } from '@/services/http/nextApiClient';

export function loginRequest({ email, password }) {
  return nextApi.post('/api/auth/login', { email, password });
}

export function signupRequest({ name, email, password }) {
  return nextApi.post('/api/auth/signup', { name, email, password });
}

export function meRequest() {
  return nextApi.get('/api/auth/me');
}

export function logoutRequest() {
  return nextApi.post('/api/auth/logout');
}

export function changePasswordRequest({ currentPassword, newPassword }) {
  return nextApi.post('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

export function searchUsersRequest(q) {
  return nextApi.get(`/api/auth/search-users?email=${encodeURIComponent(q)}`);
}
