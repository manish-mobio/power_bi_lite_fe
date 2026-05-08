import axios from 'axios';
import { API_MSG, FORMAT_BACKEND_ERROR_STATUS } from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  try {
    const backendUrl = `${getBackendBaseUrl}${ApiVersion}/upload/google-drive-link`;
    const response = await axios.post(backendUrl, req.body || {}, {
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
      validateStatus: () => true,
    });

    if (!isHttpSuccessStatus(response.status)) {
      const errorData =
        response.data &&
        typeof response.data === 'object' &&
        !Array.isArray(response.data)
          ? response.data
          : { error: FORMAT_BACKEND_ERROR_STATUS(response.status) };
      return res.status(response.status).json(errorData);
    }

    return res.status(response.status).json(response.data);
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: API_MSG.FAILED_UPLOAD_FILE,
      details: error.message,
    });
  }
}
