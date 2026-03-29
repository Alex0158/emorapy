/**
 * Request 輔助函數
 * 統一從 Express Request 提取認證、追蹤相關資料，消除 (req as any) 重複
 */
/// <reference path="../types/express.d.ts" />
import type { Request } from 'express';
import { Errors } from './errors';

export function getAuthUserId(req: Request): string {
  if (!req.user?.id) {
    throw Errors.UNAUTHORIZED('未提供認證Token');
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
  const querySessionId =
    req.query != null && typeof (req.query as { session_id?: unknown }).session_id === 'string'
      ? (req.query as { session_id: string }).session_id
      : undefined;
  const hasConflict = !!headerSessionId && !!querySessionId && headerSessionId !== querySessionId;

  return {
    sessionId: headerSessionId || querySessionId,
    headerSessionId,
    querySessionId,
    hasConflict,
  };
}
