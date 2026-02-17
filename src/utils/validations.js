// Pattern imports
import { isValidPhoneNumber } from './patterns';

export const validatePhoneNumber = (_, value) => {
  value = value?.toString();

  const validation = isValidPhoneNumber(value);

  if (!validation.isValid && value?.length > 0) {
    return Promise.reject(validation.warning);
  }
  return Promise.resolve();
};
