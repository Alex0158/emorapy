/**
 * 健康檢查路由
 */

import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../config/logger';
import { env } from '../config/env';
import { jobsStarted } from '../jobs/cleanup.job';
import { lockService } from '../utils/lock';
import packageJson from '../../package.json';

const router = Router();
const backendVersion = packageJson.version || '1.0.0';

router.get('/version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    service: 'backend',
    version: backendVersion,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   GET /health
 * @desc    健康檢查端點
 * @access  Public
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const checks: Record<string, { status: string; message?: string; responseTime?: number }> = {};
    let degraded = false;

    const skipDbCheck = env.NODE_ENV === 'test' && process.env.SKIP_DB_INIT !== 'false';

    try {
      if (skipDbCheck) {
        checks.database = {
          status: 'skipped',
          message: 'DB check skipped in test mode',
        };
      } else {
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
        message: env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Database connection failed')
          : 'Database connection failed',
      };
    }

    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    checks.environment = {
      status: missingVars.length === 0 ? 'healthy' : 'unhealthy',
      message: missingVars.length > 0
        ? (env.NODE_ENV === 'development' ? `Missing: ${missingVars.join(', ')}` : `${missingVars.length} required env var(s) missing`)
        : undefined,
    };

    const lockBackend = lockService.getBackendStatus();
    checks.lock = lockBackend === 'simple-lock-degraded'
      ? { status: 'degraded', message: 'Lock backend degraded: simple-lock in production' }
      : { status: 'healthy', message: `Lock backend: ${lockBackend}` };
    if (checks.lock.status !== 'healthy') degraded = true;

    const totalResponseTime = Date.now() - startTime;

    checks.cron = jobsStarted || env.NODE_ENV === 'test'
      ? { status: 'healthy' }
      : { status: 'unhealthy', message: 'Scheduled jobs not started' };
    if (checks.cron.status !== 'healthy') degraded = true;

    const isHealthy = !degraded && Object.values(checks).every(check => check.status === 'healthy' || check.status === 'skipped');

    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks,
      responseTime: totalResponseTime,
      version: backendVersion,
    };

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
      res.status(200).json(response);
    }
  } catch (error) {
    logger.error('Health check handler error', { error });
    res.status(500).json({ status: 'error', message: 'Internal health check failure' });
  }
});

/**
 * @route   GET /health/ready
 * @desc    就緒檢查（用於Kubernetes等）
 * @access  Public
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    logger.warn('Readiness check failed', { error: error instanceof Error ? error.message : error });
    res.status(503).json({ 
      status: 'not ready',
      error: env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Service unavailable',
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
