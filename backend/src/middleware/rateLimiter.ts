import rateLimit from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { getSessionIdFromSources } from '../utils/request';
import { translateBackendMessage } from '../i18n';

// 根據環境調整限流配置
const isDevelopment = env.NODE_ENV === 'development';
const isProduction = env.NODE_ENV === 'production';

// 開發環境：更寬鬆的限流（方便調試）
// 生產環境：嚴格的限流（安全）
const getRateLimitConfig = (productionMax: number, developmentMultiplier: number) => {
  const max = isDevelopment ? productionMax * developmentMultiplier : productionMax;
  return { max };
};

const createRateLimitHandler = (zhMessage: string) => (
  req: Request,
  res: Response,
  _next: NextFunction,
  _options: unknown
) => {
  const locale = req.locale ?? 'zh-TW';
  return res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: translateBackendMessage(locale, zhMessage),
    },
  });
};

// 通用限流
// 開發環境：每分鐘1000次，生產環境：每分鐘100次
const generalLimitConfig = getRateLimitConfig(100, 10);
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分鐘
  max: generalLimitConfig.max,
  handler: createRateLimitHandler('請求過於頻繁，請稍後再試'),
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
  handler: createRateLimitHandler('認證請求過於頻繁，請稍後再試'),
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
  handler: createRateLimitHandler('註冊請求過於頻繁，請稍後再試'),
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
  handler: createRateLimitHandler('驗證碼發送過於頻繁，請稍後再試'),
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 驗證碼驗證接口限流（防暴力破解6位數字驗證碼）
// 生產環境：每15分鐘5次（per email+IP），開發環境放寬
const verifyCodeLimitConfig = getRateLimitConfig(5, 10);
export const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: verifyCodeLimitConfig.max,
  keyGenerator: (req: Request) => {
    const email = req.body?.email || '';
    return `verify_${email}_${req.ip}`;
  },
  handler: createRateLimitHandler('驗證碼嘗試過於頻繁，請15分鐘後再試'),
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 重設密碼請求限流（防郵件轟炸）
const resetPasswordLimitConfig = getRateLimitConfig(3, 10);
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: resetPasswordLimitConfig.max,
  keyGenerator: (req: Request) => {
    return `reset_${req.body?.email || req.ip}`;
  },
  handler: createRateLimitHandler('重設密碼請求過於頻繁，請稍後再試'),
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 重設密碼確認限流（防暴力破解驗證碼）
const resetConfirmLimitConfig = getRateLimitConfig(5, 10);
export const resetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: resetConfirmLimitConfig.max,
  keyGenerator: (req: Request) => {
    const email = req.body?.email || '';
    return `resetConfirm_${email}_${req.ip}`;
  },
  handler: createRateLimitHandler('重設密碼嘗試過於頻繁，請15分鐘後再試'),
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 配對加入限流（防邀請碼暴力破解）
const pairingJoinLimitConfig = getRateLimitConfig(5, 10);
export const pairingJoinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: pairingJoinLimitConfig.max,
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    return `pairingJoin_${userId ?? req.ip}`;
  },
  handler: createRateLimitHandler('配對嘗試過於頻繁，請稍後再試'),
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
  handler: createRateLimitHandler('AI服務請求過於頻繁，請稍後再試'),
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
    const { sessionId } = getSessionIdFromSources(req);
    return userId ?? sessionId ?? req.ip ?? 'anonymous';
  },
  handler: createRateLimitHandler('文件上傳過於頻繁，請稍後再試'),
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});

// 文件下載/訪問限流（保護 /uploads）
const downloadLimitConfig = getRateLimitConfig(60, 10); // 生產60/分鐘，開發600/分鐘
export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: downloadLimitConfig.max,
  keyGenerator: (req: Request) => (req.ip || 'unknown'),
  handler: createRateLimitHandler('訪問過於頻繁，請稍後再試'),
  validate: isProduction ? { trustProxy: false } : undefined,
  skip: (_req: Request, _res: Response) => isDevelopment && process.env.SKIP_RATE_LIMIT === 'true',
});
