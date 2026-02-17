/**
 * Power BI Lite - File Upload API
 * Proxies file upload to backend /api/v1/upload endpoint
 */
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, fileContent, fileType, collectionName } = req.body;

    if (!fileContent) {
      return res.status(400).json({ error: 'File content is required' });
    }

    const backendUrl = `${getBackendUrl()}/api/v1/upload`;
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        fileContent,
        fileType,
        collectionName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Backend error: ${response.status}` }));
      return res.status(response.status).json(errorData);
    }

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    console.error('[BI Upload Error]', error);
    return res.status(500).json({
      error: 'Failed to upload file',
      details: error.message,
    });
  }
}
