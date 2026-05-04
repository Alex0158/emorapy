import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { adminController } from '../../../src/controllers/admin.controller';

const mockCronRunLogFindMany = jest.fn();
const mockSystemConfigFindMany = jest.fn();
const mockSystemConfigCount = jest.fn();
const mockSystemConfigUpsert = jest.fn();
const mockWriteAuditLog = jest.fn();
const mockListAuditLogs = jest.fn();
const mockListAdminUsers = jest.fn();
const mockGetNumberConfig = jest.fn();
const mockGetAdminCostReport = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserCount = jest.fn();
const mockPairingCount = jest.fn();
const mockCaseCount = jest.fn();
const mockJudgmentCount = jest.fn();
const mockReconciliationPlanCount = jest.fn();
const mockExecutionRecordCount = jest.fn();
const mockInterviewSessionCount = jest.fn();
const mockNotificationCount = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationFindUnique = jest.fn();
const mockNotificationUpdate = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    cronRunLog: {
      findMany: (...args: unknown[]) => mockCronRunLogFindMany(...args),
    },
    systemConfig: {
      findMany: (...args: unknown[]) => mockSystemConfigFindMany(...args),
      count: (...args: unknown[]) => mockSystemConfigCount(...args),
      upsert: (...args: unknown[]) => mockSystemConfigUpsert(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    pairing: { count: (...args: unknown[]) => mockPairingCount(...args) },
    case: { count: (...args: unknown[]) => mockCaseCount(...args) },
    judgment: { count: (...args: unknown[]) => mockJudgmentCount(...args) },
    reconciliationPlan: { count: (...args: unknown[]) => mockReconciliationPlanCount(...args) },
    executionRecord: { count: (...args: unknown[]) => mockExecutionRecordCount(...args) },
    interviewSession: { count: (...args: unknown[]) => mockInterviewSessionCount(...args) },
    notification: {
      count: (...args: unknown[]) => mockNotificationCount(...args),
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
      findUnique: (...args: unknown[]) => mockNotificationFindUnique(...args),
      update: (...args: unknown[]) => mockNotificationUpdate(...args),
    },
  },
}));

jest.mock('../../../src/services/admin.service', () => ({
  adminService: {
    writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
    listAuditLogs: (...args: unknown[]) => mockListAuditLogs(...args),
    listAdminUsers: (...args: unknown[]) => mockListAdminUsers(...args),
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

  describe('listJobs', () => {
    it('無日誌時應返回 jobs 空陣列（F10 邊界）', async () => {
      (mockCronRunLogFindMany as any).mockResolvedValue([]);

      await adminController.listJobs(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobs: [],
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('listConfigs', () => {
    it('無配置時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
      (mockSystemConfigFindMany as any).mockResolvedValue([]);
      (mockSystemConfigCount as any).mockResolvedValue(0);
      req.query = { limit: '20', offset: '0' };

      await adminController.listConfigs(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: [],
            total: 0,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
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

  describe('reportOverview', () => {
    it('應返回 productFlows，使用共享產品流口徑統計', async () => {
      (mockUserCount as any).mockResolvedValue(10);
      (mockPairingCount as any).mockResolvedValue(4);
      (mockCaseCount as any)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(4);
      (mockJudgmentCount as any).mockResolvedValue(7);
      (mockReconciliationPlanCount as any).mockResolvedValue(6);
      (mockExecutionRecordCount as any).mockResolvedValue(5);
      (mockInterviewSessionCount as any).mockResolvedValue(9);

      await adminController.reportOverview(req as Request, res as Response, next);

      expect(mockCaseCount).toHaveBeenCalledWith({
        where: { chat_to_case_links: { some: {} } },
      });
      expect(mockCaseCount).toHaveBeenCalledWith({
        where: {
          chat_to_case_links: { none: {} },
          mode: 'collaborative',
          session_id: null,
        },
      });
      expect(mockCaseCount).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              chat_to_case_links: { none: {} },
              mode: 'remote',
            },
            {
              status: 'in_progress',
              updated_at: { lt: expect.any(Date) },
            },
          ],
        },
      });
      expect(mockCaseCount).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              chat_to_case_links: { some: {} },
            },
            {
              status: 'judgment_failed',
            },
          ],
        },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totals: expect.objectContaining({
              users: 10,
              cases: 20,
              judgments: 7,
            }),
            productFlows: [
              { key: 'quick_single', count: 3, ratio: 3 / 20 },
              { key: 'quick_collaborative', count: 2, ratio: 2 / 20 },
              { key: 'formal_remote', count: 5, ratio: 5 / 20 },
              { key: 'formal_collaborative', count: 4, ratio: 4 / 20 },
              { key: 'chat_to_case', count: 6, ratio: 6 / 20 },
            ],
            productFlowOperationalSignals: [
              {
                key: 'quick_single',
                stuckInProgressCases: 1,
                judgmentFailedCases: 0,
                attentionCases: 1,
                notificationRecallReviewRequired: true,
              },
              {
                key: 'quick_collaborative',
                stuckInProgressCases: 0,
                judgmentFailedCases: 2,
                attentionCases: 2,
                notificationRecallReviewRequired: true,
              },
              {
                key: 'formal_remote',
                stuckInProgressCases: 3,
                judgmentFailedCases: 0,
                attentionCases: 3,
                notificationRecallReviewRequired: true,
              },
              {
                key: 'formal_collaborative',
                stuckInProgressCases: 1,
                judgmentFailedCases: 1,
                attentionCases: 2,
                notificationRecallReviewRequired: true,
              },
              {
                key: 'chat_to_case',
                stuckInProgressCases: 0,
                judgmentFailedCases: 4,
                attentionCases: 4,
                notificationRecallReviewRequired: true,
              },
            ],
            conversion: expect.objectContaining({
              pairingRate: 4 / 10,
              caseCreationRate: 20 / 4,
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('reportFunnel', () => {
    it('應返回全局 funnel 與按產品流拆分的 case/judgment/execution funnel', async () => {
      (mockUserCount as any).mockResolvedValue(12);
      (mockPairingCount as any).mockResolvedValue(4);
      (mockCaseCount as any)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(5);
      (mockJudgmentCount as any)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(4);
      (mockExecutionRecordCount as any)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);

      await adminController.reportFunnel(req as Request, res as Response, next);

      expect(mockJudgmentCount).toHaveBeenCalledWith({
        where: {
          case: {
            is: {
              chat_to_case_links: { none: {} },
              mode: 'quick',
            },
          },
        },
      });
      expect(mockExecutionRecordCount).toHaveBeenCalledWith({
        where: {
          status: 'completed',
          reconciliation_plan: {
            is: {
              judgment: {
                is: {
                  case: {
                    is: {
                      chat_to_case_links: { some: {} },
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            stages: [
              { key: 'register', count: 12 },
              { key: 'pairing', count: 4 },
              { key: 'case', count: 10 },
              { key: 'judgment', count: 8 },
              { key: 'execution_complete', count: 3 },
            ],
            productFlowStages: [
              {
                key: 'quick_single',
                stages: [
                  { key: 'case', count: 1 },
                  { key: 'judgment', count: 1 },
                  { key: 'execution_complete', count: 0 },
                ],
                conversion: {
                  judgmentCompletionRate: 1,
                  executionCompletionRate: 0,
                },
              },
              {
                key: 'quick_collaborative',
                stages: [
                  { key: 'case', count: 2 },
                  { key: 'judgment', count: 1 },
                  { key: 'execution_complete', count: 1 },
                ],
                conversion: {
                  judgmentCompletionRate: 1 / 2,
                  executionCompletionRate: 1,
                },
              },
              {
                key: 'formal_remote',
                stages: [
                  { key: 'case', count: 3 },
                  { key: 'judgment', count: 2 },
                  { key: 'execution_complete', count: 1 },
                ],
                conversion: {
                  judgmentCompletionRate: 2 / 3,
                  executionCompletionRate: 1 / 2,
                },
              },
              {
                key: 'formal_collaborative',
                stages: [
                  { key: 'case', count: 4 },
                  { key: 'judgment', count: 2 },
                  { key: 'execution_complete', count: 2 },
                ],
                conversion: {
                  judgmentCompletionRate: 1 / 2,
                  executionCompletionRate: 1,
                },
              },
              {
                key: 'chat_to_case',
                stages: [
                  { key: 'case', count: 5 },
                  { key: 'judgment', count: 4 },
                  { key: 'execution_complete', count: 3 },
                ],
                conversion: {
                  judgmentCompletionRate: 4 / 5,
                  executionCompletionRate: 3 / 4,
                },
              },
            ],
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('notification management', () => {
    const notificationId = '11111111-1111-4111-8111-111111111111';
    const userId = '22222222-2222-4222-8222-222222222222';
    const createdAt = new Date('2026-05-04T00:00:00.000Z');

    it('listNotifications 應按 status/template/user/dedup 篩選並返回 render payload', async () => {
      req.query = {
        status: 'pending',
        template_code: 'repair_journey_replan',
        user_id: userId,
        dedup_key: 'repair_replan_t1_u1',
        limit: '10',
        offset: '5',
      };
      (mockNotificationCount as any).mockResolvedValue(1);
      (mockNotificationFindMany as any).mockResolvedValue([
        {
          id: notificationId,
          user_id: userId,
          channel: 'push',
          template_code: 'repair_journey_replan',
          action_key: null,
          priority: null,
          group_key: 'repair:t1',
          dedup_key: 'repair_replan_t1_u1',
          status: 'pending',
          error_message: null,
          payload: {
            repair_track_id: 'track-1',
            journey_context: { repair_access: { product_flow: 'formal_remote' } },
          },
          created_at: createdAt,
          sent_at: null,
          read_at: null,
          dismissed_at: null,
          acted_at: null,
          snoozed_until: null,
          user: { id: userId, email: 'u1@example.com' },
        },
      ]);

      await adminController.listNotifications(req as Request, res as Response, next);

      expect(mockNotificationCount).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          template_code: 'repair_journey_replan',
          user_id: userId,
          dedup_key: 'repair_replan_t1_u1',
        },
      });
      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 10,
          include: { user: { select: { id: true, email: true } } },
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: 1,
            limit: 10,
            offset: 5,
            items: [
              expect.objectContaining({
                id: notificationId,
                user_id: userId,
                dedup_key: 'repair_replan_t1_u1',
                user: { id: userId, email: 'u1@example.com' },
                render_payload: expect.objectContaining({
                  product_flow: 'formal_remote',
                  track_id: 'track-1',
                }),
              }),
            ],
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('cancelNotification 只取消 pending 並寫入 audit log', async () => {
      req.params = { notificationId };
      req.body = { reason: 'duplicate recall' };
      (mockNotificationFindUnique as any).mockResolvedValue({
        id: notificationId,
        user_id: userId,
        channel: 'push',
        template_code: 'repair_journey_replan',
        action_key: null,
        priority: null,
        group_key: 'repair:t1',
        dedup_key: 'repair_replan_t1_u1',
        status: 'pending',
        error_message: null,
        payload: {},
        created_at: createdAt,
        sent_at: null,
        read_at: null,
        dismissed_at: null,
        acted_at: null,
        snoozed_until: null,
      });
      (mockNotificationUpdate as any).mockResolvedValue({
        id: notificationId,
        user_id: userId,
        channel: 'push',
        template_code: 'repair_journey_replan',
        action_key: null,
        priority: null,
        group_key: 'repair:t1',
        dedup_key: 'repair_replan_t1_u1',
        status: 'failed',
        error_message: 'admin_cancelled: duplicate recall',
        payload: {},
        created_at: createdAt,
        sent_at: null,
        read_at: null,
        dismissed_at: null,
        acted_at: null,
        snoozed_until: null,
      });
      (mockWriteAuditLog as any).mockResolvedValue(undefined);

      await adminController.cancelNotification(req as Request, res as Response, next);

      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: {
          status: 'failed',
          error_message: 'admin_cancelled: duplicate recall',
        },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'a1',
          actorType: 'admin',
          entityType: 'notification',
          entityId: notificationId,
          action: 'cancel_pending',
          detail: expect.objectContaining({
            userId,
            dedupKey: 'repair_replan_t1_u1',
            reason: 'duplicate recall',
            status: 'failed',
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            notification: expect.objectContaining({
              id: notificationId,
              status: 'failed',
              error_message: 'admin_cancelled: duplicate recall',
            }),
          },
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('cancelNotification 遇到非 pending 通知應 next(validation error)', async () => {
      req.params = { notificationId };
      (mockNotificationFindUnique as any).mockResolvedValue({
        id: notificationId,
        user_id: userId,
        status: 'sent',
      });

      await adminController.cancelNotification(req as Request, res as Response, next);

      expect(mockNotificationUpdate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('pagination and audit serialization', () => {
    it('listUsers 無用戶時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
      (mockUserFindMany as any).mockResolvedValue([]);
      (mockUserCount as any).mockResolvedValue(0);
      req.query = { limit: '20', offset: '0' };

      await adminController.listUsers(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: [],
            total: 0,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('listUsers 分頁參數非數字時應回 VALIDATION_ERROR', async () => {
      req.query = { limit: 'abc', offset: '0' };

      await adminController.listUsers(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
      expect(mockUserFindMany).not.toHaveBeenCalled();
    });

    it('listAdminUsers 無管理員時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
      (mockListAdminUsers as any).mockResolvedValue({ items: [], total: 0 });
      req.query = { limit: '20', offset: '0' };

      await adminController.listAdminUsers(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: [],
            total: 0,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('listAuditLogs 無審計時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
      (mockListAuditLogs as any).mockResolvedValue({ items: [], total: 0 });
      req.query = { limit: '20', offset: '0' };

      await adminController.listAuditLogs(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: [],
            total: 0,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
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
