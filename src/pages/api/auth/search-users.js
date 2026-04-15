import { API_MSG } from '@/utils/messages';
import { ApiVersion } from '@/utils/constants';
import HTTP_STATUS from '@/utils/statusCode';
import { proxyToBackend } from './_proxy';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: API_MSG.METHOD_NOT_ALLOWED });
  }

  const email = req.query?.email ? String(req.query.email) : '';
  const encoded = encodeURIComponent(email);
  return proxyToBackend(req, res, {
    path: `${ApiVersion}/search-users?email=${encoded}`,
    method: 'GET',
  });
}
