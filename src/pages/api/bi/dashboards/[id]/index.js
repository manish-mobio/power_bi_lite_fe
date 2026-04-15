import axios from 'axios';
import { API_MSG } from '@/utils/messages';
import HTTP_STATUS from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';

export default async function handler(req, res) {
  const { id } = req.query || {};
  if (!id) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ error: API_MSG.DASHBOARD_ID_REQUIRED });
  }

  if (req.method === 'GET') {
    try {
      const response = await axios.get(
        `${getBackendBaseUrl}${ApiVersion}/dashboards/${encodeURIComponent(id)}`,
        {
          headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
          responseType: 'text',
          validateStatus: () => true,
        }
      );
      const text = response.data;
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      return res.status(response.status).json(json ?? {});
    } catch (e) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: e.message || API_MSG.REQUEST_FAILED,
      });
    }
  }

  return res
    .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
    .json({ error: API_MSG.METHOD_NOT_ALLOWED });
}
