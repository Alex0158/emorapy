/**
 * 驗證工具函數
 */

import { MIN_STATEMENT_LENGTH, MAX_STATEMENT_LENGTH } from './constants';

/**
 * 驗證郵箱格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 驗證密碼強度
 */
export function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: '密碼長度至少8位' };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密碼必須包含字母' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密碼必須包含數字' };
  }

  return { valid: true };
}

/**
 * 驗證陳述長度
 */
export function validateStatement(statement: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = statement.trim();

  if (trimmed.length < MIN_STATEMENT_LENGTH) {
    return {
      valid: false,
      message: `陳述長度必須至少${MIN_STATEMENT_LENGTH}字`,
    };
  }

  if (trimmed.length > MAX_STATEMENT_LENGTH) {
    return {
      valid: false,
      message: `陳述長度不能超過${MAX_STATEMENT_LENGTH}字`,
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
export function validateInviteCode(code: string): boolean {
  const codeRegex = /^[A-Z0-9]{6}$/;
  return codeRegex.test(code);
}

/**
 * 驗證Session ID格式
 */
export function validateSessionId(sessionId: string): boolean {
  return sessionId.startsWith('guest_') && sessionId.length > 10;
}

