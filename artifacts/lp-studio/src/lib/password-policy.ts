/**
 * Client-side mirror of the server password policy in the API
 * (`validatePasswordStrength`). Kept in sync deliberately so the live helper
 * text matches what the backend will accept on register/reset.
 */

export const PASSWORD_MIN_LENGTH = 12;

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()\-_=+[\]{};:,.?]/;

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

/**
 * Evaluate each policy rule against the typed password. The order matches the
 * helper text users read top to bottom.
 */
export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: "at least 12 characters", met: password.length >= PASSWORD_MIN_LENGTH },
    { label: "one uppercase letter", met: /[A-Z]/.test(password) },
    { label: "one number", met: /[0-9]/.test(password) },
    { label: "one special character", met: SPECIAL_CHAR_REGEX.test(password) },
  ];
}

/** Requirements the password does not yet satisfy. Empty array = valid. */
export function getUnmetPasswordRequirements(password: string): PasswordRequirement[] {
  return getPasswordRequirements(password).filter((r) => !r.met);
}

export function isPasswordValid(password: string): boolean {
  return getUnmetPasswordRequirements(password).length === 0;
}
