/**
 * Request 輔助函數
 * 統一從 Express Request 提取認證、追蹤相關資料，消除 (req as any) 重複
 */
/// <reference path="../types/express.d.ts" />
import type { Request } from 'express';

export function getAuthUserId(req: Request): string {
  if (!req.user?.id) {
    throw new Error('User not authenticated');
  }
  return req.user.id;
}

export function getAuthUserIdOptional(req: Request): string | undefined {
  return req.user?.id;
}

export function getRequestId(req: Request): string {
  return req.requestId ?? 'unknown';
}

export function getSessionId(req: Request): string | undefined {
  return req.sessionId;
}

function normalizeSessionHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getSessionIdFromSources(req: Request): {
  sessionId?: string;
  headerSessionId?: string;
  querySessionId?: string;
  hasConflict: boolean;
} {
  const headerSessionId = normalizeSessionHeaderValue(req.headers['x-session-id'] as string | string[] | undefined);
  const querySessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;
  const hasConflict = !!headerSessionId && !!querySessionId && headerSessionId !== querySessionId;

  return {
    sessionId: headerSessionId || querySessionId,
    headerSessionId,
    querySessionId,
    hasConflict,
  };
}
