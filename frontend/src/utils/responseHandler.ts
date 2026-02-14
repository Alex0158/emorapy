/**
 * 響應處理工具
 */

import type { ApiResponse } from '@/types/common';
import { message } from 'antd';
import { t } from '@/utils/i18n';

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
 */
export function handleApiError(error: unknown, showMessage: boolean = true): void {
  type ErrShape = { message?: string; error?: { message?: string } };
  const err = error as ErrShape;
  const errorMessage = err?.message ?? err?.error?.message ?? t('common.unknownError');

  if (showMessage) {
    message.error(errorMessage);
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

