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
const mockGetCommitment = jest.fn();
const mockInvitePartner = jest.fn();
const mockPausePlan = jest.fn();
const mockRespondPlan = jest.fn();
const mockReplanTrack = jest.fn();
const mockResumeTrack = jest.fn();

jest.mock('../../../src/controllers/reconciliation.controller', () => ({
  reconciliationController: {
    generatePlans: (req: unknown, res: unknown, next: unknown) =>
      mockGeneratePlans(req, res, next),
    getPlans: (req: unknown, res: unknown, next: unknown) => mockGetPlans(req, res, next),
    getPlanById: (req: unknown, res: unknown, next: unknown) =>
      mockGetPlanById(req, res, next),
    selectPlan: (req: unknown, res: unknown, next: unknown) =>
      mockSelectPlan(req, res, next),
    getCommitment: (req: unknown, res: unknown, next: unknown) =>
      mockGetCommitment(req, res, next),
    invitePartner: (req: unknown, res: unknown, next: unknown) =>
      mockInvitePartner(req, res, next),
    pausePlan: (req: unknown, res: unknown, next: unknown) =>
      mockPausePlan(req, res, next),
    respondPlan: (req: unknown, res: unknown, next: unknown) =>
      mockRespondPlan(req, res, next),
    replanTrack: (req: unknown, res: unknown, next: unknown) =>
      mockReplanTrack(req, res, next),
    resumeTrack: (req: unknown, res: unknown, next: unknown) =>
      mockResumeTrack(req, res, next),
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
      sendJson(res, { success: true, data: { plans: [], journey_entry: { status: 'none' } } })
    );
    mockGetPlanById.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plan: {} } })
    );
    mockSelectPlan.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plan: {} }, message: '方案已選擇' })
    );
    mockGetCommitment.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { commitment: { track_status: 'draft' } } })
    );
    mockInvitePartner.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { invitation: { status: 'sent' } }, message: '已送出一起試試看的邀請' })
    );
    mockPausePlan.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { commitment: { track_status: 'paused' } }, message: '已暫停這一輪修復旅程' })
    );
    mockRespondPlan.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { plan: { id: uuid } }, message: '已同步回應' })
    );
    mockReplanTrack.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { track: { track_id: 'track-1', plan_id: uuid, status: 'solo_active' } }, message: '已重新調整這一輪修復旅程' })
    );
    mockResumeTrack.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { track: { track_id: 'track-1', plan_id: uuid, status: 'solo_active' } }, message: '已恢復這一輪修復旅程' })
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

  it('GET /reconciliation-plans/:id/commitment 應調用 getCommitment 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/reconciliation-plans/${uuid}/commitment`);
    expect(res.status).toBe(200);
    expect(mockGetCommitment).toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('commitment');
  });

  it('POST /reconciliation-plans/:id/invite 應調用 invitePartner 並返回 invitation', async () => {
    const app = createApp();
    const res = await request(app).post(`/reconciliation-plans/${uuid}/invite`).send({});
    expect(res.status).toBe(200);
    expect(mockInvitePartner).toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('invitation');
  });

  it('POST /reconciliation-plans/:id/pause 應調用 pausePlan 並返回 commitment', async () => {
    const app = createApp();
    const res = await request(app).post(`/reconciliation-plans/${uuid}/pause`).send({});
    expect(res.status).toBe(200);
    expect(mockPausePlan).toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('commitment');
  });

  it('POST /reconciliation-plans/:id/respond 應調用 respondPlan 並返回 plan', async () => {
    const app = createApp();
    const res = await request(app).post(`/reconciliation-plans/${uuid}/respond`).send({ action: 'committed' });
    expect(res.status).toBe(200);
    expect(mockRespondPlan).toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('plan');
  });

  it('POST /repair-tracks/:id/replan 應調用 replanTrack 並返回 track', async () => {
    const app = createApp();
    const res = await request(app).post(`/repair-tracks/${uuid}/replan`).send({ mode: 'lower_pressure', reason: 'manual' });
    expect(res.status).toBe(200);
    expect(mockReplanTrack).toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('track');
  });

  it('POST /repair-tracks/:id/resume 應調用 resumeTrack 並返回 track', async () => {
    const app = createApp();
    const res = await request(app).post(`/repair-tracks/${uuid}/resume`).send({});
    expect(res.status).toBe(200);
    expect(mockResumeTrack).toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('track');
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

    it('getCommitment 調用 next(error) 時應返回 500', async () => {
      mockGetCommitment.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('get commitment failed'));
      });
      const app = createApp();
      const res = await request(app).get(`/reconciliation-plans/${uuid}/commitment`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'get commitment failed' });
    });

    it('invitePartner 調用 next(error) 時應返回 500', async () => {
      mockInvitePartner.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('invite partner failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/reconciliation-plans/${uuid}/invite`).send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'invite partner failed' });
    });

    it('pausePlan 調用 next(error) 時應返回 500', async () => {
      mockPausePlan.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('pause plan failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/reconciliation-plans/${uuid}/pause`).send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'pause plan failed' });
    });
  });
});
