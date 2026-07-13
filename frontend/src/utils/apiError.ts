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

function normalizeVisibleErrorMessage(message: unknown): string | null {
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;
  if (/^Invalid .+ from server$/.test(trimmed)) {
    return t('apiError.invalidResponse');
  }
  return null;
}

const CODE_MESSAGE_KEYS: Record<string, string> = {
  NETWORK_ERROR: 'common.networkError',
  UNAUTHORIZED: 'common.unauthorized',
  TOKEN_EXPIRED: 'common.unauthorized',
  INVALID_CREDENTIALS: 'common.invalidCredentials',
  EMAIL_NOT_VERIFIED: 'message.emailNotVerified',
  EMAIL_EXISTS: 'common.conflict',
  FORBIDDEN: 'common.forbidden',
  NOT_FOUND: 'common.notFound',
  VALIDATION_ERROR: 'common.validationError',
  INVALID_EMAIL: 'common.validationError',
  WEAK_PASSWORD: 'common.validationError',
  INVALID_CODE: 'common.validationError',
  CODE_EXPIRED: 'common.validationError',
  REGISTRATION_PROOF_INVALID: 'common.validationError',
  REGISTRATION_PROOF_EXPIRED: 'common.validationError',
  EMAIL_DELIVERY_UNAVAILABLE: 'common.serviceUnavailable',
  ALREADY_PAIRED: 'common.conflict',
  CASE_NOT_READY: 'common.validationError',
  CASE_NOT_EDITABLE: 'common.validationError',
  RATE_LIMIT: 'common.rateLimit',
  RATE_LIMIT_EXCEEDED: 'common.rateLimit',
  TURN_TOO_FAST: 'common.rateLimit',
  START_RATE_LIMIT: 'common.rateLimit',
  CONCURRENT_REQUEST: 'common.conflict',
  AI_CALL_FAILED: 'message.judgmentUnavailable',
  SERVER_ERROR: 'common.serverError',
  INTERNAL_ERROR: 'common.serverError',
  DATABASE_ERROR: 'common.serverError',
  AI_SERVICE_ERROR: 'message.judgmentUnavailable',
  EXTERNAL_SERVICE_ERROR: 'common.serviceUnavailable',
  SESSION_COMPLETED: 'interview.error.sessionCompleted',
  PROCESSING_NOT_DONE: 'common.conflict',
  PROCESSING_FAILED: 'common.serverError',
  MAX_TURNS_REACHED: 'interview.error.maxTurns',
};

function getHttpStatusMessageKey(code: string): string | null {
  const match = /^HTTP_(\d{3})$/.exec(code);
  if (!match) return null;
  const status = Number(match[1]);
  if (status === 401) return 'common.unauthorized';
  if (status === 403) return 'common.forbidden';
  if (status === 404) return 'common.notFound';
  if (status === 409) return 'common.conflict';
  if (status === 429) return 'common.rateLimit';
  if (status === 503) return 'common.serviceUnavailable';
  if (status >= 400 && status < 500) return 'common.validationError';
  if (status >= 500) return 'common.serverError';
  return null;
}

function getCodeMessage(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const normalized = code.trim();
  if (normalized.length === 0) return null;
  const key = CODE_MESSAGE_KEYS[normalized] ?? getHttpStatusMessageKey(normalized);
  return key ? t(key) : null;
}

function getNestedError(error: unknown): { code?: unknown; message?: unknown } | null {
  if (!error || typeof error !== 'object' || !('error' in error)) return null;
  const nested = (error as { error?: unknown }).error;
  return nested && typeof nested === 'object'
    ? nested as { code?: unknown; message?: unknown }
    : null;
}

/**
 * 獲取用戶友好的錯誤消息
 * @param error 錯誤對象（ApiError、Error 或含 message 的物件）
 * @param fallbackKey 可選 i18n key，當無法從 error 取得訊息時使用
 */
export function getErrorMessage(error: unknown, fallbackKey?: string): string {
  const topLevel = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : null;
  const msg = topLevel && 'message' in topLevel ? topLevel.message : undefined;
  const visibleMessage = normalizeVisibleErrorMessage(msg);
  if (visibleMessage) {
    return visibleMessage;
  }
  const nested = getNestedError(error);
  const nestedVisibleMessage = normalizeVisibleErrorMessage(nested?.message);
  if (nestedVisibleMessage) {
    return nestedVisibleMessage;
  }
  const codeMessage = getCodeMessage(topLevel?.code) ?? getCodeMessage(nested?.code);
  if (codeMessage) {
    return codeMessage;
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
