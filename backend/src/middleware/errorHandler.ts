import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';
import logger from '../config/logger';
import { env } from '../config/env';
import { getRequestId, getAuthUserIdOptional, getSessionId } from '../utils/request';
import crypto from 'crypto';
import { translateBackendMessage, translateErrorByCode } from '../i18n';

const maskSessionId = (sessionId?: string): string | undefined => {
  if (!sessionId) return undefined;
  return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const locale = req.locale ?? 'zh-TW';
  const safeErr = err instanceof Error ? err : new Error(String(err ?? 'Unknown error'));

  logger.error('Error occurred', {
    request_id: getRequestId(req),
    error: safeErr.message,
    stack: env.NODE_ENV === 'development' ? safeErr.stack : undefined,
    url: req.url,
    method: req.method,
    userId: getAuthUserIdOptional(req),
    sessionId: maskSessionId(getSessionId(req)),
  });
  
  // 處理自定義錯誤
  if (safeErr instanceof AppError) {
    res.status(safeErr.statusCode).json({
      success: false,
      error: {
        code: safeErr.code,
        message: translateErrorByCode(locale, safeErr.code, safeErr.message),
        details: env.NODE_ENV === 'development' ? safeErr.details : undefined,
      },
    });
    return;
  }

  // 處理 Multer 文件上傳錯誤
  if (safeErr instanceof multer.MulterError) {
    const multerStatusMap: Record<string, { status: number; code: string; msg: string }> = {
      LIMIT_FILE_SIZE: { status: 413, code: 'FILE_TOO_LARGE', msg: '文件大小超出限制' },
      LIMIT_FILE_COUNT: { status: 400, code: 'TOO_MANY_FILES', msg: '文件數量超出限制' },
      LIMIT_UNEXPECTED_FILE: { status: 400, code: 'INVALID_FILE_FIELD', msg: '無效的文件字段' },
    };
    const mapped = multerStatusMap[safeErr.code] || { status: 400, code: 'UPLOAD_ERROR', msg: '文件上傳失敗' };
    res.status(mapped.status).json({
      success: false,
      error: {
        code: mapped.code,
        message: translateBackendMessage(locale, mapped.msg),
      },
    });
    return;
  }
  
  // 處理數據庫錯誤（Prisma錯誤）
  if (safeErr && typeof safeErr === 'object' && 'code' in safeErr) {
    const dbError = safeErr as { code: string; meta?: { target?: string[] } };
    if (dbError.code === 'P2002') {
      const target = dbError.meta?.target;
      const isEmailDuplicate = Array.isArray(target) && target.includes('email');
      res.status(409).json({
        success: false,
        error: {
          code: isEmailDuplicate ? 'EMAIL_EXISTS' : 'CONFLICT',
          message: isEmailDuplicate
            ? translateBackendMessage(locale, '該郵箱已被註冊')
            : env.NODE_ENV === 'production'
              ? translateBackendMessage(locale, '資源已存在')
              : translateBackendMessage(locale, `唯一約束違規: ${target?.join(', ') || '未知字段'}`),
        },
      });
      return;
    }
    
    if (dbError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: translateErrorByCode(locale, 'NOT_FOUND', '資源不存在'),
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
        ? translateBackendMessage(locale, '服務器內部錯誤，請稍後再試')
        : translateBackendMessage(locale, safeErr.message),
    },
  });
};

