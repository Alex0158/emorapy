import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../config/logger';
import { env } from '../config/env';
import { getRequestId, getAuthUserIdOptional, getSessionId } from '../utils/request';
import crypto from 'crypto';

const maskSessionId = (sessionId?: string): string | undefined => {
  if (!sessionId) return undefined;
  return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error occurred', {
    request_id: getRequestId(req),
    error: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    userId: getAuthUserIdOptional(req),
    sessionId: maskSessionId(getSessionId(req)),
  });
  
  // 處理自定義錯誤
  if (err instanceof AppError) {
    // 自定義錯誤已經包含用戶友好的消息
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        // 生產環境不返回details，開發環境返回
        details: env.NODE_ENV === 'development' ? err.details : undefined,
      },
    });
    return;
  }
  
  // 處理數據庫錯誤（Prisma錯誤）
  if (err && typeof err === 'object' && 'code' in err) {
    const dbError = err as any;
    // 處理Prisma錯誤碼
    if (dbError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: env.NODE_ENV === 'production' 
            ? '資源已存在' 
            : `唯一約束違規: ${dbError.meta?.target?.join(', ') || '未知字段'}`,
        },
      });
      return;
    }
    
    if (dbError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '資源不存在',
        },
      });
      return;
    }
  }
  
  // 處理未知錯誤（生產環境不暴露詳細信息）
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' 
        ? '服務器內部錯誤，請稍後再試' 
        : err.message,
    },
  });
};

