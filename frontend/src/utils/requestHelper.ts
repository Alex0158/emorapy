/**
 * 請求輔助函數
 */

import { sessionStorage } from './storage';

/**
 * 獲取Session ID（用於快速體驗模式）
 */
export function getSessionId(): string | null {
  return sessionStorage.get();
}

/**
 * 設置Session ID
 */
export function setSessionId(sessionId: string): void {
  sessionStorage.set(sessionId);
}

/**
 * 清除Session ID
 */
export function clearSessionId(): void {
  sessionStorage.remove();
}

/**
 * 構建查詢參數
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * 添加Session ID到查詢參數
 */
export function addSessionToParams(params: Record<string, any> = {}): Record<string, any> {
  const sessionId = getSessionId();
  if (sessionId) {
    return { ...params, session_id: sessionId };
  }
  return params;
}

