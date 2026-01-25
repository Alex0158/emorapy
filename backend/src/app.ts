import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { generalLimiter, downloadLimiter } from './middleware/rateLimiter';
import { responseFormatter } from './middleware/responseFormatter';
import { requestId } from './middleware/requestId';
import { performanceMonitor } from './middleware/performance';
import { authorizeMedia } from './middleware/auth';

// 導入路由
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';
import pairingRoutes from './routes/pairing.routes';
import caseRoutes from './routes/case.routes';
import judgmentRoutes from './routes/judgment.routes';
import reconciliationRoutes from './routes/reconciliation.routes';
import executionRoutes from './routes/execution.routes';
import contentRoutes from './routes/content.routes';
import profileRoutes from './routes/profile.routes';
import notificationRoutes from './routes/notification.routes';

const app: Application = express();

// 信任代理配置
// 開發環境：不信任代理（本地開發）
// 生產環境：信任代理（Railway、Vercel等反向代理環境必需）
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
} else {
  // 開發環境：只信任環回地址
  app.set('trust proxy', 'loopback');
}

// 安全中間件
// 開發環境：更寬鬆的 CSP（方便開發工具和熱重載）
// 生產環境：嚴格的 CSP（安全）
const helmetConfig = env.NODE_ENV === 'production'
  ? {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // 允許內聯樣式（Ant Design需要）
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    }
  : {
      contentSecurityPolicy: false, // 開發環境禁用 CSP（方便開發工具）
    };

app.use(helmet(helmetConfig));

// CORS配置
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允許的來源'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
}));

// 壓縮響應
app.use(compression());

// 解析JSON請求體
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 捕獲 JSON 解析錯誤，返回 400
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: '無效的JSON請求體',
      },
    });
  }
  return next(err);
});

// 請求ID（必須在日誌之前）
app.use(requestId);

// 性能監控（必須在日誌之前）
app.use(performanceMonitor);

// 請求日誌
app.use(requestLogger);

// 響應格式化
app.use(responseFormatter);

// 通用限流
app.use(generalLimiter);

// 靜態文件服務（上傳文件）- 需要認證或有效 Session；僅允許 GET/HEAD
const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(process.cwd(), env.UPLOAD_DIR);
app.use('/uploads', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: '僅支持 GET/HEAD 訪問文件' },
    });
  }
  return downloadLimiter(req, res, (err: any) => {
    if (err) return next(err);
    authorizeMedia(req, res, (err2: any) => {
      if (err2) return next(err2);
      return express.static(uploadPath)(req, res, next);
    });
  });
});

// 健康檢查路由（不限制流，用於監控）
app.use('/', healthRoutes);

// API路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1', profileRoutes);
app.use('/api/v1/pairing', pairingRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/judgments', judgmentRoutes);
app.use('/api/v1', reconciliationRoutes);
app.use('/api/v1/execution', executionRoutes);
app.use('/api/v1', contentRoutes);
app.use('/api/v1', notificationRoutes);

// 404處理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在',
    },
  });
});

// 錯誤處理（必須在最後）
app.use(errorHandler);

export default app;
