/**
 * reconciliation.routes 單元測試（mock reconciliationController、authenticate、validate、limiters）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGeneratePlans = jest.fn();
const mockGetPlans = jest.fn();
const mockGetPlanById = jest.fn();
const mockSelectPlan = jest.fn();

jest.mock('../../../src/controllers/reconciliation.controller', () => ({
  reconciliationController: {
    generatePlans: (req: unknown, res: unknown, next: unknown) =>
      mockGeneratePlans(req, res, next),
    getPlans: (req: unknown, res: unknown, next: unknown) => mockGetPlans(req, res, next),
    getPlanById: (req: unknown, res: unknown, next: unknown) =>
      mockGetPlanById(req, res, next),
    selectPlan: (req: unknown, res: unknown, next: unknown) =>
      mockSelectPlan(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import reconciliationRouter from '../../../src/routes/reconciliation.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', reconciliationRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);
const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('reconciliation.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGeneratePlans.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plans: [] }, message: '和好方案已生成' })
    );
    mockGetPlans.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plans: [] } })
    );
    mockGetPlanById.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plan: {} } })
    );
    mockSelectPlan.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plan: {} }, message: '方案已選擇' })
    );
  });

  it('POST /judgments/:id/reconciliation-plans 應調用 generatePlans 並返回 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/judgments/${uuid}/reconciliation-plans`)
      .send({ preferences: {} });
    expect(res.status).toBe(200);
    expect(mockGeneratePlans).toHaveBeenCalled();
  });

  it('generatePlans 成功時應返回 data.plans（F05 邊界）', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/judgments/${uuid}/reconciliation-plans`)
      .send({ preferences: {} });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plans');
    expect(Array.isArray(res.body.data.plans)).toBe(true);
  });

  it('GET /judgments/:id/reconciliation-plans 應調用 getPlans 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/judgments/${uuid}/reconciliation-plans`);
    expect(res.status).toBe(200);
    expect(mockGetPlans).toHaveBeenCalled();
  });

  it('getPlans 成功時應返回 data.plans（F05 邊界）', async () => {
    const app = createApp();
    const res = await request(app).get(`/judgments/${uuid}/reconciliation-plans`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plans');
    expect(Array.isArray(res.body.data.plans)).toBe(true);
  });

  it('GET /judgments/:id/reconciliation-plans 無方案時應返回 plans 空陣列（F05 邊界）', async () => {
    mockGetPlans.mockImplementationOnce((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plans: [] } })
    );
    const app = createApp();
    const res = await request(app).get(`/judgments/${uuid}/reconciliation-plans`);
    expect(res.status).toBe(200);
    expect(res.body.data.plans).toEqual([]);
    expect(mockGetPlans).toHaveBeenCalled();
  });

  it('GET /reconciliation-plans/:id 應調用 getPlanById 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/reconciliation-plans/${uuid}`);
    expect(res.status).toBe(200);
    expect(mockGetPlanById).toHaveBeenCalled();
  });

  it('getPlanById 成功時應返回 data.plan（F05 邊界）', async () => {
    const planData = { id: uuid, judgment_id: 'j1', plan_content: '{}', time_cost: 30 };
    mockGetPlanById.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { plan: planData } })
    );
    const app = createApp();
    const res = await request(app).get(`/reconciliation-plans/${uuid}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan');
    expect(res.body.data.plan).toMatchObject({ id: uuid, judgment_id: 'j1' });
    expect(mockGetPlanById).toHaveBeenCalled();
  });

  it('POST /reconciliation-plans/:id/select 應調用 selectPlan 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/reconciliation-plans/${uuid}/select`).send({});
    expect(res.status).toBe(200);
    expect(mockSelectPlan).toHaveBeenCalled();
  });

  it('selectPlan 成功時應返回 data.plan（F05 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post(`/reconciliation-plans/${uuid}/select`).send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan');
  });

  describe('錯誤傳遞', () => {
    it('generatePlans 調用 next(error) 時應返回 500', async () => {
      mockGeneratePlans.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('generate plans failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post(`/judgments/${uuid}/reconciliation-plans`)
        .send({ preferences: {} });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'generate plans failed' });
    });

    it('getPlans 調用 next(error) 時應返回 500', async () => {
      mockGetPlans.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('get plans failed'));
      });
      const app = createApp();
      const res = await request(app).get(`/judgments/${uuid}/reconciliation-plans`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'get plans failed' });
    });

    it('getPlanById 調用 next(error) 時應返回 500', async () => {
      mockGetPlanById.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('get plan failed'));
      });
      const app = createApp();
      const res = await request(app).get(`/reconciliation-plans/${uuid}`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'get plan failed' });
    });

    it('selectPlan 調用 next(error) 時應返回 500', async () => {
      mockSelectPlan.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('select plan failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/reconciliation-plans/${uuid}/select`).send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'select plan failed' });
    });
  });
});
