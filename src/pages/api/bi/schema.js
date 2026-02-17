/**
 * Power BI Lite - Schema API
 * Returns field schema for a collection (detects field types from sample data)
 */
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { collection } = req.query;
    if (!collection) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    // Fetch sample data from backend to infer schema
    let apiPath = `${getBackendUrl()}/api/v1/collection/${collection}`;
    let url = `${apiPath}?limit=10`;

    let response = await fetch(url);
    if (!response.ok && response.status === 404) {
      apiPath = collection
        ? `${getBackendUrl()}/api/v1/${collection}`
        : `${getBackendUrl()}/api/v1`;
      url = `${apiPath}?limit=10`;
      response = await fetch(url);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: `Collection "${collection}" not found` });
      }
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    let items = Array.isArray(data) ? data : data?.data || data?.results || [];
    if (!items.length && data && typeof data === 'object') {
      const key = Object.keys(data).find((k) => Array.isArray(data[k]));
      if (key) items = data[key];
    }

    if (!items.length) {
      return res.status(200).json([]);
    }

    // Infer schema from first record
    const sample = items[0];
    const schema = [];

    for (const [key, value] of Object.entries(sample)) {
      // Skip MongoDB internal fields
      if (key.startsWith('_') && key !== '_id') continue;
      if (key === '__v') continue;

      let type = 'string';
      if (value === null || value === undefined) {
        type = 'string'; // Default to string for null values
      } else if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
      } else if (Array.isArray(value)) {
        type = 'string'; // Arrays treated as string for now
      } else if (typeof value === 'object') {
        type = 'string'; // Objects treated as string for now
      }

      schema.push({ name: key, type });
    }

    return res.status(200).json(schema);
  } catch (error) {
    console.error('[BI Schema Error]', error);
    return res.status(500).json({
      error: 'Failed to fetch schema',
      details: error.message,
    });
  }
}
