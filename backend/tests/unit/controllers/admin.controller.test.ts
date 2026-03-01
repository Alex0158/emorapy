import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { adminController } from '../../../src/controllers/admin.controller';

const mockCronRunLogFindMany = jest.fn();
const mockSystemConfigUpsert = jest.fn();
const mockWriteAuditLog = jest.fn();
const mockListAuditLogs = jest.fn();
const mockGetNumberConfig = jest.fn();
const mockGetAdminCostReport = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserCount = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    cronRunLog: {
      findMany: (...args: unknown[]) => mockCronRunLogFindMany(...args),
    },
    systemConfig: {
      upsert: (...args: unknown[]) => mockSystemConfigUpsert(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
  },
}));

jest.mock('../../../src/services/admin.service', () => ({
  adminService: {
    writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
    listAuditLogs: (...args: unknown[]) => mockListAuditLogs(...args),
  },
}));

jest.mock('../../../src/jobs/cleanup.job', () => ({
  adminJobs: [],
  getRuntimeJobsEnabled: jest.fn(),
  jobsStarted: false,
  reconcileJobsRuntimeConfig: jest.fn(),
  runAdminJobNow: jest.fn(),
}));

jest.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    INTERVIEW_MAX_TURNS: 30,
    INTERVIEW_SOFT_TARGET: 10,
    INTERVIEW_TURN_INTERVAL_MS: 0,
    INTERVIEW_START_RATE_LIMIT: 2,
    INTERVIEW_DAILY_SESSION_LIMIT: 3,
  },
}));

jest.mock('../../../src/middleware/performance', () => ({
  getPerformanceStats: jest.fn(() => ({})),
}));

jest.mock('../../../src/services/system-config.service', () => ({
  systemConfigService: {
    getNumberConfig: (...args: unknown[]) => mockGetNumberConfig(...args),
  },
}));

jest.mock('../../../src/services/cost-monitoring.service', () => ({
  costMonitoringService: {
    getAdminCostReport: (...args: unknown[]) => mockGetAdminCostReport(...args),
  },
}));

describe('AdminController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNumberConfig.mockImplementation(async (...args: any[]) => args[1]);
    req = {
      body: {},
      params: {},
      query: {},
      admin: { id: 'a1', email: 'admin@test.com', roleKey: 'super_admin', permissions: ['admin:all'] },
    } as unknown as Partial<Request>;
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
  });

  describe('upsertConfig', () => {
    it('白名單外 key 應拒絕', async () => {
      req.body = { key: 'unexpected.key', value: true };

      await adminController.upsertConfig(req as Request, res as Response, next);

      expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
    });

    it('interview.maxTurns 超出範圍應拒絕', async () => {
      req.body = { key: 'interview.maxTurns', value: 2 };

      await adminController.upsertConfig(req as Request, res as Response, next);

      expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('jobs.enabled 字串 true 應正規化為 boolean', async () => {
      req.body = { key: 'jobs.enabled', value: 'true' };
      (mockSystemConfigUpsert as any).mockResolvedValue({
        id: 'cfg1',
        key: 'jobs.enabled',
        value: true,
        is_sensitive: false,
      });

      await adminController.upsertConfig(req as Request, res as Response, next);

      expect(mockSystemConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ value: true }),
          update: expect.objectContaining({ value: true }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('softTarget 大於 maxTurns 應拒絕', async () => {
      req.body = { key: 'interview.softTarget', value: 40 };
      mockGetNumberConfig.mockImplementation(async (...args: any[]) => {
        const [key, fallback] = args;
        if (key === 'interview.maxTurns') return 30;
        return fallback;
      });

      await adminController.upsertConfig(req as Request, res as Response, next);

      expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('maxTurns 小於 softTarget 應拒絕', async () => {
      req.body = { key: 'interview.maxTurns', value: 8 };
      mockGetNumberConfig.mockImplementation(async (...args: any[]) => {
        const [key, fallback] = args;
        if (key === 'interview.softTarget') return 10;
        return fallback;
      });

      await adminController.upsertConfig(req as Request, res as Response, next);

      expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('upsert 發生資料庫錯誤時應 next(error)', async () => {
      req.body = { key: 'jobs.enabled', value: true };
      (mockSystemConfigUpsert as any).mockRejectedValue(new Error('db down'));

      await adminController.upsertConfig(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getJobStats', () => {
    it('應回傳連續 dailyBuckets 並正確聚合', async () => {
      const now = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      (mockCronRunLogFindMany as any).mockResolvedValue([
        {
          job_name: 'cleanup_expired_sessions',
          status: 'success',
          started_at: now,
          duration_ms: 120,
          affected_count: 3,
        },
        {
          job_name: 'cleanup_expired_sessions',
          status: 'failed',
          started_at: yesterday,
          duration_ms: 200,
          affected_count: 0,
        },
      ]);
      req.query = { days: '3' };

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            days: 3,
            totals: expect.objectContaining({
              totalRuns: 2,
              successRuns: 1,
              failedRuns: 1,
              completedRuns: 2,
              successRate: 0.5,
              failureRate: 0.5,
              successRateCompleted: 0.5,
              failureRateCompleted: 0.5,
            }),
            dailyBuckets: expect.arrayContaining([
              expect.objectContaining({ totalRuns: 0, completedRuns: 0, successRate: 0, failureRate: 0, successRateCompleted: 0, failureRateCompleted: 0 }),
              expect.objectContaining({ totalRuns: 1, completedRuns: 1, successRate: 1, failureRate: 0, successRateCompleted: 1, failureRateCompleted: 0 }),
              expect.objectContaining({ totalRuns: 1, completedRuns: 1, successRate: 0, failureRate: 1, successRateCompleted: 0, failureRateCompleted: 1 }),
            ]),
            perJob: expect.arrayContaining([
              expect.objectContaining({
                jobKey: 'cleanup_expired_sessions',
                totalRuns: 2,
                completedRuns: 2,
                successRate: 0.5,
                failureRate: 0.5,
                successRateCompleted: 0.5,
                failureRateCompleted: 0.5,
                avgDurationMs: 160,
                totalAffectedCount: 3,
              }),
            ]),
            statsMeta: expect.objectContaining({
              maxRows: 5000,
              returnedRows: 2,
              sampled: false,
            }),
          }),
        })
      );
      expect(mockCronRunLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5001 })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('無資料時應回傳 0 與空比率', async () => {
      (mockCronRunLogFindMany as any).mockResolvedValue([]);
      req.query = { days: '2' };

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totals: expect.objectContaining({
              totalRuns: 0,
              completedRuns: 0,
              successRate: 0,
              failureRate: 0,
              successRateCompleted: 0,
              failureRateCompleted: 0,
            }),
            perJob: [],
            dailyBuckets: expect.arrayContaining([
              expect.objectContaining({ totalRuns: 0, completedRuns: 0, successRate: 0, failureRate: 0, successRateCompleted: 0, failureRateCompleted: 0 }),
            ]),
            statsMeta: expect.objectContaining({
              maxRows: 5000,
              returnedRows: 0,
              sampled: false,
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('含 running 狀態時比率應以 totalRuns 為分母', async () => {
      const now = new Date();
      (mockCronRunLogFindMany as any).mockResolvedValue([
        { job_name: 'j1', status: 'success', started_at: now, duration_ms: 100, affected_count: 1 },
        { job_name: 'j1', status: 'failed', started_at: now, duration_ms: 200, affected_count: 0 },
        { job_name: 'j1', status: 'running', started_at: now, duration_ms: null, affected_count: 0 },
      ]);

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totals: expect.objectContaining({
              totalRuns: 3,
              successRuns: 1,
              failedRuns: 1,
              runningRuns: 1,
              completedRuns: 2,
              successRate: 0.3333,
              failureRate: 0.3333,
              successRateCompleted: 0.5,
              failureRateCompleted: 0.5,
            }),
            perJob: expect.arrayContaining([
              expect.objectContaining({
                totalRuns: 3,
                completedRuns: 2,
                successRate: 0.3333,
                failureRate: 0.3333,
                successRateCompleted: 0.5,
                failureRateCompleted: 0.5,
              }),
            ]),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('includeRunning=false 時 success/failure rate 應以 completedRuns 為分母', async () => {
      const now = new Date();
      (mockCronRunLogFindMany as any).mockResolvedValue([
        { job_name: 'j1', status: 'success', started_at: now, duration_ms: 100, affected_count: 1 },
        { job_name: 'j1', status: 'failed', started_at: now, duration_ms: 200, affected_count: 0 },
        { job_name: 'j1', status: 'running', started_at: now, duration_ms: null, affected_count: 0 },
      ]);
      req.query = { includeRunning: 'false' };

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            rateBase: 'completed_runs',
            totals: expect.objectContaining({
              totalRuns: 3,
              completedRuns: 2,
              successRate: 0.5,
              failureRate: 0.5,
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('maxRows 過小時應被 clamp 至 100', async () => {
      const now = new Date();
      (mockCronRunLogFindMany as any).mockResolvedValue([
        { job_name: 'j1', status: 'success', started_at: now, duration_ms: 100, affected_count: 1 },
      ]);
      req.query = { maxRows: '1' };

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            statsMeta: expect.objectContaining({
              maxRows: 100,
              returnedRows: 1,
              sampled: false,
            }),
          }),
        })
      );
      expect(mockCronRunLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('logs 筆數等於 maxRows 時不應標記 sampled', async () => {
      const now = new Date();
      const rows = Array.from({ length: 100 }, () => ({
        job_name: 'j1',
        status: 'success',
        started_at: now,
        duration_ms: 100,
        affected_count: 1,
      }));
      (mockCronRunLogFindMany as any).mockResolvedValue(rows);
      req.query = { maxRows: '100' };

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            statsMeta: expect.objectContaining({
              maxRows: 100,
              returnedRows: 100,
              sampled: false,
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('回傳筆數超過 maxRows 時應標記 sampled=true', async () => {
      const now = new Date();
      (mockCronRunLogFindMany as any).mockResolvedValue(
        Array.from({ length: 101 }, () => ({
          job_name: 'j1',
          status: 'success',
          started_at: now,
          duration_ms: 100,
          affected_count: 1,
        }))
      );
      req.query = { maxRows: '100' };

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            statsMeta: expect.objectContaining({
              maxRows: 100,
              returnedRows: 100,
              sampled: true,
            }),
          }),
        })
      );
      expect(mockCronRunLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('查詢失敗時應 next(error)', async () => {
      (mockCronRunLogFindMany as any).mockRejectedValue(new Error('db down'));

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('response contract 應包含關鍵欄位', async () => {
      const now = new Date();
      (mockCronRunLogFindMany as any).mockResolvedValue([
        { job_name: 'j1', status: 'success', started_at: now, duration_ms: 123, affected_count: 1 },
      ]);

      await adminController.getJobStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            days: expect.any(Number),
            since: expect.any(String),
            totals: expect.objectContaining({
              totalRuns: expect.any(Number),
              completedRuns: expect.any(Number),
              successRate: expect.any(Number),
              failureRate: expect.any(Number),
            }),
            perJob: expect.any(Array),
            dailyBuckets: expect.any(Array),
            rateBase: expect.stringMatching(/total_runs|completed_runs/),
            statsMeta: expect.objectContaining({
              maxRows: expect.any(Number),
              returnedRows: expect.any(Number),
              sampled: expect.any(Boolean),
              sampleStrategy: 'latest_runs_desc',
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('reportCosts', () => {
    it('應回傳成本報告資料', async () => {
      (mockGetAdminCostReport as any).mockResolvedValue({
        generatedAt: '2026-01-01T00:00:00.000Z',
        currency: 'USD',
        partial: true,
        reasons: ['railway unavailable'],
        summary: {
          redisMemoryMb: 10,
          redisTotalKeys: 20,
          railwayEgressGb24h: 0,
          railwayEgressGb7d: 0,
          openaiCostUsd24h: 0,
          openaiCostUsd7d: 0,
          openaiInputTokens24h: 0,
          openaiOutputTokens24h: 0,
        },
        redis: { status: 'ok', memoryUsedBytes: 100, connectedClients: 1, totalKeys: 20 },
        railway: { status: 'unavailable', egressGb24h: 0, egressGb7d: 0, dailyEgressGb: [] },
        openai: {
          status: 'unavailable',
          costUsd24h: 0,
          costUsd7d: 0,
          inputTokens24h: 0,
          outputTokens24h: 0,
          dailyCostUsd: [],
        },
      });

      await adminController.reportCosts(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            currency: 'USD',
            partial: true,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('成本報告異常時應 next(error)', async () => {
      (mockGetAdminCostReport as any).mockRejectedValue(new Error('cost source down'));

      await adminController.reportCosts(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('pagination and audit serialization', () => {
    it('listUsers 分頁參數非數字時應回 VALIDATION_ERROR', async () => {
      req.query = { limit: 'abc', offset: '0' };

      await adminController.listUsers(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
      expect(mockUserFindMany).not.toHaveBeenCalled();
    });

    it('listAuditLogs 應將 BigInt id 轉為字串', async () => {
      req.query = {};
      (mockListAuditLogs as any).mockResolvedValue({
        items: [
          {
            id: BigInt(123),
            actor_id: 'a1',
            actor_type: 'admin',
            entity_type: 'user',
            entity_id: 'u1',
            action: 'user_lock',
            detail: { lockMinutes: 30 },
            created_at: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
        total: 1,
      });

      await adminController.listAuditLogs(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: [
              expect.objectContaining({
                id: '123',
              }),
            ],
            total: 1,
          }),
        })
      );
    });

    it('exportAuditLogsCsv 應對可疑公式前綴做安全轉義', async () => {
      req.query = {};
      (mockListAuditLogs as any).mockResolvedValue({
        items: [
          {
            id: BigInt(9),
            actor_id: '=cmd|\' /C calc\'!A0',
            actor_type: 'admin',
            entity_type: 'user',
            entity_id: 'u1',
            action: '@SUM(1,2)',
            detail: '-danger',
            created_at: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
        total: 1,
      });

      await adminController.exportAuditLogsCsv(req as Request, res as Response, next);

      expect((res.setHeader as jest.Mock)).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      const payload = (res.send as jest.Mock).mock.calls[0][0] as string;
      expect(payload).toContain('"\'=cmd|');
      expect(payload).toContain('"\'@SUM(1,2)"');
      expect(payload).toContain('"\'-danger"');
      expect(next).not.toHaveBeenCalled();
    });

    it('exportAuditLogsCsv 應對前置空白後的公式前綴做安全轉義', async () => {
      req.query = {};
      (mockListAuditLogs as any).mockResolvedValue({
        items: [
          {
            id: BigInt(10),
            actor_id: '  =2+2',
            actor_type: 'admin',
            entity_type: 'user',
            entity_id: 'u1',
            action: 'ok',
            detail: '\t@SUM(A1:A2)',
            created_at: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
        total: 1,
      });

      await adminController.exportAuditLogsCsv(req as Request, res as Response, next);

      const payload = (res.send as jest.Mock).mock.calls[0][0] as string;
      expect(payload).toContain('"\'  =2+2"');
      expect(payload).toContain('"\'\t@SUM(A1:A2)"');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
