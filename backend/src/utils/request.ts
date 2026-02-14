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
