/**
 * 配置驗證
 */

import { env } from './env';
import { logger } from '@/utils/logger';

/**
 * 驗證環境配置
 */
export function validateEnvConfig(): void {
  const errors: string[] = [];

  // 驗證API基礎URL
  if (!env.apiBaseURL) {
    errors.push('VITE_API_BASE_URL is required');
  } else {
    try {
      new URL(env.apiBaseURL);
    } catch {
      errors.push('VITE_API_BASE_URL must be a valid URL');
    }
  }

  if (errors.length > 0) {
    logger.error('Environment validation failed', { errors });
    // 僅在開發環境輸出到 console
    if (import.meta.env.DEV) {
      console.error('環境變量驗證失敗:', errors.join(', '));
    }
  } else {
    logger.info('Environment validation passed');
  }
}

// 在開發環境驗證配置
if (env.isDevelopment) {
  validateEnvConfig();
}

