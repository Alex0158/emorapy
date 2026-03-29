/**
 * 通用類型定義
 */

import type {
  ApiError as SharedApiError,
  PaginationParams as SharedPaginationParams,
  ResponsibilityRatio as SharedResponsibilityRatio,
} from '@cj/contracts/common';

// API響應格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
}

// API錯誤響應
export type ApiError = SharedApiError;

// 分頁參數
export type PaginationParams = SharedPaginationParams;

// 分頁響應
export interface PaginationResponse<T> {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

// 責任分比例
export type ResponsibilityRatio = SharedResponsibilityRatio;

