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

  it('POST /checkin 應調用 checkin 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/checkin').send({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(mockCheckin).toHaveBeenCalled();
  });

  it('GET /status 應調用 getExecutionStatus 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/status').query({ plan_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(res.status).toBe(200);
    expect(mockGetExecutionStatus).toHaveBeenCalled();
  });

  it('GET /dashboard 應調用 getAllExecutionStatuses 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(mockGetAllExecutionStatuses).toHaveBeenCalled();
  });
});
