/**
 * Power BI Lite - File Upload API
 * Proxies file upload to backend upload endpoint (see ApiVersion).
 */
import axios from 'axios';
import { API_MSG, FORMAT_BACKEND_ERROR_STATUS } from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  try {
    const { fileName, fileContent, fileType, collectionName } = req.body;

    if (!fileContent) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: API_MSG.FILE_CONTENT_REQUIRED });
    }

    const backendUrl = `${getBackendBaseUrl}${ApiVersion}/upload`;
    const response = await axios.post(
      backendUrl,
      {
        fileName,
        fileContent,
        fileType,
        collectionName,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      }
    );

    if (!isHttpSuccessStatus(response.status)) {
      const errorData =
        response.data &&
        typeof response.data === 'object' &&
        !Array.isArray(response.data)
          ? response.data
          : { error: FORMAT_BACKEND_ERROR_STATUS(response.status) };
      return res.status(response.status).json(errorData);
    }

    const result = response.data;

    return res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    console.error('[BI Upload Error]', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: API_MSG.FAILED_UPLOAD_FILE,
      details: error.message,
    });
  }
}
