/**
 * Power BI Lite - Dashboard Persistence API
 * Saves/loads ChartConfig array to backend (dashboards collection)
 */
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const DASHBOARDS_ENDPOINT = () => `${getBackendUrl()}/api/v1/dashboards`;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const response = await fetch(DASHBOARDS_ENDPOINT(), {
        headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
      });
      if (response.status === 401)
        return res.status(401).json({ error: 'Unauthorized' });
      if (!response.ok) return res.status(200).json([]);
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : data?.data ?? data?.dashboards ?? [];
      return res.status(200).json(list);
    } catch (error) {
      console.error('[BI Dashboards GET]', error);
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { name = 'My Dashboard', charts = [], layouts = {}, logo } = body;

      const payload = {
        name,
        charts,
        layouts,
        ...(logo != null && typeof logo === 'string' ? { logo } : {}),
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(DASHBOARDS_ENDPOINT(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401)
        return res.status(401).json({ error: 'Unauthorized' });
      if (!response.ok) throw new Error(`Backend error: ${response.status}`);
      const result = await response.json();
      return res.status(200).json(result);
    } catch (error) {
      console.error('[BI Dashboards POST]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
