import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { env } from '../config/env';
import { getRequestId, getAuthUserIdOptional, getSessionId } from '../utils/request';
import crypto from 'crypto';

const maskSessionId = (sessionId?: string): string | undefined => {
  if (!sessionId) return undefined;
  return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = getRequestId(req);
  const isDevelopment = env.NODE_ENV === 'development';
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // 根據環境構建日誌數據
    // 開發環境：記錄詳細信息
    // 生產環境：不記錄 userAgent 等敏感信息，僅記錄錯誤請求
    const logData: any = {
      request_id: requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    };
    
    // 開發環境記錄詳細信息
    if (isDevelopment) {
      logData.ip = req.ip;
      logData.userAgent = req.get('user-agent');
      logData.userId = getAuthUserIdOptional(req);
      const sid = maskSessionId(getSessionId(req));
      if (sid) logData.sessionId = sid;
    } else {
      const uid = getAuthUserIdOptional(req);
      const sid = maskSessionId(getSessionId(req));
      if (uid) logData.userId = uid;
      if (sid) logData.sessionId = sid;
    }
    
    // 根據狀態碼和環境決定是否記錄
    if (res.statusCode >= 400) {
      // 錯誤請求：始終記錄
      logger.warn('HTTP Request', logData);
    } else if (isDevelopment) {
      // 開發環境：記錄所有請求
      logger.info('HTTP Request', logData);
    } else if (duration > 1000) {
      // 生產環境：僅記錄慢請求（>1秒）
      logger.info('HTTP Request (slow)', logData);
    }
    // 生產環境：正常請求不記錄
  });
  
  next();
};

