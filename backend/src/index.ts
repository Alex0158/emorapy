import app from './app';
import { env } from './config/env';
import logger from './config/logger';
import prisma, { databaseReady } from './config/database';
import { startJobs, stopJobs } from './jobs/cleanup.job';
import { validateEnvConfig } from './config/validation';

// 驗證環境變量
validateEnvConfig();

// 生產環境若缺少 DB 初始化或連接錯誤，應阻斷啟動
Promise.resolve(databaseReady).then(() => {
  const server = app.listen(env.PORT, () => {
    logger.info(`服務器運行在端口 ${env.PORT}`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
    
    // 啟動定時任務
    startJobs();
  });
  
  // 優雅關閉
  const gracefulShutdown = async (signal: string) => {
    logger.info(`收到${signal}信號，開始優雅關閉...`);
    
    // 停止定時任務
    stopJobs();
    
    server.close(() => {
      logger.info('HTTP服務器已關閉');
    });
    
    await prisma.$disconnect();
    logger.info('數據庫連接已關閉');
    
    process.exit(0);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // 未處理的Promise拒絕
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的Promise拒絕', { reason, promise });
  });
  
  // 未捕獲的異常
  process.on('uncaughtException', (error) => {
    logger.error('未捕獲的異常', { error });
    process.exit(1);
  });
}).catch(err => {
  logger.error('服務啟動失敗：數據庫未就緒', { error: err });
  process.exit(1);
});
