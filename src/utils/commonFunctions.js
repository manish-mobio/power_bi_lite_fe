import { message } from 'antd';

export const handleErrorResponse = (error) => {
  const payload = {
    status: false,
    message: error?.response?.data?.errors
      ? error?.response?.data?.errors[0]?.msg
      : error?.response?.data?.message,
  };
  return payload;
};

export const errorMessage = (text) => {
  return message.error(text);
};

export const successMessage = (text) => {
  return message.success(text);
};

export const infoMessage = (text) => {
  return message.info(text);
};

// Use a `key` to update/replace an in-flight toast (e.g., loading -> success).
export const loadingMessage = (text, key = 'global') => {
  return message.open({ type: 'loading', content: text, key, duration: 0 });
};

export const updateMessage = ({ type, text, key = 'global', duration = 2 }) => {
  return message.open({ type, content: text, key, duration });
};

export const supportedMimes = new Set([
  'application/json',
  'text/json',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);
