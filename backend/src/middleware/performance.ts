/**
 * 性能監控中間件
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { env } from '../config/env';
import { getRequestId } from '../utils/request';

interface PerformanceMetrics {
  method: string;
  url: string;
  duration: number;
  statusCode: number;
  timestamp: string;
}

const isDevelopment = env.NODE_ENV === 'development';

/**
 * 性能監控中間件
 * 開發環境：詳細監控（包括內存）
 * 生產環境：僅監控慢請求和錯誤（不監控內存）
 */
export const performanceMonitor = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  // 僅在開發環境監控內存
  const startMemory = isDevelopment ? process.memoryUsage() : undefined;

  // 響應完成時記錄性能指標
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // 僅在開發環境計算內存變化
    const memoryDelta = isDevelopment && startMemory
      ? {
          heapUsed: (process.memoryUsage().heapUsed - startMemory.heapUsed) / 1024 / 1024, // MB
          rss: (process.memoryUsage().rss - startMemory.rss) / 1024 / 1024, // MB
        }
      : undefined;

    const metrics: PerformanceMetrics = {
      method: req.method,
      url: req.url,
      duration,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    };

    // 記錄慢請求（超過1秒）
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        ...metrics,
        ...(memoryDelta && { memory: memoryDelta }),
        requestId: getRequestId(req),
      });
    } else if (isDevelopment) {
      // 開發環境記錄所有請求
      logger.debug('Request completed', {
        ...metrics,
        ...(memoryDelta && { memory: memoryDelta }),
        requestId: getRequestId(req),
      });
    }
    // 生產環境不記錄正常請求的性能指標

    // 記錄錯誤請求的性能指標
    if (res.statusCode >= 400) {
      logger.warn('Request error', {
        ...metrics,
        ...(memoryDelta && { memory: memoryDelta }),
        requestId: getRequestId(req),
      });
    }
  });

  next();
};

/**
 * 獲取性能統計（用於健康檢查）
 */
export const getPerformanceStats = () => {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  return {
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
      rss: Math.round(memory.rss / 1024 / 1024), // MB
    },
    uptime: Math.round(uptime), // seconds
    nodeVersion: process.version,
  };
};

