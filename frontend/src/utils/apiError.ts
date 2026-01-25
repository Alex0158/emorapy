/**
 * API錯誤處理工具
 */

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

/**
 * 判斷是否為API錯誤
 */
export function isApiError(error: any): error is ApiError {
  return error && typeof error === 'object' && 'code' in error && 'message' in error;
}

/**
 * 獲取用戶友好的錯誤消息
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '發生未知錯誤';
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

