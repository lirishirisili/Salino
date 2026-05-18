/**
 * Password strength validation for registration.
 * Rules: 8+ chars, at least one letter, at least one digit.
 */

export interface PasswordValidationResult {
  valid: boolean;
  errorKey: string | null;
}

const MIN_LENGTH = 8;

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < MIN_LENGTH) {
    return { valid: false, errorKey: 'auth_error_password_too_short' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, errorKey: 'auth_error_password_needs_letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, errorKey: 'auth_error_password_needs_number' };
  }
  return { valid: true, errorKey: null };
}
