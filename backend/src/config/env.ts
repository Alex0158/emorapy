// 加載環境變量
// 優先級：系統環境變量 > .env 文件
// 在生產環境，通常使用系統環境變量，.env 文件主要用於開發環境
try {
  // 只在開發環境或未設置 NODE_ENV 時加載 .env 文件
  // 生產環境應使用系統環境變量（Railway、Vercel等平台提供）
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
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
  
  // 數據庫配置
  DATABASE_URL: string;
  
  // JWT配置
  JWT_SECRET: string;
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
    
    DATABASE_URL: process.env.DATABASE_URL!,
    
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
    OPENAI_DAILY_LIMIT: parseInt(process.env.OPENAI_DAILY_LIMIT || '1000', 10),
    
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    
    UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    FILE_BASE_URL: process.env.FILE_BASE_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),
    
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
  };
}

/**
 * 驗證環境變量格式
 */
function validateEnvVars(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 動態導入 logger 以避免循環依賴（logger 依賴 env）
  let logger: any;
  try {
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
    const length = process.env.JWT_SECRET.length;
    if (length < 32) {
      const message = `警告: JWT_SECRET長度建議至少32字符，當前長度: ${length}`;
      if (isProduction && length < 16) {
        throw new Error('生產環境JWT_SECRET長度必須至少16字符');
      }
      if (isDevelopment) {
        logger.warn(message);
      }
    }
    // 生產環境檢查是否為默認值
    if (isProduction && process.env.JWT_SECRET.includes('your-super-secret')) {
      throw new Error('生產環境不能使用默認JWT_SECRET，請設置強隨機密鑰');
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
