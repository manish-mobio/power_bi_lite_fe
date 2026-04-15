/**
 * Power BI Lite - Dashboard Persistence API
 * Saves/loads ChartConfig array to backend (dashboards collection)
 */
import axios from 'axios';
import { API_MSG, FORMAT_BACKEND_ERROR_STATUS } from '@/utils/messages';
import HTTP_STATUS, { isHttpSuccessStatus } from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';

const DASHBOARDS_ENDPOINT = () =>
  `${getBackendBaseUrl}${ApiVersion}/dashboards`;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const response = await axios.get(DASHBOARDS_ENDPOINT(), {
        headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
        validateStatus: () => true,
      });
      if (response.status === HTTP_STATUS.UNAUTHORIZED)
        return res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json({ error: API_MSG.UNAUTHORIZED });
      if (!isHttpSuccessStatus(response.status))
        return res.status(HTTP_STATUS.OK).json([]);
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.data ?? data?.dashboards ?? [];
      return res.status(HTTP_STATUS.OK).json(list);
    } catch (error) {
      console.error('[BI Dashboards GET]', error);
      return res.status(HTTP_STATUS.OK).json([]);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { name = 'My Dashboard', charts = [], layouts = {}, logo } = body;

      const payload = {
        name,
        charts,
        layouts,
        ...(logo != null && typeof logo === 'string' ? { logo } : {}),
        updatedAt: new Date().toISOString(),
      };

      const response = await axios.post(DASHBOARDS_ENDPOINT(), payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
        },
        validateStatus: () => true,
      });

      if (response.status === HTTP_STATUS.UNAUTHORIZED)
        return res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json({ error: API_MSG.UNAUTHORIZED });
      if (!isHttpSuccessStatus(response.status))
        throw new Error(FORMAT_BACKEND_ERROR_STATUS(response.status));
      const result = response.data;
      return res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      console.error('[BI Dashboards POST]', error);
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  }

  return res
    .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
    .json({ error: API_MSG.METHOD_NOT_ALLOWED });
}
