/**
 * execution.routes 單元測試（mock executionController、authenticate、validate、generalLimiter）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockConfirmExecution = jest.fn();
const mockCheckin = jest.fn();
const mockGetExecutionStatus = jest.fn();
const mockGetAllExecutionStatuses = jest.fn();

jest.mock('../../../src/controllers/execution.controller', () => ({
  executionController: {
    confirmExecution: (req: unknown, res: unknown, next: unknown) =>
      mockConfirmExecution(req, res, next),
    checkin: (req: unknown, res: unknown, next: unknown) => mockCheckin(req, res, next),
    getExecutionStatus: (req: unknown, res: unknown, next: unknown) =>
      mockGetExecutionStatus(req, res, next),
    getAllExecutionStatuses: (req: unknown, res: unknown, next: unknown) =>
      mockGetAllExecutionStatuses(req, res, next),
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
}));

import executionRouter from '../../../src/routes/execution.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', executionRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);

describe('execution.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirmExecution.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { execution: {} }, message: '執行已確認' })
    );
    mockCheckin.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { execution: {} }, message: '打卡成功' })
    );
    mockGetExecutionStatus.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: {} })
    );
    mockGetAllExecutionStatuses.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { executions: [] } })
    );
  });

  it('POST /confirm 應調用 confirmExecution 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/confirm').send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(mockConfirmExecution).toHaveBeenCalled();
  });

  it('confirmExecution 成功時應返回 data.execution（F05 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/confirm').send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('execution');
  });

  it('POST /checkin 應調用 checkin 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/checkin').send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(mockCheckin).toHaveBeenCalled();
  });

  it('checkin 成功時應返回 data.execution（F05 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/checkin').send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('execution');
  });

  it('GET /status 應調用 getExecutionStatus 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/status').query({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(mockGetExecutionStatus).toHaveBeenCalled();
  });

  it('getExecutionStatus 成功時應返回 journey fields 與回退陣列（F05 邊界）', async () => {
    const planId = '550e8400-e29b-41d4-a716-446655440000';
    const statusData = {
      plan_id: planId,
      journey_status: 'solo_active',
      relationship_mode: 'solo',
      progress: 40,
      current_step: {
        step_index: 1,
        title: '先傳一條低壓訊息',
        content: '只表達關心，不先追問。',
      },
      records: [],
      recent_checkins: [],
    };
    mockGetExecutionStatus.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: statusData })
    );
    const app = createApp();
    const res = await request(app).get('/status').query({ plan_id: planId });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan_id');
    expect(res.body.data).toHaveProperty('journey_status', 'solo_active');
    expect(res.body.data).toHaveProperty('relationship_mode', 'solo');
    expect(res.body.data).toHaveProperty('current_step');
    expect(res.body.data).toHaveProperty('records');
    expect(res.body.data).toHaveProperty('recent_checkins');
    expect(Array.isArray(res.body.data.records)).toBe(true);
    expect(Array.isArray(res.body.data.recent_checkins)).toBe(true);
    expect(res.body.data.plan_id).toBe(planId);
    expect(mockGetExecutionStatus).toHaveBeenCalled();
  });

  it('GET /dashboard 應調用 getAllExecutionStatuses 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(mockGetAllExecutionStatuses).toHaveBeenCalled();
  });

  it('getAllExecutionStatuses 成功時應返回 data.executions（F05 邊界）', async () => {
    const app = createApp();
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('executions');
    expect(Array.isArray(res.body.data.executions)).toBe(true);
  });

  it('GET /dashboard 無執行狀態時應返回 executions 空陣列（F05 邊界）', async () => {
    mockGetAllExecutionStatuses.mockImplementationOnce((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { executions: [] } })
    );
    const app = createApp();
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.executions).toEqual([]);
    expect(mockGetAllExecutionStatuses).toHaveBeenCalled();
  });

  describe('錯誤傳遞', () => {
    it('confirmExecution 調用 next(error) 時應返回 500', async () => {
      mockConfirmExecution.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('confirm failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/confirm')
        .send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'confirm failed' });
    });

    it('checkin 調用 next(error) 時應返回 500', async () => {
      mockCheckin.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('checkin failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/checkin')
        .send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'checkin failed' });
    });

    it('getExecutionStatus 調用 next(error) 時應返回 500', async () => {
      mockGetExecutionStatus.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('get status failed'));
      });
      const app = createApp();
      const res = await request(app).get('/status').query({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'get status failed' });
    });

    it('getAllExecutionStatuses 調用 next(error) 時應返回 500', async () => {
      mockGetAllExecutionStatuses.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('dashboard load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/dashboard');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'dashboard load failed' });
    });
  });
});
