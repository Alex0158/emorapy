/**
 * Session API（快速體驗模式）
 */

import request from '../request';
import { createM1ApiClient } from '@cj/api-client';
import type { Session } from '@/types/session';

const sharedSessionApi = createM1ApiClient(request).session;

/**
 * 創建Session（快速體驗模式）
 */
export const createSession = async (): Promise<Session> => {
  return sharedSessionApi.createQuickSession();
};

/**
 * 刷新/獲取新的 Session（快速體驗模式）
 * 後端共用 createSession 邏輯，便於前端在過期/即將過期時自動續期
 */
export const refreshSession = async (currentSessionId?: string): Promise<Session> => {
  return sharedSessionApi.refreshQuickSession(currentSessionId);
};
