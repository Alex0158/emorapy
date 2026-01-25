/**
 * 健康檢查路由
 */

import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../config/logger';
import { env } from '../config/env';
import { jobsStarted } from '../jobs/cleanup.job';

const router = Router();

/**
 * @route   GET /health
 * @desc    健康檢查端點
 * @access  Public
 */
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, { status: string; message?: string; responseTime?: number }> = {};
  let degraded = false;

  // 測試環境允許跳過 DB 檢查（例如 SKIP_DB_INIT）
  const skipDbCheck = env.NODE_ENV === 'test' && process.env.SKIP_DB_INIT !== 'false';

  try {
    if (skipDbCheck) {
      checks.database = {
        status: 'skipped',
        message: 'DB check skipped in test mode',
      };
    } else {
      // 檢查數據庫連接
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - dbStartTime;
      
      checks.database = {
        status: 'healthy',
        responseTime: dbResponseTime,
      };
    }
  } catch (error) {
    degraded = true;
    checks.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }

  // 檢查環境變量
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  checks.environment = {
    status: missingVars.length === 0 ? 'healthy' : 'unhealthy',
    message: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : undefined,
  };

  // 計算總響應時間
  const totalResponseTime = Date.now() - startTime;

  // 定時任務狀態
  checks.cron = jobsStarted || env.NODE_ENV === 'test'
    ? { status: 'healthy' }
    : { status: 'unhealthy', message: 'Scheduled jobs not started' };
  if (checks.cron.status !== 'healthy') degraded = true;

  // 判斷整體健康狀態
  const isHealthy = !degraded && Object.values(checks).every(check => check.status === 'healthy' || check.status === 'skipped');

  const response = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks,
    responseTime: totalResponseTime,
    version: process.env.npm_package_version || '1.0.0',
  };

  // 根據環境調整日誌級別和詳細程度
  if (isHealthy) {
    if (env.NODE_ENV === 'development') {
      logger.info('Health check passed', { responseTime: totalResponseTime, checks });
    } else if (totalResponseTime > 1000) {
      logger.warn('Health check passed but slow', { responseTime: totalResponseTime });
    }
    res.status(200).json(response);
  } else {
    logger.warn('Health check degraded', { 
      checks: env.NODE_ENV === 'development' ? checks : Object.keys(checks),
    });
    // degraded 返回 200，方便監控區分失效/降級
    res.status(200).json(response);
  }
});

/**
 * @route   GET /health/ready
 * @desc    就緒檢查（用於Kubernetes等）
 * @access  Public
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // 只檢查數據庫連接
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /health/live
 * @desc    存活檢查（用於Kubernetes等）
 * @access  Public
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
