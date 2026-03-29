/**
 * judgment.routes 單元測試（mock judgmentController、optionalAuthenticate、authenticate、validate、limiters）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGenerateJudgment = jest.fn();
const mockGetJudgmentById = jest.fn();
const mockAcceptJudgment = jest.fn();
const mockRepairJudgment = jest.fn();
const mockRecordClinicalMetrics = jest.fn();

jest.mock('../../../src/controllers/judgment.controller', () => ({
  judgmentController: {
    generateJudgment: (req: unknown, res: unknown, next: unknown) =>
      mockGenerateJudgment(req, res, next),
    getJudgmentById: (req: unknown, res: unknown, next: unknown) =>
      mockGetJudgmentById(req, res, next),
    acceptJudgment: (req: unknown, res: unknown, next: unknown) =>
      mockAcceptJudgment(req, res, next),
    repairJudgment: (req: unknown, res: unknown, next: unknown) =>
      mockRepairJudgment(req, res, next),
    recordClinicalMetrics: (req: unknown, res: unknown, next: unknown) =>
      mockRecordClinicalMetrics(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import judgmentRouter from '../../../src/routes/judgment.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', judgmentRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);
const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('judgment.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateJudgment.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { judgment: {} } })
    );
    mockGetJudgmentById.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { judgment: {} } })
    );
    mockAcceptJudgment.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { judgment: {} }, message: '判決已接受' })
    );
    mockRepairJudgment.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { acknowledged: true }, message: '已生成修復版回應' })
    );
    mockRecordClinicalMetrics.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { ok: true }, message: '已記錄臨床品質指標' })
    );
  });

  it('POST /generate/:id 應調用 generateJudgment 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/generate/${uuid}`);
    expect(res.status).toBe(200);
    expect(mockGenerateJudgment).toHaveBeenCalled();
  });

  it('generateJudgment 成功時應返回 data.judgment（F04 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post(`/generate/${uuid}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('judgment');
  });

  it('GET /:id 應調用 getJudgmentById 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/${uuid}`);
    expect(res.status).toBe(200);
    expect(mockGetJudgmentById).toHaveBeenCalled();
  });

  it('getJudgmentById 成功時應返回 data.judgment（F04 邊界）', async () => {
    const judgmentData = { id: uuid, case_id: 'c1', judgment_content: '判決內容', plaintiff_ratio: 60 };
    mockGetJudgmentById.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { judgment: judgmentData } })
    );
    const app = createApp();
    const res = await request(app).get(`/${uuid}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('judgment');
    expect(res.body.data.judgment).toMatchObject({ id: uuid, case_id: 'c1' });
    expect(mockGetJudgmentById).toHaveBeenCalled();
  });

  it('POST /:id/accept 應調用 acceptJudgment 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/accept`).send({ accepted: true });
    expect(res.status).toBe(200);
    expect(mockAcceptJudgment).toHaveBeenCalled();
  });

  it('acceptJudgment 成功時應返回 data.judgment（F04 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/accept`).send({ accepted: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('judgment');
  });

  it('POST /:id/repair 應調用 repairJudgment 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/repair`).send({ feedback: '請修復' });
    expect(res.status).toBe(200);
    expect(mockRepairJudgment).toHaveBeenCalled();
  });

  it('repairJudgment 成功時應返回 data（F04 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/repair`).send({ feedback: '請修復' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('POST /:id/metrics 應調用 recordClinicalMetrics 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/metrics`).send({
      felt_understood: 5,
      felt_blamed: 1,
      willing_to_try: 4,
    });
    expect(res.status).toBe(200);
    expect(mockRecordClinicalMetrics).toHaveBeenCalled();
  });

  it('recordClinicalMetrics 成功時應返回 data（F04 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/metrics`).send({
      felt_understood: 5,
      felt_blamed: 1,
      willing_to_try: 4,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  describe('錯誤傳遞', () => {
    it('generateJudgment 調用 next(error) 時應返回 500', async () => {
      mockGenerateJudgment.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('generate failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/generate/${uuid}`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'generate failed' });
    });

    it('getJudgmentById 調用 next(error) 時應返回 500', async () => {
      mockGetJudgmentById.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('get failed'));
      });
      const app = createApp();
      const res = await request(app).get(`/${uuid}`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'get failed' });
    });

    it('acceptJudgment 調用 next(error) 時應返回 500', async () => {
      mockAcceptJudgment.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('accept failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/${uuid}/accept`).send({ accepted: true });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'accept failed' });
    });

    it('repairJudgment 調用 next(error) 時應返回 500', async () => {
      mockRepairJudgment.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('repair failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/${uuid}/repair`).send({ feedback: '請修復' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'repair failed' });
    });

    it('recordClinicalMetrics 調用 next(error) 時應返回 500', async () => {
      mockRecordClinicalMetrics.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('metrics failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/${uuid}/metrics`).send({
        felt_understood: 5,
        felt_blamed: 1,
        willing_to_try: 4,
      });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'metrics failed' });
    });
  });
});
