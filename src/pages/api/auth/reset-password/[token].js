import { API_MSG } from '@/utils/messages';
import { ApiVersion } from '@/utils/constants';
import HTTP_STATUS from '@/utils/statusCode';
import { proxyToBackend } from '../_proxy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  const token = String(req.query?.token || '').trim();
  if (!token) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ error: API_MSG.REQUEST_FAILED });
  }

  return proxyToBackend(req, res, {
    path: `${ApiVersion}/auth/reset-password/${encodeURIComponent(token)}`,
    method: 'POST',
  });
}
