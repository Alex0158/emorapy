import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { env } from './env';
import logger from './logger';

// 解析 DATABASE_URL 以進行診斷
function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      hasPassword: !!parsed.password,
      username: parsed.username,
    };
  } catch (error) {
    return null;
  }
}

// 支援測試環境可選 SQLite（需 TEST_USE_SQLITE=true，默認關閉以避免 provider 不匹配）
const databaseUrl =
  (env.NODE_ENV === 'test' && process.env.TEST_USE_SQLITE === 'true')
    ? process.env.TEST_SQLITE_URL || 'file:./tmp/test.db'
    : env.DATABASE_URL;

if (env.NODE_ENV === 'test' && process.env.TEST_USE_SQLITE === 'true' && !databaseUrl.startsWith('file:')) {
  throw new Error('TEST_USE_SQLITE=true 但未提供 SQLite URL（file: 開頭），請檢查 TEST_SQLITE_URL');
}

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// 連接數據庫並運行遷移
async function initializeDatabase() {
  // 測試環境默認跳過初始化（避免打開連接與定時器），除非顯式要求
  if (env.NODE_ENV === 'test' && process.env.SKIP_DB_INIT !== 'false') {
    logger.info('測試環境跳過數據庫初始化', { reason: 'SKIP_DB_INIT!=false' });
    return;
  }
  try {
    // 診斷 DATABASE_URL 配置
    const dbInfo = parseDatabaseUrl(databaseUrl);
    if (dbInfo) {
      logger.info('數據庫連接信息', {
        hostname: dbInfo.hostname,
        port: dbInfo.port || '5432 (默認)',
        database: dbInfo.pathname,
        username: dbInfo.username,
        hasPassword: dbInfo.hasPassword,
      });
    } else {
      logger.warn('無法解析 DATABASE_URL，請檢查格式');
    }

    // 先運行數據庫遷移（如果需要的話）
    // 默認只在開發環境自動遷移；測試/生產需顯式 RUN_MIGRATIONS=true
    const shouldRunMigrations =
      process.env.RUN_MIGRATIONS === 'true' ||
      (env.NODE_ENV === 'development' && process.env.RUN_MIGRATIONS !== 'false');

    if (shouldRunMigrations && databaseUrl.startsWith('file:')) {
      logger.info('使用 SQLite 測試庫，運行 Prisma db push 以同步 schema');
      execSync('npx prisma db push --accept-data-loss', {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: databaseUrl },
        cwd: process.cwd(),
        timeout: 30000,
      });
    }
    if (shouldRunMigrations && !databaseUrl.startsWith('file:')) {
      try {
        logger.info('正在運行數據庫遷移...');
        execSync('npx prisma db push --accept-data-loss', { 
          stdio: 'pipe',
          env: { ...process.env },
          cwd: process.cwd(),
          timeout: 30000 // 30秒超時
        });
        logger.info('數據庫遷移完成');
      } catch (migrationError: any) {
        // 如果遷移失敗，記錄詳細錯誤但繼續嘗試連接
        const errorMessage = migrationError.message || migrationError.toString();
        const errorOutput = migrationError.stdout?.toString() || migrationError.stderr?.toString() || '';
        
        logger.warn('數據庫遷移失敗，嘗試直接連接', { 
          error: errorMessage,
          output: errorOutput.substring(0, 500), // 限制輸出長度
        });
        
        // 檢查是否是連接問題
        if (errorMessage.includes('P1001') || errorMessage.includes("Can't reach database server")) {
          logger.error('無法連接到數據庫服務器，請檢查：', {
            suggestions: [
              '1. 確認 Supabase 項目是否處於活動狀態',
              '2. 檢查 Supabase 的 IP 白名單設置（應允許所有 IP 或添加 Railway IP）',
              '3. 驗證 DATABASE_URL 是否正確（特別是密碼中的特殊字符需要 URL 編碼）',
              '4. 確認 Supabase 數據庫沒有暫停',
            ],
          });
        }
        // 不退出，繼續嘗試連接（可能表已經存在）
      }
    }
    if (!shouldRunMigrations) {
      logger.info('跳過自動遷移：RUN_MIGRATIONS 未啟用或處於生產環境保護模式', {
        env: env.NODE_ENV,
      });
    }

    // 連接數據庫（帶重試機制）
    const maxRetries = env.DB_MAX_RETRIES || 3;
    const connectTimeout = env.DB_CONNECT_TIMEOUT || 10000;
    const retryInterval = env.DB_RETRY_INTERVAL || 3000;
    
    let retries = maxRetries;

    while (retries > 0) {
      try {
        // 設置連接超時（可配置）
        await Promise.race([
          prisma.$connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`連接超時（${connectTimeout}ms）`)), connectTimeout)
          ),
        ]);
        
        // 測試連接：執行一個簡單查詢
        await prisma.$queryRaw`SELECT 1`;
        
        logger.info('數據庫連接成功並驗證通過');
        return; // 連接成功，退出函數
      } catch (connectError: unknown) {
        retries--;
        const err = connectError as { code?: string; errorCode?: string; name?: string; message?: string };
        const errorCode = err.code || err.errorCode || 'UNKNOWN';
        const errorName = err.name || 'UnknownError';
        const errorMessage = err.message || String(connectError);
        
        if (retries > 0) {
          // 根據環境調整日誌級別
          if (env.NODE_ENV === 'development') {
            logger.warn(`數據庫連接失敗，${retries} 次重試機會`, { 
              errorCode,
              errorName,
              error: errorMessage.substring(0, 200),
            });
          } else {
            logger.warn(`數據庫連接失敗，${retries} 次重試機會`, { 
              errorCode,
              errorName,
            });
          }
          await new Promise(resolve => setTimeout(resolve, retryInterval)); // 等待後重試
        } else {
          // 最後一次失敗，提供詳細診斷
          logger.error('數據庫連接失敗，已用盡所有重試機會', { 
            errorCode,
            errorName,
            error: errorMessage,
          });
          
          // 根據錯誤類型提供建議
          if (errorCode === 'P1001' || errorMessage.includes("Can't reach database server")) {
            logger.error('連接診斷建議：', {
              problem: '無法到達數據庫服務器',
              possibleCauses: [
                'Supabase 項目可能已暫停或限制連接',
                'IP 白名單設置可能阻止了 Railway 的 IP',
                '網絡路由問題（Railway 到 Supabase）',
                'DATABASE_URL 配置錯誤',
              ],
              solutions: [
                '1. 登錄 Supabase Dashboard，檢查項目狀態',
                '2. 在 Supabase Settings > Database > Connection Pooling 中檢查 IP 限制',
                '3. 確認 DATABASE_URL 中的密碼已正確 URL 編碼（@ 應為 %40）',
                '4. 嘗試使用 Supabase 的 Connection Pooling URL（如果可用）',
                '5. 檢查 Supabase 項目的使用配額是否已超限',
              ],
            });
          } else if (errorCode === 'P1000' || errorMessage.includes('Authentication failed')) {
            logger.error('認證失敗，請檢查：', {
              problem: '數據庫認證失敗',
              solutions: [
                '1. 驗證 DATABASE_URL 中的用戶名和密碼是否正確',
                '2. 確認密碼中的特殊字符已正確 URL 編碼',
                '3. 檢查 Supabase 數據庫用戶權限',
              ],
            });
          }
        }
      }
    }
    
    // 所有重試都失敗
    logger.warn('應用將繼續運行，但數據庫功能可能不可用');
    logger.warn('請檢查 Railway 環境變量中的 DATABASE_URL 配置');
  } catch (error) {
    logger.error('數據庫初始化過程中發生未預期的錯誤', { error });
    logger.warn('應用將繼續運行，但數據庫功能可能不可用');
  }
}

export const databaseReady = initializeDatabase();

// 優雅關閉
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('數據庫連接已關閉');
});

export default prisma;
