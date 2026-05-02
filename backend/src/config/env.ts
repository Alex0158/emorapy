// 加載環境變量
// 優先級：系統環境變量 > .env 文件
// 生產環境應使用系統環境變量（Railway、Vercel等平台提供）
try {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- 必須在其它 import 前加載
    require('dotenv').config();
  }
} catch {
  // dotenv可能未安裝，忽略（生產環境可能不需要）
}

interface EnvConfig {
  // 服務器配置
  PORT: number;
  NODE_ENV: string;
  REDIS_URL?: string;
  AI_MOCK: boolean;
  AI_STREAM_SESSION_RETENTION_DAYS: number;
  AI_STREAM_EVENT_RETENTION_DAYS: number;
  AI_STREAM_ARCHIVE_ENABLED: boolean;
  AI_STREAM_ARCHIVE_BATCH_SIZE: number;
  
  // 數據庫配置
  DATABASE_URL: string;
  
  // JWT配置
  JWT_SECRET: string;
  JWT_SECRET_PREVIOUS?: string;
  JWT_EXPIRES_IN: string;
  
  // OpenAI配置
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_MAX_TOKENS: number;
  OPENAI_DAILY_LIMIT: number;
  
  // 郵件配置
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  /** 發件人信箱（可選；Resend 等需用已驗證網域，與 SMTP 登入用戶名分離） */
  EMAIL_FROM?: string;
  
  // 文件存儲配置
  UPLOAD_DIR: string;
  MAX_FILE_SIZE: number;
  
  // 前端URL
  FRONTEND_URL: string;
  FILE_BASE_URL: string;
  ALLOWED_ORIGINS: string[];
  
  // 定時任務配置
  ENABLE_SCHEDULED_JOBS: boolean;
  
  // 數據庫連接配置
  DB_CONNECT_TIMEOUT: number;
  DB_RETRY_INTERVAL: number;
  DB_MAX_RETRIES: number;
  
  // 緩存配置
  CACHE_MAX_SIZE: number;
  CACHE_CLEANUP_INTERVAL_MS: number;
  
  // 鎖配置
  LOCK_CLEANUP_INTERVAL_MS: number;

  // v2.0 心理畫像與 AI 訪談配置
  OPENAI_INTERVIEW_MODEL: string;
  OPENAI_ANALYSIS_MODEL: string;
  INTERVIEW_MAX_TURNS: number;
  INTERVIEW_SOFT_TARGET: number;
  INTERVIEW_TURN_INTERVAL_MS: number;
  INTERVIEW_START_RATE_LIMIT: number;
  INTERVIEW_DAILY_SESSION_LIMIT: number;

  // 判決個人化上下文治理配置
  JUDGMENT_ENABLE_PROFILE_CONTEXT: boolean;
  JUDGMENT_ENABLE_CASE_CONTEXT: boolean;
  JUDGMENT_PROFILE_REQUIRE_CONSENT: boolean;
  JUDGMENT_PROFILE_MAX_AGE_DAYS: number;
  JUDGMENT_CONTEXT_AUDIT_ENABLED: boolean;

  // Ops 告警配置
  OPS_ALERTS_API_BASE_URL?: string;
  OPS_ALERTS_HEALTH_TIMEOUT_MS: number;
  OPS_ALERTS_LOOKBACK_MINUTES: number;
  OPS_ALERTS_MIN_SAMPLES: number;
  OPS_ALERTS_MAX_5XX_RATIO: number;
  OPS_ALERTS_MAX_CONFLICT_RATIO: number;
  ALERT_SLACK_WEBHOOK_URL?: string;
  ALERT_SLACK_DEDUP_WINDOW_SECONDS: number;
  ALERT_HEALTH_ORIGIN?: string;

  // Metrics 暴露控制
  METRICS_ENABLED: boolean;
  METRICS_TOKEN?: string;
  METRICS_ALLOWED_IPS: string[];
}

/** 本機 Vite / 管理台常用埠；development 時與 ALLOWED_ORIGINS 合併，避免 Railway 注入僅含正式網域時擋住 localhost */
const LOCAL_DEV_ORIGINS_DEFAULT = [
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:4175',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://127.0.0.1:4175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
] as const;

function mergeAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'development') {
    return fromEnv;
  }
  return [...new Set([...LOCAL_DEV_ORIGINS_DEFAULT, ...fromEnv])];
}

function getEnvConfig(): EnvConfig {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'OPENAI_API_KEY',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    const errorMessage = `
缺少必需的環境變量: ${missingVars.join(', ')}

請檢查以下配置：
1. DATABASE_URL - 數據庫連接字符串
2. JWT_SECRET - JWT密鑰（建議使用強隨機字符串）
3. OPENAI_API_KEY - OpenAI API密鑰

請參考 .env.example 文件配置環境變量。
    `.trim();
    throw new Error(errorMessage);
  }

  // 驗證環境變量格式
  validateEnvVars();

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    REDIS_URL: process.env.REDIS_URL,
    AI_MOCK: process.env.AI_MOCK === 'true',
    AI_STREAM_SESSION_RETENTION_DAYS: parseInt(process.env.AI_STREAM_SESSION_RETENTION_DAYS || '30', 10),
    AI_STREAM_EVENT_RETENTION_DAYS: parseInt(process.env.AI_STREAM_EVENT_RETENTION_DAYS || '14', 10),
    AI_STREAM_ARCHIVE_ENABLED: process.env.AI_STREAM_ARCHIVE_ENABLED !== 'false',
    AI_STREAM_ARCHIVE_BATCH_SIZE: parseInt(process.env.AI_STREAM_ARCHIVE_BATCH_SIZE || '500', 10),
    
    DATABASE_URL: process.env.DATABASE_URL!,
    
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_SECRET_PREVIOUS: process.env.JWT_SECRET_PREVIOUS,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
    OPENAI_DAILY_LIMIT: parseInt(process.env.OPENAI_DAILY_LIMIT || '1000', 10),
    
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    
    UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    FILE_BASE_URL: process.env.FILE_BASE_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
    ALLOWED_ORIGINS: mergeAllowedOrigins(),
    
    // 定時任務配置（默認：生產環境啟用，開發環境可通過環境變量禁用）
    ENABLE_SCHEDULED_JOBS: process.env.ENABLE_SCHEDULED_JOBS !== 'false' && 
                           (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_JOBS === 'true'),
    
    // 數據庫連接配置
    DB_CONNECT_TIMEOUT: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10), // 10秒
    DB_RETRY_INTERVAL: parseInt(process.env.DB_RETRY_INTERVAL || '3000', 10), // 3秒
    DB_MAX_RETRIES: parseInt(process.env.DB_MAX_RETRIES || '3', 10), // 3次
    
    // 緩存配置
    CACHE_MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10), // 1000條
    CACHE_CLEANUP_INTERVAL_MS: parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS || '300000', 10), // 5分鐘
    
    // 鎖配置
    LOCK_CLEANUP_INTERVAL_MS: parseInt(process.env.LOCK_CLEANUP_INTERVAL_MS || '60000', 10), // 1分鐘

    // v2.0 心理畫像與 AI 訪談配置
    OPENAI_INTERVIEW_MODEL: process.env.OPENAI_INTERVIEW_MODEL || 'gpt-4o-mini',
    OPENAI_ANALYSIS_MODEL: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o',
    INTERVIEW_MAX_TURNS: parseInt(process.env.INTERVIEW_MAX_TURNS || '25', 10),
    INTERVIEW_SOFT_TARGET: parseInt(process.env.INTERVIEW_SOFT_TARGET || '15', 10),
    INTERVIEW_TURN_INTERVAL_MS: parseInt(process.env.INTERVIEW_TURN_INTERVAL_MS || '3000', 10),
    INTERVIEW_START_RATE_LIMIT: parseInt(process.env.INTERVIEW_START_RATE_LIMIT || '3', 10),
    INTERVIEW_DAILY_SESSION_LIMIT: parseInt(process.env.INTERVIEW_DAILY_SESSION_LIMIT || '5', 10),

    // 判決個人化上下文治理配置
    JUDGMENT_ENABLE_PROFILE_CONTEXT: process.env.JUDGMENT_ENABLE_PROFILE_CONTEXT !== 'false',
    JUDGMENT_ENABLE_CASE_CONTEXT: process.env.JUDGMENT_ENABLE_CASE_CONTEXT !== 'false',
    JUDGMENT_PROFILE_REQUIRE_CONSENT: process.env.JUDGMENT_PROFILE_REQUIRE_CONSENT !== 'false',
    JUDGMENT_PROFILE_MAX_AGE_DAYS: parseInt(process.env.JUDGMENT_PROFILE_MAX_AGE_DAYS || '365', 10),
    JUDGMENT_CONTEXT_AUDIT_ENABLED: process.env.JUDGMENT_CONTEXT_AUDIT_ENABLED !== 'false',

    // Ops 告警配置
    OPS_ALERTS_API_BASE_URL: process.env.OPS_ALERTS_API_BASE_URL,
    OPS_ALERTS_HEALTH_TIMEOUT_MS: parseInt(process.env.OPS_ALERTS_HEALTH_TIMEOUT_MS || '5000', 10),
    OPS_ALERTS_LOOKBACK_MINUTES: parseInt(process.env.OPS_ALERTS_LOOKBACK_MINUTES || '15', 10),
    OPS_ALERTS_MIN_SAMPLES: parseInt(process.env.OPS_ALERTS_MIN_SAMPLES || '30', 10),
    OPS_ALERTS_MAX_5XX_RATIO: Number(process.env.OPS_ALERTS_MAX_5XX_RATIO || '0.05'),
    OPS_ALERTS_MAX_CONFLICT_RATIO: Number(process.env.OPS_ALERTS_MAX_CONFLICT_RATIO || '0.2'),
    ALERT_SLACK_WEBHOOK_URL: process.env.ALERT_SLACK_WEBHOOK_URL,
    ALERT_SLACK_DEDUP_WINDOW_SECONDS: parseInt(process.env.ALERT_SLACK_DEDUP_WINDOW_SECONDS || '600', 10),
    ALERT_HEALTH_ORIGIN: process.env.ALERT_HEALTH_ORIGIN,

    // Metrics 暴露控制
    METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
    METRICS_TOKEN: process.env.METRICS_TOKEN,
    METRICS_ALLOWED_IPS: (process.env.METRICS_ALLOWED_IPS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  };
}

/**
 * 驗證環境變量格式
 */
function validateEnvVars(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 動態導入 logger 以避免循環依賴（logger 依賴 env）
  let logger: { warn: (msg: string) => void };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- 動態導入避免循環依賴
    logger = require('./logger').default;
  } catch {
    // 如果 logger 尚未初始化，使用 console（僅在極少數情況下）
    // 只在開發環境使用 console，生產環境應確保 logger 可用
    if (isDevelopment) {
      logger = { warn: console.warn };
    } else {
      // 生產環境如果 logger 不可用，使用空函數（避免 console 輸出）
      logger = { warn: () => {} };
    }
  }

  // 驗證DATABASE_URL格式
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    const message = '警告: DATABASE_URL格式可能不正確，應以postgresql://開頭';
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(message);
  }

  // 驗證JWT_SECRET強度
  if (process.env.JWT_SECRET) {
    const secret = process.env.JWT_SECRET;
    const length = secret.length;
    if (isProduction) {
      if (!process.env.JWT_EXPIRES_IN) {
        throw new Error('生產環境必須顯式設置 JWT_EXPIRES_IN，避免默認值漂移');
      }
      if (/[\r\n]/.test(secret)) {
        throw new Error('生產環境 JWT_SECRET 不得包含換行，請檢查是否誤貼多行環境變量');
      }
      if (/(?:^|[\r\n])(JWT_[A-Z0-9_]*|OPENAI_[A-Z0-9_]*|DATABASE_URL)=/m.test(secret)) {
        throw new Error('JWT_SECRET 疑似包含 KEY=VALUE 片段，請僅保留密鑰字串');
      }
      if (length < 32) {
        throw new Error(`生產環境JWT_SECRET長度必須至少32字符，當前長度: ${length}`);
      }
      if (secret.includes('your-super-secret') || secret.includes('changeme') || secret.includes('secret')) {
        throw new Error('生產環境不能使用默認JWT_SECRET，請設置強隨機密鑰');
      }
      // 檢查低熵值（全相同字元）
      if (new Set(secret).size < 8) {
        throw new Error('JWT_SECRET 熵值過低，請使用包含多種字元的隨機字串');
      }
    } else if (length < 32) {
      logger.warn(`警告: JWT_SECRET長度建議至少32字符，當前長度: ${length}`);
    }
  }

  // 驗證 ADMIN_JWT_SECRET（管理員專用密鑰，生產環境必填）
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  if (isProduction) {
    if (!adminSecret || !adminSecret.trim()) {
      throw new Error('生產環境必須設置 ADMIN_JWT_SECRET，且不得回退到 JWT_SECRET');
    }
  }
  if (adminSecret && adminSecret.trim()) {
    const normalizedAdminSecret = adminSecret.trim();
    if (isProduction) {
      if (/[\r\n]/.test(normalizedAdminSecret)) {
        throw new Error('生產環境 ADMIN_JWT_SECRET 不得包含換行');
      }
      if (/(?:^|[\r\n])(JWT_[A-Z0-9_]*|OPENAI_[A-Z0-9_]*|DATABASE_URL)=/m.test(normalizedAdminSecret)) {
        throw new Error('ADMIN_JWT_SECRET 疑似包含 KEY=VALUE 片段，請僅保留密鑰字串');
      }
      if (normalizedAdminSecret.length < 32) {
        throw new Error(`生產環境 ADMIN_JWT_SECRET 長度必須至少32字符，當前長度: ${normalizedAdminSecret.length}`);
      }
      if (new Set(normalizedAdminSecret).size < 8) {
        throw new Error('ADMIN_JWT_SECRET 熵值過低，請使用高隨機字串');
      }
      if (normalizedAdminSecret === process.env.JWT_SECRET) {
        throw new Error('生產環境 ADMIN_JWT_SECRET 不可與 JWT_SECRET 相同');
      }
    } else if (normalizedAdminSecret.length < 32) {
      logger.warn(`警告: ADMIN_JWT_SECRET 長度建議至少32字符，當前長度: ${normalizedAdminSecret.length}`);
    }
  }

  // 驗證OPENAI_API_KEY格式
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    const message = '警告: OPENAI_API_KEY格式可能不正確，應以sk-開頭';
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(message);
  }
  // 生產環境檢查是否為示例值
  if (isProduction && process.env.OPENAI_API_KEY?.includes('your-openai-api-key')) {
    throw new Error('生產環境不能使用示例OPENAI_API_KEY，請設置真實的API密鑰');
  }

  // 驗證端口範圍
  const port = parseInt(process.env.PORT || '3000', 10);
  if (port < 1 || port > 65535) {
    throw new Error(`無效的端口號: ${port}，應在1-65535之間`);
  }

  // 驗證OpenAI配置
  const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
  if (maxTokens < 1 || maxTokens > 4000) {
    const message = `警告: OPENAI_MAX_TOKENS應在1-4000之間，當前值: ${maxTokens}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(message);
  }

  const dailyLimit = parseInt(process.env.OPENAI_DAILY_LIMIT || '1000', 10);
  if (dailyLimit < 1) {
    const message = `警告: OPENAI_DAILY_LIMIT應大於0，當前值: ${dailyLimit}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(message);
  }

  // 生產環境額外驗證
  if (isProduction) {
    const metricsEnabled = process.env.METRICS_ENABLED !== 'false';
    const metricsToken = process.env.METRICS_TOKEN?.trim();
    const metricsAllowedIps = (process.env.METRICS_ALLOWED_IPS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (metricsEnabled && !metricsToken && metricsAllowedIps.length === 0) {
      throw new Error(
        '生產環境啟用 METRICS 時，必須設置 METRICS_TOKEN 或 METRICS_ALLOWED_IPS 以保護 /metrics'
      );
    }

    // 驗證FRONTEND_URL格式
    if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('https://')) {
      logger.warn('警告: 生產環境FRONTEND_URL建議使用HTTPS');
    }

    // 驗證ALLOWED_ORIGINS
    if (process.env.ALLOWED_ORIGINS) {
      const origins = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
      const hasHttp = origins.some(origin => origin.startsWith('http://'));
      if (hasHttp) {
        logger.warn('警告: 生產環境ALLOWED_ORIGINS建議使用HTTPS');
      }
    }
  }
}

export const env = getEnvConfig();
