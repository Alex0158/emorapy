/**
 * 驗證工具函數
 */

import { MIN_STATEMENT_LENGTH, MAX_STATEMENT_LENGTH } from './constants';
import { t } from '@/utils/i18n';

/**
 * 驗證郵箱格式
 */
export function validateEmail(email: string | null | undefined): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email ?? '');
}

/**
 * 驗證密碼強度
 */
export function validatePassword(password: string | null | undefined): {
  valid: boolean;
  message?: string;
} {
  const p = password ?? '';
  if (p.length < 8) {
    return { valid: false, message: t('validation.passwordMinAlt') };
  }

  if (!/[a-zA-Z]/.test(p)) {
    return { valid: false, message: t('validation.passwordLetterAlt') };
  }

  if (!/[0-9]/.test(p)) {
    return { valid: false, message: t('validation.passwordNumberAlt') };
  }

  return { valid: true };
}

/**
 * 驗證陳述長度
 */
export function validateStatement(statement: string | null | undefined): {
  valid: boolean;
  message?: string;
} {
  const trimmed = (statement ?? '').trim();

  if (trimmed.length < MIN_STATEMENT_LENGTH) {
    return {
      valid: false,
      message: t('validation.statementMinShort').replace('{min}', String(MIN_STATEMENT_LENGTH)),
    };
  }

  if (trimmed.length > MAX_STATEMENT_LENGTH) {
    return {
      valid: false,
      message: t('validation.statementMaxShort').replace('{max}', String(MAX_STATEMENT_LENGTH)),
    };
  }

  return { valid: true };
}

/**
 * 驗證URL格式
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 驗證邀請碼格式（6位字母數字）
 */
export function validateInviteCode(code: string | null | undefined): boolean {
  const codeRegex = /^[A-Z0-9]{6}$/;
  return codeRegex.test(code ?? '');
}

/**
 * 驗證Session ID格式
 */
export function validateSessionId(sessionId: string | null | undefined): boolean {
  const s = sessionId ?? '';
  return s.startsWith('guest_') && s.length > 10;
}

