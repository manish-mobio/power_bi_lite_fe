import axios from 'axios';
import { API_MSG } from '@/utils/messages';
import HTTP_STATUS from '@/utils/statusCode';
import { ApiVersion } from '@/utils/constants';
import { getBackendBaseUrl } from '@/services/http/backendClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  const { id } = req.query || {};
  if (!id) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ error: API_MSG.DASHBOARD_ID_REQUIRED });
  }

  try {
    const url = `${getBackendBaseUrl}${ApiVersion}/dashboards/${encodeURIComponent(id)}/sync`;
    const upstream = await axios.post(url, req.body || {}, {
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
      responseType: 'text',
      validateStatus: () => true,
    });

    const text = upstream.data;
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text ? { message: text } : {};
    }

    return res.status(upstream.status).json(json ?? {});
  } catch (e) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: e.message || API_MSG.SYNC_FAILED,
    });
  }
}
