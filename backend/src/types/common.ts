/**
 * 通用類型定義
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_more: boolean;
}

export interface ListResponse<T> {
  items: T[];
  pagination: PaginationResponse;
}

