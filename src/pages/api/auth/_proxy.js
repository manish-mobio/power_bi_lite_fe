import axios from 'axios';
import { getBackendBaseUrl } from '@/services/http/backendClient';

export async function proxyToBackend(req, res, { path, method }) {
  const url = `${getBackendBaseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
  };

  const upstream = await axios.request({
    url,
    method,
    headers,
    data: method === 'GET' ? undefined : req.body || {},
    responseType: 'text',
    validateStatus: () => true,
  });

  const setCookie = upstream.headers['set-cookie'];
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie);
  }

  const text = upstream.data;
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  res.status(upstream.status).json(json ?? {});
}
