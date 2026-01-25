/**
 * 響應處理工具
 */

import type { ApiResponse } from '@/types/common';
import { message } from 'antd';

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
export function handleApiError(error: any, showMessage: boolean = true): void {
  const errorMessage = error?.message || error?.error?.message || '發生未知錯誤';
  
  if (showMessage) {
    message.error(errorMessage);
  }
}

/**
 * 檢查響應是否成功
 */
export function isSuccessResponse(response: any): response is ApiResponse {
  return response && typeof response === 'object' && response.success === true;
}

/**
 * 檢查響應是否為錯誤
 */
export function isErrorResponse(response: any): boolean {
  return response && typeof response === 'object' && response.success === false;
}

