/**
 * 響應處理工具
 */

import type { ApiResponse } from '@/types/common';
import { message } from 'antd';
import { getErrorMessage } from '@/utils/apiError';

/**
 * 處理API響應
 */
export function handleApiResponse<T>(response: ApiResponse<T>): T {
  if (response.success && response.data) {
    return response.data;
  }

  // 如果響應格式不正確，拋出錯誤
  throw new Error('Invalid API response format');
}

/**
 * 處理API錯誤
 * F10 約定：message 為空字串或純空白時使用 common.unknownError
 */
export function handleApiError(error: unknown, showMessage: boolean = true): void {
  if (showMessage) {
    message.error(getErrorMessage(error, 'common.unknownError'));
  }
}

/**
 * 檢查響應是否成功
 */
export function isSuccessResponse(response: unknown): response is ApiResponse {
  return typeof response === 'object' && response !== null && 'success' in response && (response as ApiResponse).success === true;
}

/**
 * 檢查響應是否為錯誤
 */
export function isErrorResponse(response: unknown): boolean {
  return typeof response === 'object' && response !== null && 'success' in response && (response as { success: boolean }).success === false;
}

