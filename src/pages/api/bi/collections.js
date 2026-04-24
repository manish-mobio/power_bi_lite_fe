/**
 * Power BI Lite - Collections List API
 * Returns list of all available collections
 */
import axios from 'axios';
import { API_MSG, FORMAT_BACKEND_ERROR_STATUS } from '@/utils/messages';
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
    const url = `${getBackendBaseUrl}${ApiVersion}/collections`;

    const response = await axios.get(url, { validateStatus: () => true });

    if (!isHttpSuccessStatus(response.status)) {
      throw new Error(FORMAT_BACKEND_ERROR_STATUS(response.status));
    }

    const collections = response.data;
    return res
      .status(HTTP_STATUS.OK)
      .json(Array.isArray(collections) ? collections : []);
  } catch (error) {
    console.error('BI Collections Error manish', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: API_MSG.FAILED_FETCH_COLLECTIONS,
      details: error.message,
    });
  }
}
