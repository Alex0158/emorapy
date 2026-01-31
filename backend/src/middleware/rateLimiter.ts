import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';

// 根據環境調整限流配置
const isDevelopment = env.NODE_ENV === 'development';
const isProduction = env.NODE_ENV === 'production';

// 開發環境：更寬鬆的限流（方便調試）
// 生產環境：嚴格的限流（安全）
const getRateLimitConfig = (productionMax: number, developmentMultiplier: number = 10) => {
  const max = isDevelopment ? productionMax * developmentMultiplier : productionMax;
  return { max };
};

// 通用限流
// 開發環境：每分鐘1000次，生產環境：每分鐘100次
const generalLimitConfig = getRateLimitConfig(100, 10);
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分鐘
  max: generalLimitConfig.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '請求過於頻繁，請稍後再試',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 生產環境：禁用 trust proxy 驗證（Railway 等平台需要 trust proxy，且會正確設置代理頭）
  // 開發環境：不需要此配置
  validate: isProduction ? { trustProxy: false } : undefined,
  // 開發環境跳過限流（方便調試）
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 認證接口限流
// 開發環境：每5分鐘100次，生產環境：每5分鐘10次
const authLimitConfig = getRateLimitConfig(10, 10);
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分鐘
  max: authLimitConfig.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '認證請求過於頻繁，請稍後再試',
    },
  },
  skipSuccessfulRequests: true, // 成功請求不計入限流
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 註冊接口限流
// 開發環境：每小時50次，生產環境：每小時5次
const registerLimitConfig = getRateLimitConfig(5, 10);
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小時
  max: registerLimitConfig.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '註冊請求過於頻繁，請稍後再試',
    },
  },
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 驗證碼接口限流（每郵箱每5分鐘1次）
// 開發環境：每5分鐘10次，生產環境：每5分鐘1次
const verificationLimitConfig = getRateLimitConfig(1, 10);
export const verificationCodeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分鐘
  max: verificationLimitConfig.max,
  keyGenerator: (req: Request) => {
    return (req.body?.email || req.ip) as string;
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '驗證碼發送過於頻繁，請稍後再試',
    },
  },
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// AI接口限流
// 開發環境：每小時100次，生產環境：每小時10次
const aiLimitConfig = getRateLimitConfig(10, 10);
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小時
  max: aiLimitConfig.max,
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    return userId ?? req.ip ?? 'anonymous';
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'AI服務請求過於頻繁，請稍後再試',
    },
  },
  skipSuccessfulRequests: false, // AI請求都計入限流
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 文件上傳限流
// 開發環境：每分鐘50次，生產環境：每分鐘5次
const uploadLimitConfig = getRateLimitConfig(5, 10);
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分鐘
  max: uploadLimitConfig.max,
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] as string;
    return userId ?? sessionId ?? req.ip ?? 'anonymous';
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '文件上傳過於頻繁，請稍後再試',
    },
  },
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 文件下載/訪問限流（保護 /uploads）
const downloadLimitConfig = getRateLimitConfig(60, 10); // 生產60/分鐘，開發600/分鐘
export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: downloadLimitConfig.max,
  keyGenerator: (req: Request) => (req.ip || 'unknown'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '訪問過於頻繁，請稍後再試',
    },
  },
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});
