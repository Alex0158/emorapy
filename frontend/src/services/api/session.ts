/**
 * Session API（快速體驗模式）
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { Session } from '@/types/session';

/**
 * 創建Session（快速體驗模式）
 */
export const createSession = async (): Promise<Session> => {
  const response = await request.post<ApiResponse<{ session_id: string; expires_at: string }>>(
    '/sessions/quick'
  );
  const data = (response.data as ApiResponse<{ session_id: string; expires_at: string }>).data;
  return {
    session_id: data.session_id,
    expires_at: data.expires_at,
  };
};

/**
 * 刷新/獲取新的 Session（快速體驗模式）
 * 後端共用 createSession 邏輯，便於前端在過期/即將過期時自動續期
 */
export const refreshSession = async (): Promise<Session> => {
  const response = await request.post<ApiResponse<{ session_id: string; expires_at: string }>>(
    '/sessions/refresh'
  );
  const data = (response.data as ApiResponse<{ session_id: string; expires_at: string }>).data;
  return {
    session_id: data.session_id,
    expires_at: data.expires_at,
  };
};
