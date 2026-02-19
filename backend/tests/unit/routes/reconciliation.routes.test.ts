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

  it('GET /judgments/:id/reconciliation-plans 應調用 getPlans 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/judgments/${uuid}/reconciliation-plans`);
    expect(res.status).toBe(200);
    expect(mockGetPlans).toHaveBeenCalled();
  });

  it('GET /reconciliation-plans/:id 應調用 getPlanById 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/reconciliation-plans/${uuid}`);
    expect(res.status).toBe(200);
    expect(mockGetPlanById).toHaveBeenCalled();
  });

  it('POST /reconciliation-plans/:id/select 應調用 selectPlan 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/reconciliation-plans/${uuid}/select`).send({});
    expect(res.status).toBe(200);
    expect(mockSelectPlan).toHaveBeenCalled();
  });
});
