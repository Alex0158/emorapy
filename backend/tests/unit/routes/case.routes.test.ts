/**
 * case.routes 單元測試（mock caseController、evidenceController、deleteEvidence、auth、validate、limiters）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGetCaseBySessionId = jest.fn();
const mockCreateQuickCase = jest.fn();
const mockCreateCase = jest.fn();
const mockCreateCollaborativeCase = jest.fn();
const mockGetCaseList = jest.fn();
const mockGetJudgmentByCaseId = jest.fn();
const mockSubmitCase = jest.fn();
const mockUpdateCase = jest.fn();
const mockGetCaseById = jest.fn();
const mockUploadEvidence = jest.fn();
const mockDeleteEvidence = jest.fn();

jest.mock('../../../src/controllers/case.controller', () => ({
  caseController: {
    getCaseBySessionId: (req: unknown, res: unknown, next: unknown) =>
      mockGetCaseBySessionId(req, res, next),
    createQuickCase: (req: unknown, res: unknown, next: unknown) =>
      mockCreateQuickCase(req, res, next),
    createCollaborativeCase: (req: unknown, res: unknown, next: unknown) =>
      mockCreateCollaborativeCase(req, res, next),
    createCase: (req: unknown, res: unknown, next: unknown) =>
      mockCreateCase(req, res, next),
    getCaseList: (req: unknown, res: unknown, next: unknown) =>
      mockGetCaseList(req, res, next),
    getJudgmentByCaseId: (req: unknown, res: unknown, next: unknown) =>
      mockGetJudgmentByCaseId(req, res, next),
    submitCase: (req: unknown, res: unknown, next: unknown) =>
      mockSubmitCase(req, res, next),
    updateCase: (req: unknown, res: unknown, next: unknown) =>
      mockUpdateCase(req, res, next),
    getCaseById: (req: unknown, res: unknown, next: unknown) =>
      mockGetCaseById(req, res, next),
  },
}));
jest.mock('../../../src/controllers/evidence.controller', () => ({
  evidenceController: {
    uploadEvidence: (req: unknown, res: unknown, next: unknown) =>
      mockUploadEvidence(req, res, next),
  },
  deleteEvidence: (req: unknown, res: unknown, next: unknown) =>
    mockDeleteEvidence(req, res, next),
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  validateSession: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  uploadLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import caseRouter from '../../../src/routes/case.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', caseRouter);
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);
const send201 = (res: unknown, body: unknown) =>
  (res as { status: (n: number) => { json: (b: unknown) => void } }).status(201).json(body);
const uuid = '550e8400-e29b-41d4-a716-446655440000';
const evidenceId = '660e8400-e29b-41d4-a716-446655440001';

describe('case.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCaseBySessionId.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { case: {} } })
    );
    mockCreateQuickCase.mockImplementation((_req: unknown, res: unknown) =>
      send201(res, { success: true, data: { case: {}, session_id: 's1' } })
    );
    mockCreateCase.mockImplementation((_req: unknown, res: unknown) =>
      send201(res, { success: true, data: { case: {} } })
    );
    mockGetCaseList.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { cases: [], pagination: {} } })
    );
    mockGetJudgmentByCaseId.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { judgment: {} } })
    );
    mockSubmitCase.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { case: {} } })
    );
    mockUpdateCase.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { case: {} } })
    );
    mockGetCaseById.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { case: {} } })
    );
    mockUploadEvidence.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: {} })
    );
    mockDeleteEvidence.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true })
    );
  });

  it('GET /by-session 應調用 getCaseBySessionId 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/by-session').query({ session_id: 's1' });
    expect(res.status).toBe(200);
    expect(mockGetCaseBySessionId).toHaveBeenCalled();
  });

  it('POST /quick 應調用 createQuickCase 並返回 201', async () => {
    const app = createApp();
    const longStatement =
      '原告陳述至少三十個字以上才能通過驗證所以這裡寫足夠長度了完畢';
    const res = await request(app)
      .post('/quick')
      .send({ plaintiff_statement: longStatement });
    expect(res.status).toBe(201);
    expect(mockCreateQuickCase).toHaveBeenCalled();
  });

  it('POST / 應調用 createCase 並返回 201', async () => {
    const app = createApp();
    const longStatement =
      '原告陳述內容需要至少五十個字才能通過驗證所以這裡寫足夠長度再加一些字數湊滿五十字即可達到驗證標準長度';
    const res = await request(app)
      .post('/')
      .send({
        pairing_id: uuid,
        plaintiff_statement: longStatement,
      });
    expect(res.status).toBe(201);
    expect(mockCreateCase).toHaveBeenCalled();
  });

  it('GET / 應調用 getCaseList 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(mockGetCaseList).toHaveBeenCalled();
  });

  it('GET /:id 應調用 getCaseById 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/${uuid}`);
    expect(res.status).toBe(200);
    expect(mockGetCaseById).toHaveBeenCalled();
  });

  it('GET /:id 當 id 非 UUID 時 validateUuidParam 應 next(route) 不調用 getCaseById', async () => {
    const app = createApp();
    mockGetCaseById.mockClear();
    const res = await request(app).get('/not-a-valid-uuid');
    expect(mockGetCaseById).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
  });

  it('GET /:id/judgment 應調用 getJudgmentByCaseId 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/${uuid}/judgment`);
    expect(res.status).toBe(200);
    expect(mockGetJudgmentByCaseId).toHaveBeenCalled();
  });

  it('POST /:id/submit 應調用 submitCase 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post(`/${uuid}/submit`);
    expect(res.status).toBe(200);
    expect(mockSubmitCase).toHaveBeenCalled();
  });

  it('PUT /:id 應調用 updateCase 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).put(`/${uuid}`).send({ title: 'x' });
    expect(res.status).toBe(200);
    expect(mockUpdateCase).toHaveBeenCalled();
  });

  it('POST /:id/evidence 應調用 uploadEvidence 並返回 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/${uuid}/evidence`)
      .attach('file', Buffer.from('x'), 'x.txt');
    expect(res.status).toBe(200);
    expect(mockUploadEvidence).toHaveBeenCalled();
  });

  it('DELETE /:id/evidence/:evidenceId 應調用 deleteEvidence 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).delete(`/${uuid}/evidence/${evidenceId}`);
    expect(res.status).toBe(200);
    expect(mockDeleteEvidence).toHaveBeenCalled();
  });
});
