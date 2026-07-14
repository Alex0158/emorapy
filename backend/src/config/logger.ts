import winston from 'winston';
import { env } from './env';
import { redactLogInfo } from '../utils/log-redaction';

const isJestRuntime = process.env.NODE_ENV === 'test';
const fileTransports = isJestRuntime
  ? []
  : [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ];

const redactSensitiveMetadata = () => winston.format((info) => redactLogInfo(info))();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    redactSensitiveMetadata(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.LOG_SERVICE_NAME || process.env.EMORAPY_LOG_SERVICE_NAME || 'emorapy-backend',
    service_legacy: 'mother-bear-court-backend',
  },
  transports: fileTransports,
});

// 始終輸出到控制台，確保 PaaS（如 Railway）可直接收集應用日誌
logger.add(new winston.transports.Console({
  level: process.env.CONSOLE_LOG_LEVEL || undefined,
  format: env.NODE_ENV === 'production'
    ? winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        redactSensitiveMetadata(),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        redactSensitiveMetadata(),
        winston.format.colorize(),
        winston.format.simple()
      ),
}));

export default logger;
