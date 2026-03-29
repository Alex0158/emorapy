/**
 * API錯誤處理工具
 */

import { t } from '@/utils/i18n';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * 判斷是否為API錯誤
 */
export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

/**
 * 獲取用戶友好的錯誤消息
 * @param error 錯誤對象（ApiError、Error 或含 message 的物件）
 * @param fallbackKey 可選 i18n key，當無法從 error 取得訊息時使用
 */
export function getErrorMessage(error: unknown, fallbackKey?: string): string {
  const msg = error && typeof error === 'object' && 'message' in error ? (error as { message: unknown }).message : undefined;
  if (typeof msg === 'string' && msg.trim().length > 0) {
    return msg;
  }
  const nested = error && typeof error === 'object' && 'error' in error
    ? (error as { error?: { message?: unknown } }).error?.message
    : undefined;
  if (typeof nested === 'string' && nested.trim().length > 0) {
    return nested;
  }
  if (error instanceof Error) {
    const errMsg = error.message;
    if (typeof errMsg === 'string' && errMsg.trim().length > 0) return errMsg;
  }
  return fallbackKey ? t(fallbackKey) : t('common.unknownError');
}

/**
 * 獲取錯誤碼
 */
export function getErrorCode(error: unknown): string {
  if (isApiError(error)) {
    return error.code;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * 判斷是否為網絡錯誤
 */
export function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'NETWORK_ERROR';
  }
  return false;
}

/**
 * 判斷是否為認證錯誤
 */
export function isAuthError(error: unknown): boolean {
  if (isApiError(error)) {
    return ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'INVALID_CREDENTIALS'].includes(error.code);
  }
  return false;
}

