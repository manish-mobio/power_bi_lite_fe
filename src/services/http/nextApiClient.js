import axios from 'axios';

/** Browser / same-origin calls to Next.js `/api/*` routes. */
export const nextApi = axios.create({
  baseURL: '',
  validateStatus: () => true,
});
