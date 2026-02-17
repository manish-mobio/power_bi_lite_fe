export const PASSWORD_VALIDATION_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
export const CONVERT_ROUTE_TO_FIRST_LETTER_CAPITALIZE = /\/([a-z-]+)/g;

export const isValidPhoneNumber = (phoneNumber) => {
  if (typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
    return { isValid: false, warning: 'Phone number is required' };
  }
  const cleanedNumber = phoneNumber.replace(/\D/g, '');

  const isValidFormat = /^\d{10}$/.test(cleanedNumber);

  if (!isValidFormat) {
    return { isValid: false, warning: 'Invalid phone number format' };
  }

  if (cleanedNumber.length !== 10) {
    return { isValid: false, warning: 'Phone number should have 10 digits' };
  }
  return { isValid: true };
};
