/**
 * Power BI Lite - Schema API
 * Returns field schema for a collection (detects field types from sample data)
 */
import axios from 'axios';
import {
  API_MSG,
  FORMAT_BACKEND_ERROR_STATUS,
  FORMAT_COLLECTION_NOT_FOUND,
} from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  try {
    const { collection } = req.query;
    if (!collection) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: API_MSG.COLLECTION_NAME_REQUIRED });
    }

    // Fetch sample data from backend to infer schema
    let apiPath = `${getBackendBaseUrl}${ApiVersion}/collection/${collection}`;
    let url = `${apiPath}?limit=10`;

    let response = await axios.get(url, { validateStatus: () => true });
    if (
      !isHttpSuccessStatus(response.status) &&
      response.status === HTTP_STATUS.NOT_FOUND
    ) {
      apiPath = collection
        ? `${getBackendBaseUrl}${ApiVersion}/${collection}`
        : `${getBackendBaseUrl}${ApiVersion}`;
      url = `${apiPath}?limit=10`;
      response = await axios.get(url, { validateStatus: () => true });
    }

    if (!isHttpSuccessStatus(response.status)) {
      if (response.status === HTTP_STATUS.NOT_FOUND) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: FORMAT_COLLECTION_NOT_FOUND(collection),
        });
      }
      throw new Error(FORMAT_BACKEND_ERROR_STATUS(response.status));
    }

    const data = response.data;
    let items = Array.isArray(data) ? data : data?.data || data?.results || [];
    if (!items.length && data && typeof data === 'object') {
      const key = Object.keys(data).find((k) => Array.isArray(data[k]));
      if (key) items = data[key];
    }

    // Fetch record count from metadata endpoint first (so we always have it)
    let recordCount = null;
    try {
      const metaUrl = `${getBackendBaseUrl}${ApiVersion}/collection/${collection}/meta`;
      const metaResponse = await axios.get(metaUrl, {
        validateStatus: () => true,
      });
      if (isHttpSuccessStatus(metaResponse.status)) {
        const metaData = metaResponse.data;
        recordCount =
          metaData.recordCount != null ? metaData.recordCount : null;
      }
    } catch (metaError) {
      // Metadata endpoint might not exist on older backends
      console.log(
        '[BI Schema] Metadata endpoint not available:',
        metaError.message
      );
    }

    if (!items.length) {
      // Return fields array and recordCount so UI can show count even with no sample
      if (recordCount !== null) {
        return res.status(HTTP_STATUS.OK).json({ fields: [], recordCount });
      }
      return res.status(HTTP_STATUS.OK).json([]);
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
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !Number.isNaN(Date.parse(trimmed))) type = 'date';
      }
      if (type === 'string' && /date|time|created|updated|at$/i.test(key)) {
        type = 'date';
      }

      schema.push({ name: key, type });
    }

    // Always return object with recordCount when we have it
    if (recordCount !== null) {
      return res.status(HTTP_STATUS.OK).json({ fields: schema, recordCount });
    }
    return res.status(HTTP_STATUS.OK).json(schema);
  } catch (error) {
    console.error('[BI Schema Error]', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: API_MSG.FAILED_FETCH_SCHEMA,
      details: error.message,
    });
  }
}
