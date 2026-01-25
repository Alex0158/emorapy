/**
 * 通用類型定義
 */

// API響應格式
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
}

// API錯誤響應
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  request_id?: string;
  timestamp?: string;
}

// 分頁參數
export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

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
export interface ResponsibilityRatio {
  plaintiff: number; // 0-100
  defendant: number; // 0-100
}

