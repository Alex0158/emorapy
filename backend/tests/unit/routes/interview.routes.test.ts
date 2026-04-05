/**
 * interview.routes 單元測試（mock controller、auth、consent、rateLimiter、validator）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockStartSession = jest.fn();
const mockRespond = jest.fn();
const mockEndSession = jest.fn();
const mockSkip = jest.fn();
const mockCancel = jest.fn();
const mockCheckResume = jest.fn();
const mockGetSession = jest.fn();
const mockRetryFailed = jest.fn();

jest.mock('../../../src/controllers/interview.controller', () => ({
  interviewController: {
    startSession: (req: unknown, res: unknown, next: unknown) => mockStartSession(req, res, next),
    respond: (req: unknown, res: unknown, next: unknown) => mockRespond(req, res, next),
    endSession: (req: unknown, res: unknown, next: unknown) => mockEndSession(req, res, next),
    skip: (req: unknown, res: unknown, next: unknown) => mockSkip(req, res, next),
    cancel: (req: unknown, res: unknown, next: unknown) => mockCancel(req, res, next),
    checkResume: (req: unknown, res: unknown, next: unknown) => mockCheckResume(req, res, next),
    getSession: (req: unknown, res: unknown, next: unknown) => mockGetSession(req, res, next),
    retryFailed: (req: unknown, res: unknown, next: unknown) => mockRetryFailed(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/consent', () => ({
  requireConsent: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  interviewStartLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  interviewRespondLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import interviewRouter from '../../../src/routes/interview.routes';

const sessionId = '550e8400-e29b-41d4-a716-446655440000';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u1', email: 'u1@test.com' };
    next();
  });
  app.use('/interview', interviewRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

function mockResJson(res: unknown, body: unknown) {
  return (res as { status: (n: number) => { json: (b: unknown) => void } }).status(200).json(body);
}

describe('interview.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartSession.mockImplementation((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } }).status(201).json({ success: true, data: { id: sessionId, status: 'in_progress', turns: [] }, message: '訪談已開始' })
    );
    mockRespond.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true })
    );
    mockEndSession.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true, data: { status: 'processing' } })
    );
    mockSkip.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true })
    );
    mockCancel.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true, data: { cancelled: true } })
    );
    mockCheckResume.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true, data: null })
    );
    mockGetSession.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true, data: { id: sessionId, status: 'in_progress', turns: [] } })
    );
    mockRetryFailed.mockImplementation((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true, data: { status: 'processing' } })
    );
  });

  it('POST /interview/start 應調用 startSession 並返回 201', async () => {
    const app = createApp();
    const res = await request(app).post('/interview/start').send({ trigger: 'organic' });
    expect(res.status).toBe(201);
    expect(mockStartSession).toHaveBeenCalledTimes(1);
  });

  it('startSession 成功時應返回 data 含 id、status、turns（F06 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/interview/start').send({ trigger: 'organic' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('turns');
    expect(Array.isArray(res.body.data.turns)).toBe(true);
  });

  it('POST /interview/:id/respond 應調用 respond 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/interview/${sessionId}/respond`).send({ message: 'hello' });
    expect(res.status).toBe(200);
    expect(mockRespond).toHaveBeenCalledTimes(1);
  });

  it('POST /interview/:id/end 應調用 endSession 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/interview/${sessionId}/end`);
    expect(res.status).toBe(200);
    expect(mockEndSession).toHaveBeenCalledTimes(1);
  });

  it('POST /interview/:id/skip 應調用 skip 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/interview/${sessionId}/skip`).send({});
    expect(res.status).toBe(200);
    expect(mockSkip).toHaveBeenCalledTimes(1);
  });

  it('POST /interview/:id/cancel 應調用 cancel 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/interview/${sessionId}/cancel`).send({});
    expect(res.status).toBe(200);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('GET /interview/resume 應調用 checkResume 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/interview/resume');
    expect(res.status).toBe(200);
    expect(mockCheckResume).toHaveBeenCalledTimes(1);
  });

  it('checkResume 成功時應返回 data（F06 邊界）', async () => {
    const app = createApp();
    const res = await request(app).get('/interview/resume');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /interview/:id 應調用 getSession 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/interview/${sessionId}`);
    expect(res.status).toBe(200);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('getSession 成功時應返回 data 含 id、status、turns（F06 邊界）', async () => {
    const sessionData = { id: sessionId, status: 'in_progress', turns: [{ role: 'assistant', content: 'hi' }] };
    mockGetSession.mockImplementationOnce((_req: unknown, res: unknown) =>
      mockResJson(res, { success: true, data: sessionData })
    );
    const app = createApp();
    const res = await request(app).get(`/interview/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('turns');
    expect(res.body.data.id).toBe(sessionId);
    expect(res.body.data.status).toBe('in_progress');
    expect(Array.isArray(res.body.data.turns)).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('POST /interview/:id/retry 應調用 retryFailed 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/interview/${sessionId}/retry`);
    expect(res.status).toBe(200);
    expect(mockRetryFailed).toHaveBeenCalledTimes(1);
  });

  describe('錯誤傳遞', () => {
    it('startSession 調用 next(error) 時應返回 500', async () => {
      mockStartSession.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('start failed'));
      });
      const app = createApp();
      const res = await request(app).post('/interview/start').send({ trigger: 'organic' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'start failed' });
    });

    it('getSession 調用 next(error) 時應返回 500', async () => {
      mockGetSession.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('get session failed'));
      });
      const app = createApp();
      const res = await request(app).get(`/interview/${sessionId}`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'get session failed' });
    });

    it('respond 調用 next(error) 時應返回 500', async () => {
      mockRespond.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('respond failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/interview/${sessionId}/respond`).send({ user_response: 'hello' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'respond failed' });
    });

    it('endSession 調用 next(error) 時應返回 500', async () => {
      mockEndSession.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('end failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/interview/${sessionId}/end`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'end failed' });
    });

    it('skip 調用 next(error) 時應返回 500', async () => {
      mockSkip.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('skip failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/interview/${sessionId}/skip`).send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'skip failed' });
    });

    it('checkResume 調用 next(error) 時應返回 500', async () => {
      mockCheckResume.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('resume failed'));
      });
      const app = createApp();
      const res = await request(app).get('/interview/resume');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'resume failed' });
    });

    it('retryFailed 調用 next(error) 時應返回 500', async () => {
      mockRetryFailed.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('retry failed'));
      });
      const app = createApp();
      const res = await request(app).post(`/interview/${sessionId}/retry`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'retry failed' });
    });
  });
});
