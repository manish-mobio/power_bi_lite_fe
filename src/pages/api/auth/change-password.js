import { proxyToBackend } from './_proxy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return proxyToBackend(req, res, {
    path: '/api/v1/auth/change-password',
    method: 'POST',
  });
}
