/**
 * Power BI Lite - Collections List API
 * Returns list of all available collections
 */
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = `${getBackendUrl()}/api/v1/collections`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const collections = await response.json();
    return res.status(200).json(Array.isArray(collections) ? collections : []);
  } catch (error) {
    console.error('[BI Collections Error]', error);
    return res.status(500).json({
      error: 'Failed to fetch collections',
      details: error.message,
    });
  }
}
