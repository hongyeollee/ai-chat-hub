import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Password policy: 8-20 characters, at least 1 special character
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 20;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`password_too_short`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`password_too_long`);
  }

  if (!SPECIAL_CHAR_REGEX.test(password)) {
    errors.push(`password_no_special_char`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
