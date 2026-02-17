import { message } from 'antd';
import { CONVERT_ROUTE_TO_FIRST_LETTER_CAPITALIZE } from './patterns';

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

export const convertStringToFirstLetterCapitalize = (pathname) => {
  return pathname.replace(
    CONVERT_ROUTE_TO_FIRST_LETTER_CAPITALIZE,
    (match, p1) => {
      return p1
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  );
};
