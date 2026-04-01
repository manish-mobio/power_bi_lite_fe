const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function proxyToBackend(req, res, { path, method }) {
  const url = `${getBackendUrl()}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
  };

  const upstream = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(req.body || {}),
  });

  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie);
  }

  const text = await upstream.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  res.status(upstream.status).json(json ?? {});
}
