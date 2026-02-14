/**
 * 驗證工具函數
 */

import { MIN_STATEMENT_LENGTH, MAX_STATEMENT_LENGTH } from './constants';
import { t } from '@/utils/i18n';

/**
 * 驗證郵箱格式
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 驗證陳述長度
 */
export const validateStatement = (
  statement: string,
  min: number = MIN_STATEMENT_LENGTH,
  max: number = MAX_STATEMENT_LENGTH
): { valid: boolean; message?: string } => {
  const length = statement.trim().length;

  if (length < min) {
    return {
      valid: false,
      message: t('validation.statementMin').replace('{min}', String(min)).replace('{length}', String(length)),
    };
  }

  if (length > max) {
    return {
      valid: false,
      message: t('validation.statementMax').replace('{max}', String(max)).replace('{length}', String(length)),
    };
  }

  return { valid: true };
};

/**
 * 驗證密碼強度
 */
export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return {
      valid: false,
      message: t('validation.passwordMin'),
    };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      message: t('validation.passwordLetter'),
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: t('validation.passwordNumber'),
    };
  }

  return { valid: true };
};

/**
 * 驗證Session ID格式
 */
export const validateSessionId = (sessionId: string): boolean => {
  return sessionId.startsWith('guest_') && sessionId.length > 10;
};
