/**
 * routes/health.routes 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { RELEASE_BLOCKING_MIGRATIONS } from '../../../src/config/release-migrations';

const mockPrismaQueryRaw = jest.fn();
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockEnvRef = { current: { NODE_ENV: 'test' as string } };
const mockJobsStartedRef = { current: true };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: { $queryRaw: (...args: unknown[]) => mockPrismaQueryRaw(...args) },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef.current;
  },
}));
jest.mock('../../../src/jobs/cleanup.job', () => ({
  get jobsStarted() {
    return mockJobsStartedRef.current;
  },
}));
const mockGetBackendStatus = jest.fn();
jest.mock('../../../src/utils/lock', () => ({
  lockService: {
    getBackendStatus: () => mockGetBackendStatus(),
  },
}));
const mockGetAIStreamBackendMode = jest.fn();
jest.mock('../../../src/services/ai-stream.service', () => ({
  aiStreamService: {
    getBackendMode: () => mockGetAIStreamBackendMode(),
  },
}));
const mockGetEmailReadiness = jest.fn();
jest.mock('../../../src/services/email.service', () => ({
  emailService: {
    getReadiness: () => mockGetEmailReadiness(),
  },
}));

import healthRouter from '../../../src/routes/health.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', healthRouter);
  return app;
}

describe('routes/health.routes', () => {
  const origEnv = process.env;

  beforeEach(() => {
    mockPrismaQueryRaw.mockReset();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockGetBackendStatus.mockReturnValue('redis');
    mockGetAIStreamBackendMode.mockReturnValue('redis');
    mockGetEmailReadiness.mockReturnValue({ mode: 'disabled', status: 'disabled' });
    mockEnvRef.current = { NODE_ENV: 'test' };
    mockJobsStartedRef.current = true;
    process.env = { ...origEnv };
    process.env.DATABASE_URL = 'postgres://test';
    process.env.JWT_SECRET = 'secret';
    process.env.OPENAI_API_KEY = 'key';
    process.env.SKIP_DB_INIT = 'true';
  });

  describe('GET /health', () => {
    it('測試環境且 SKIP_DB_INIT 時應跳過 DB 檢查', async () => {
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.checks.database).toEqual({
        status: 'skipped',
        message: 'DB check skipped in test mode',
      });
      expect(res.body.status).toBe('healthy');
      expect(mockPrismaQueryRaw).not.toHaveBeenCalled();
    });

    it('SKIP_DB_INIT=false 時應執行 DB 檢查', async () => {
      process.env.SKIP_DB_INIT = 'false';
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(undefined as never);
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.checks.database.status).toBe('healthy');
      expect(res.body.checks.database.responseTime).toBeDefined();
      expect(mockPrismaQueryRaw).toHaveBeenCalled();
    });

    it('DB 檢查失敗時應標記為 degraded', async () => {
      process.env.SKIP_DB_INIT = 'false';
      (mockPrismaQueryRaw as unknown as jest.Mock).mockRejectedValue(new Error('Connection refused') as never);
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.database.status).toBe('unhealthy');
      expect(res.body.checks.database.message).toBeTruthy();
    });

    it('缺少環境變量時 environment 應為 unhealthy', async () => {
      delete process.env.JWT_SECRET;
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.checks.environment.status).toBe('unhealthy');
      expect(res.body.checks.environment.message).toContain('missing');
    });

    it('cron 未啟動且非 test 時應標記 degraded', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockJobsStartedRef.current = false;
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.checks.cron.status).toBe('unhealthy');
      expect(res.body.status).toBe('degraded');
    });

    it('應返回 timestamp、uptime、checks、responseTime、version', async () => {
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('checks');
      expect(res.body).toHaveProperty('responseTime');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('commitSha');
      expect(res.body).toHaveProperty('commitShortSha');
    });

    it('lock backend 為 simple-lock-degraded 時應標記 degraded（F10 邊界）', async () => {
      mockGetBackendStatus.mockReturnValueOnce('simple-lock-degraded');
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.lock).toEqual({
        status: 'degraded',
        message: 'Lock backend degraded: simple-lock in production',
      });
    });

    it('production 且 AI Stream backend 非 redis 時應標記 degraded', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({ mode: 'smtp', status: 'ready', verifiedAt: '2026-07-13T00:00:00.000Z' });
      mockGetAIStreamBackendMode.mockReturnValueOnce('memory');
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.aiStream).toEqual({
        status: 'degraded',
        message: 'AI Stream backend: memory',
      });
    });

    it('test 中 AI Stream backend mode 仍應出現在 health payload', async () => {
      mockGetAIStreamBackendMode.mockReturnValueOnce('memory');
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.checks.aiStream).toEqual({
        status: 'healthy',
        message: 'AI Stream backend: memory',
      });
    });

    it('production email transport 未 ready 時應標記 degraded', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({ mode: 'smtp', status: 'unavailable' });
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.emailDelivery).toEqual({
        status: 'unhealthy',
        message: 'Email delivery: unavailable',
      });
    });

    it('degraded 時應記錄 logger.warn', async () => {
      process.env.SKIP_DB_INIT = 'false';
      (mockPrismaQueryRaw as unknown as jest.Mock).mockRejectedValue(new Error('DB error') as never);
      const app = createApp();
      await request(app).get('/health');
      expect(mockLogger.warn).toHaveBeenCalledWith('Health check degraded', expect.any(Object));
    });

    it('degraded 且 development 時 logger.warn 應帶完整 checks 對象', async () => {
      process.env.SKIP_DB_INIT = 'false';
      mockEnvRef.current = { NODE_ENV: 'development' };
      (mockPrismaQueryRaw as unknown as jest.Mock).mockRejectedValue(new Error('DB error') as never);
      const app = createApp();
      await request(app).get('/health');
      expect(mockLogger.warn).toHaveBeenCalledWith('Health check degraded', {
        checks: expect.objectContaining({
          database: expect.any(Object),
          environment: expect.any(Object),
          cron: expect.any(Object),
        }),
      });
    });

    it('development 且 healthy 時應記錄 logger.info', async () => {
      mockEnvRef.current = { NODE_ENV: 'development' };
      const app = createApp();
      await request(app).get('/health');
      expect(mockLogger.info).toHaveBeenCalledWith('Health check passed', expect.objectContaining({
        responseTime: expect.any(Number),
        checks: expect.any(Object),
      }));
    });

    it('非 development 且 healthy 且 responseTime > 1000 時應記錄 logger.warn (slow)', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({ mode: 'smtp', status: 'ready', verifiedAt: '2026-07-13T00:00:00.000Z' });
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(1001);
      const app = createApp();
      await request(app).get('/health');
      expect(mockLogger.warn).toHaveBeenCalledWith('Health check passed but slow', {
        responseTime: 1001,
      });
      dateNowSpy.mockRestore();
    });
  });

  describe('GET /health/ready', () => {
    const appliedReleaseMigrations = RELEASE_BLOCKING_MIGRATIONS.map(migration_name => ({
      migration_name,
      finished_at: new Date('2026-07-12T00:00:00.000Z'),
      rolled_back_at: null,
    }));

    it('DB 與 release migrations 正常時應返回 200 ready', async () => {
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(
        appliedReleaseMigrations as never
      );
      const app = createApp();
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ready',
        database: {
          releaseMigrations: 'ready',
          requiredMigrationCount: RELEASE_BLOCKING_MIGRATIONS.length,
        },
        emailDelivery: {
          mode: 'disabled',
          status: 'disabled',
        },
      });
    });

    it('production email transport 未 ready 時應返回 503', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({ mode: 'smtp', status: 'unavailable' });
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(appliedReleaseMigrations as never);
      const app = createApp();
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
    });

    it('production email 僅 status ready 但未有 startup verifiedAt 時應返回 503', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({ mode: 'smtp', status: 'ready' });
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(appliedReleaseMigrations as never);

      const res = await request(createApp()).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
    });

    it('production email runtime outage 後應返回 503，不得沿用 startup ready', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({
        mode: 'smtp',
        status: 'unavailable',
        verifiedAt: '2026-07-13T00:00:00.000Z',
        lastAcceptedAt: '2026-07-13T00:05:00.000Z',
      });
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(appliedReleaseMigrations as never);

      const res = await request(createApp()).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: 'not ready' });
    });

    it('ready payload 應區分 startup verifiedAt 與最後 provider acceptance', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      mockGetEmailReadiness.mockReturnValue({
        mode: 'smtp',
        status: 'ready',
        verifiedAt: '2026-07-13T00:00:00.000Z',
        lastAcceptedAt: '2026-07-13T00:05:00.000Z',
      });
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(appliedReleaseMigrations as never);

      const res = await request(createApp()).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.emailDelivery).toEqual({
        mode: 'smtp',
        status: 'ready',
        verifiedAt: '2026-07-13T00:00:00.000Z',
        lastAcceptedAt: '2026-07-13T00:05:00.000Z',
      });
    });

    it('缺少 required release migration 時應返回 503 not ready', async () => {
      (mockPrismaQueryRaw as unknown as jest.Mock).mockResolvedValue(
        appliedReleaseMigrations.slice(1) as never
      );
      const app = createApp();
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
    });

    it('DB 失敗時應返回 503 not ready', async () => {
      (mockPrismaQueryRaw as unknown as jest.Mock).mockRejectedValue(new Error('Connection failed') as never);
      const app = createApp();
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
      expect(res.body.error).toBeTruthy();
    });

    it('development 時 DB 失敗 error 應為實際錯誤訊息（F10 邊界）', async () => {
      mockEnvRef.current = { NODE_ENV: 'development' };
      (mockPrismaQueryRaw as unknown as jest.Mock).mockRejectedValue(new Error('Connection refused') as never);
      const app = createApp();
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Connection refused');
    });
  });

  describe('GET /health/live', () => {
    it('應返回 200 alive', async () => {
      const app = createApp();
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'alive' });
    });
  });

  describe('GET /version', () => {
    it('應返回 backend version manifest，包含 commitSha 與 commitShortSha', async () => {
      process.env.EMORAPY_COMMIT_SHA = '1234567890abcdef';
      const app = createApp();
      const res = await request(app).get('/version');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        service: 'backend',
        commitSha: '1234567890abcdef',
        commitShortSha: '1234567',
      });
      expect(res.body.version).toEqual(expect.any(String));
      expect(res.body.timestamp).toEqual(expect.any(String));
    });
  });

  describe('GET /health handler 異常', () => {
    it('getBackendStatus 拋錯時應返回 500', async () => {
      mockGetBackendStatus.mockImplementationOnce(() => {
        throw new Error('lock backend error');
      });
      const app = createApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Internal health check');
    });
  });
});
