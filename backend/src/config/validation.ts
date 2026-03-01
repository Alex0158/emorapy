import { env } from './env';
import logger from './logger';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

/**
 * 驗證環境變量配置
 */
export function validateEnvConfig(): void {
  const errors: string[] = [];

  // 驗證必需的環境變量
  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  }
  if (env.NODE_ENV === 'production') {
    if (!process.env.ADMIN_JWT_SECRET || !process.env.ADMIN_JWT_SECRET.trim()) {
      errors.push('ADMIN_JWT_SECRET is required in production');
    }
    if (!process.env.ADMIN_JWT_EXPIRES_IN || !process.env.ADMIN_JWT_EXPIRES_IN.trim()) {
      errors.push('ADMIN_JWT_EXPIRES_IN is required in production');
    }
  }

  if (!env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required');
  }

  // 驗證端口範圍
  if (env.PORT < 1 || env.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  // 布林環境變量強校驗
  const booleanVars = ['ALLOW_PUBLIC_UPLOADS', 'ALLOW_SIMPLE_LOCK', 'ENABLE_SCHEDULED_JOBS', 'RUN_FLOW_TESTS', 'SKIP_DB_INIT'];
  booleanVars.forEach(varName => {
    const val = process.env[varName];
    if (val !== undefined && !['true','false',''].includes(val.trim().toLowerCase())) {
      errors.push(`${varName} must be "true" or "false" (got "${val}")`);
    }
  });

  // 驗證文件大小限制
  if (env.MAX_FILE_SIZE < 1024 || env.MAX_FILE_SIZE > 100 * 1024 * 1024) {
    errors.push('MAX_FILE_SIZE must be between 1KB and 100MB');
  }
  if (process.env.ADMIN_JWT_EXPIRES_IN?.trim()) {
    try {
      const adminJwtExpiresIn = process.env.ADMIN_JWT_EXPIRES_IN.trim() as StringValue;
      jwt.sign({ probe: true }, 'probe-secret', {
        algorithm: 'HS256',
        expiresIn: adminJwtExpiresIn,
      });
    } catch {
      errors.push('ADMIN_JWT_EXPIRES_IN is invalid');
    }
  }

  if (errors.length > 0) {
    logger.error('Environment validation failed', { errors });
    throw new Error(`環境變量驗證失敗: ${errors.join(', ')}`);
  }

  logger.info('Environment validation passed');
}
