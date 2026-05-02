import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * 請求ID中間件
 * 為每個請求生成唯一ID，用於日誌追蹤
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};
