import type { RequestErrorLike } from '@emorapy/api-client';

import { t } from '@/src/i18n';

export interface RegistrationDraft {
  email: string;
  password: string;
  nickname?: string;
}

const COMMON_REGISTRATION_PASSWORDS = new Set([
  'password',
  '12345678',
  'qwerty',
  'abc123',
]);

export type RegistrationPasswordIssue =
  | 'common'
  | 'too_short'
  | 'too_long'
  | 'missing_letter'
  | 'missing_number';

const REGISTRATION_PROOF_ERROR_CODES = new Set([
  'REGISTRATION_PROOF_INVALID',
  'REGISTRATION_PROOF_EXPIRED',
]);

export function isValidAuthEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export function sanitizeVerificationCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function getRegistrationPasswordIssue(
  password: string
): RegistrationPasswordIssue | null {
  if (COMMON_REGISTRATION_PASSWORDS.has(password.toLowerCase())) return 'common';
  if (password.length < 8) return 'too_short';
  if (password.length > 128) return 'too_long';
  if (!/[a-zA-Z]/.test(password)) return 'missing_letter';
  if (!/[0-9]/.test(password)) return 'missing_number';
  return null;
}

export function isValidRegistrationPassword(password: string): boolean {
  return getRegistrationPasswordIssue(password) === null;
}

export function getRegistrationPasswordErrorMessage(password: string): string | null {
  switch (getRegistrationPasswordIssue(password)) {
    case 'common':
      return t('auth.error.passwordCommon');
    case 'too_short':
      return t('auth.error.passwordMin');
    case 'too_long':
      return t('auth.error.passwordMax');
    case 'missing_letter':
      return t('auth.error.passwordLetter');
    case 'missing_number':
      return t('auth.error.passwordNumber');
    default:
      return null;
  }
}

export function shouldDiscardRegistrationProof(code: string): boolean {
  return REGISTRATION_PROOF_ERROR_CODES.has(code);
}

export function getAuthFlowErrorMessage(error: RequestErrorLike): string {
  switch (error.code) {
    case 'INVALID_CODE':
      return t('auth.error.invalidCode');
    case 'CODE_EXPIRED':
      return t('auth.error.codeExpired');
    case 'EMAIL_EXISTS':
      return t('auth.error.emailExists');
    case 'EMAIL_NOT_VERIFIED':
      return t('auth.error.emailNotVerified');
    case 'INVALID_CREDENTIALS':
      return t('auth.error.invalidCredentials');
    case 'EMAIL_DELIVERY_UNAVAILABLE':
      return t('auth.error.deliveryUnavailable');
    case 'WEAK_PASSWORD':
      return t('auth.error.weakPassword');
    case 'REGISTRATION_PROOF_INVALID':
      return t('auth.error.proofInvalid');
    case 'REGISTRATION_PROOF_EXPIRED':
      return t('auth.error.proofExpired');
    case 'RATE_LIMIT':
    case 'RATE_LIMIT_EXCEEDED':
      return t('auth.error.rateLimit');
    default:
      return error.message;
  }
}
