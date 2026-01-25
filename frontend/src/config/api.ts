/**
 * API配置
 */

import { env } from './env';

export const API_CONFIG = {
  baseURL: env.apiBaseURL,
  timeout: 30000,
  retry: {
    maxRetries: 3,
    delay: 1000,
  },
  polling: {
    judgment: {
      interval: 5000,
      maxAttempts: 60, // 5分鐘
    },
    case: {
      interval: 3000,
      maxAttempts: 100, // 5分鐘
    },
  },
} as const;

