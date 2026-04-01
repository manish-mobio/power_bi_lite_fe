import { proxyToBackend } from './_proxy';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = req.query?.email ? String(req.query.email) : '';
  const encoded = encodeURIComponent(email);
  return proxyToBackend(req, res, {
    path: `/api/v1/auth/users?email=${encoded}`,
    method: 'GET',
  });
}
