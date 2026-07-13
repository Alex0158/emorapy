import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const redisConnectMock = jest.fn();
const redisInfoMock = jest.fn();
const redisDbSizeMock = jest.fn();
const redisQuitMock = jest.fn();
const redisOnMock = jest.fn();
const aiRequestLedgerFindManyMock = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: redisConnectMock,
    info: redisInfoMock,
    dbsize: redisDbSizeMock,
    quit: redisQuitMock,
    on: redisOnMock,
  }));
});

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    aIRequestLedger: {
      findMany: (...args: unknown[]) => aiRequestLedgerFindManyMock(...args),
    },
  },
}));

describe('cost-monitoring.service', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.REDIS_URL;
    delete process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_PROJECT_ID;
    delete process.env.RAILWAY_ENVIRONMENT_ID;
    delete process.env.OPENAI_BILLING_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_ORG_ID;
    (redisConnectMock as any).mockResolvedValue(undefined);
    (redisInfoMock as any).mockResolvedValue('used_memory:1048576\nconnected_clients:2\n');
    (redisDbSizeMock as any).mockResolvedValue(20);
    (redisQuitMock as any).mockResolvedValue(undefined);
    redisOnMock.mockReturnValue(undefined);
    aiRequestLedgerFindManyMock.mockResolvedValue([]);
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('缺少外部配置時應回傳 partial 並附 reasons', async () => {
    const { costMonitoringService } = await import('../../../src/services/cost-monitoring.service');
    const report = await costMonitoringService.getAdminCostReport();

    expect(report.partial).toBe(true);
    expect(report.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('redis: missing REDIS_URL'),
        expect.stringContaining('railway: missing RAILWAY_API_TOKEN'),
        expect.stringContaining('openai: missing OPENAI_BILLING_API_KEY'),
      ])
    );
    expect(report.currency).toBe('USD');
    expect(report.openai.ledger.status).toBe('ok');
    expect(report.openai.ledger.costSource).toBe('not_allocated');
  });

  it('外部 API 失敗時應降級為 partial', async () => {
    process.env.RAILWAY_API_TOKEN = 'railway-token';
    process.env.RAILWAY_PROJECT_ID = 'project-id';
    process.env.OPENAI_BILLING_API_KEY = 'openai-key';

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { costMonitoringService } = await import('../../../src/services/cost-monitoring.service');
    const report = await costMonitoringService.getAdminCostReport();

    expect(report.partial).toBe(true);
    expect(report.reasons.some((reason) => reason.includes('railway:'))).toBe(true);
    expect(report.reasons.some((reason) => reason.includes('openai:'))).toBe(true);
  });

  it('配置齊全且來源成功時應回傳 ok 資料', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.RAILWAY_API_TOKEN = 'railway-token';
    process.env.RAILWAY_PROJECT_ID = 'project-id';
    process.env.OPENAI_BILLING_API_KEY = 'openai-key';

    const fetchMock = global.fetch as any;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            usage7d: [{ tags: { environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '' }, value: 1.2 }],
            usage24h: [{ tags: { environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '' }, value: 0.3 }],
            metricsDaily: [
              {
                tags: { environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '' },
                values: [{ ts: Math.floor(Date.now() / 1000), value: 0.3 }],
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ start_time: 1700000000, amount: { value: 0.5 } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ input_tokens: 1000, output_tokens: 500 }],
        }),
      });

    const { costMonitoringService } = await import('../../../src/services/cost-monitoring.service');
    const report = await costMonitoringService.getAdminCostReport();

    expect(report.redis.status).toBe('ok');
    expect(report.railway.status).toBe('ok');
    expect(report.openai.status).toBe('ok');
    expect(report.partial).toBe(false);
    expect(report.summary.railwayEgressGb24h).toBeGreaterThan(0);
    expect(report.summary.openaiCostUsd24h).toBeGreaterThan(0);
  });

  it('應從 ai_request_ledger 回傳產品流 token breakdown，不假分攤 organization cost', async () => {
    process.env.OPENAI_BILLING_API_KEY = 'openai-key';
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    aiRequestLedgerFindManyMock.mockResolvedValueOnce([
      {
        product_flow: 'formal_remote',
        status: 'succeeded',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        cost_usd: null,
        created_at: now,
      },
      {
        product_flow: 'chat_first',
        status: 'failed',
        input_tokens: 80,
        output_tokens: 0,
        total_tokens: 80,
        cost_usd: null,
        created_at: twoDaysAgo,
      },
    ]);

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ start_time: Math.floor(now.getTime() / 1000), amount: { value: 2.5 } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ input_tokens: 1000, output_tokens: 500 }],
        }),
      });

    const { costMonitoringService } = await import('../../../src/services/cost-monitoring.service');
    const report = await costMonitoringService.getAdminCostReport();

    expect(report.openai.ledger.status).toBe('ok');
    expect(report.openai.ledger.costSource).toBe('not_allocated');
    expect(report.openai.ledger.requestCount24h).toBe(1);
    expect(report.openai.ledger.requestCount7d).toBe(2);
    expect(report.openai.ledger.inputTokens24h).toBe(100);
    expect(report.openai.ledger.inputTokens7d).toBe(180);
    expect(report.openai.ledger.productFlows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productFlow: 'formal_remote',
          requestCount24h: 1,
          totalTokens7d: 150,
          costUsd7d: null,
          costSource: 'not_allocated',
        }),
        expect.objectContaining({
          productFlow: 'chat_first',
          requestCount24h: 0,
          failedRequests7d: 1,
          totalTokens7d: 80,
          costUsd7d: null,
        }),
      ])
    );
    expect(report.summary.openaiInputTokens24h).toBe(100);
    expect(report.openai.costUsd7d).toBe(2.5);
  });

  it('ai_request_ledger product_flow 缺失時應使用集中 unknown 分桶', async () => {
    const now = new Date();
    aiRequestLedgerFindManyMock.mockResolvedValueOnce([
      {
        product_flow: null,
        status: 'succeeded',
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        cost_usd: null,
        created_at: now,
      },
      {
        product_flow: '   ',
        status: 'cancelled',
        input_tokens: 4,
        output_tokens: 0,
        total_tokens: 4,
        cost_usd: null,
        created_at: now,
      },
    ]);

    const { costMonitoringService } = await import('../../../src/services/cost-monitoring.service');
    const report = await costMonitoringService.getAdminCostReport();

    expect(report.openai.ledger.productFlows).toEqual([
      expect.objectContaining({
        productFlow: 'unknown',
        requestCount24h: 2,
        requestCount7d: 2,
        succeededRequests7d: 1,
        cancelledRequests7d: 1,
        totalTokens7d: 19,
      }),
    ]);
  });

  it('ai_request_ledger 查詢失敗時應降級為 partial', async () => {
    aiRequestLedgerFindManyMock.mockRejectedValueOnce(new Error('missing table'));

    const { costMonitoringService } = await import('../../../src/services/cost-monitoring.service');
    const report = await costMonitoringService.getAdminCostReport();

    expect(report.partial).toBe(true);
    expect(report.openai.ledger.status).toBe('partial');
    expect(report.reasons.some((reason) => reason.includes('openai ledger: missing table'))).toBe(true);
  });
});
