import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * 請求ID中間件
 * 為每個請求生成唯一ID，用於日誌追蹤
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = uuidv4();
  (req as any).requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

