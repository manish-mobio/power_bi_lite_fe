// Pattern imports
import { PASSWORD_VALIDATION_PATTERN } from './patterns';

// Validation imports
import { validatePhoneNumber } from './validations';

export const USER_FORM_RULES = {
  name: [{ required: true, message: 'Please enter your name!' }],
  firstName: [{ required: true, message: 'Please enter your first name!' }],
  lastName: [{ required: true, message: 'Please enter your last name!' }],
  phoneNumber: [
    { required: true, message: 'Please enter your phone number!' },
    { validator: validatePhoneNumber },
  ],
  email: [
    { required: true, message: 'Please enter your email!' },
    { type: 'email', message: 'Please enter a valid email address!' },
  ],
  password: [
    { required: true, message: 'Please enter your password!' },
    { min: 8, max: 16, message: 'Password must be between 8-16 characters' },
    {
      pattern: PASSWORD_VALIDATION_PATTERN,
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one symbol, and one digit',
    },
  ],
};
