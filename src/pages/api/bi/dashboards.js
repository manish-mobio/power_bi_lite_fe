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
      const response = await fetch(DASHBOARDS_ENDPOINT());
      if (!response.ok) return res.status(200).json([]);
      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.data ?? data?.dashboards ?? [];
      return res.status(200).json(list);
    } catch (error) {
      console.error('[BI Dashboards GET]', error);
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { name = 'My Dashboard', charts = [], layouts = {} } = body;

      const payload = {
        name,
        charts,
        layouts,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(DASHBOARDS_ENDPOINT(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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
