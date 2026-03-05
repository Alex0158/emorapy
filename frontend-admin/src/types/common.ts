export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface RequestError {
  code: string;
  message: string;
  details?: unknown;
}
