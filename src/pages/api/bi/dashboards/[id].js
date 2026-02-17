/**
 * Power BI Lite - Get single dashboard by ID (for shareable links)
 */
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Dashboard ID required' });
  }

  try {
    const url = `${getBackendUrl()}/api/v1/dashboards/${id}`;
    const response = await fetch(url);
    if (response.status === 404) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('[BI Dashboard GET by id]', error);
    return res.status(500).json({ error: error.message });
  }
}
