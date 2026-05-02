/**
 * CaseController 單元測試（mock caseService、judgmentService、getAuthUserId、getAuthUserIdOptional、logger）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
// Mock logger first so case.controller import does not pull in env/config
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() })),
  },
}));

import { CaseController } from '../../../src/controllers/case.controller';
import { caseService } from '../../../src/services/case.service';
import { judgmentService } from '../../../src/services/judgment.service';
import logger from '../../../src/config/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateQuickCase: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateCase: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateCollaborativeCase: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetCaseById: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetCaseBySessionId: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetCaseList: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSubmitCase: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdateCase: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGenerateJudgment: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetJudgmentByCaseId: any = jest.fn();
const mockGetAuthUserId = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();

const flushJudgmentTrigger = () => new Promise<void>((resolve) => setImmediate(resolve));

jest.mock('../../../src/services/case.service', () => ({
  caseService: {
    createQuickCase: (body: unknown, sessionId: string | null) =>
      mockCreateQuickCase(body, sessionId),
    createCase: (userId: string, body: unknown) => mockCreateCase(userId, body),
    createOrUpdateCollaborativeCase: (body: unknown, sessionId: string | null) =>
      mockCreateCollaborativeCase(body, sessionId),
    getCaseById: (caseId: string, userId?: string | null, sessionId?: string | null) =>
      mockGetCaseById(caseId, userId, sessionId),
    getCaseBySessionId: (sessionId: string) => mockGetCaseBySessionId(sessionId),
    getCaseList: (userId: string, params: unknown) => mockGetCaseList(userId, params),
    submitCase: (caseId: string, userId: string) => mockSubmitCase(caseId, userId),
    updateCase: (caseId: string, userId: string, body: unknown) =>
      mockUpdateCase(caseId, userId, body),
  },
}));
jest.mock('../../../src/services/judgment.service', () => ({
  judgmentService: {
    generateJudgment: (caseId: string, opts: unknown) => mockGenerateJudgment(caseId, opts),
    getJudgmentByCaseId: (caseId: string, userId?: string, sessionId?: string) =>
      mockGetJudgmentByCaseId(caseId, userId, sessionId),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
  getAuthUserIdOptional: (req: Request) => mockGetAuthUserIdOptional(req),
  getSessionIdFromSources: (req: Request) => {
    const headerSessionId = req.headers?.['x-session-id'] as string | undefined;
    const querySessionId = req.query?.session_id as string | undefined;
    return {
      sessionId: headerSessionId || querySessionId,
      headerSessionId,
      querySessionId,
      hasConflict: !!headerSessionId && !!querySessionId && headerSessionId !== querySessionId,
    };
  },
}));

describe('CaseController', () => {
  let controller: CaseController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CaseController();
    req = { body: {}, params: {}, query: {}, headers: {} };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
    mockGetAuthUserIdOptional.mockReturnValue('u1');
    mockGenerateJudgment.mockResolvedValue(undefined);
  });

  describe('createQuickCase', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.body = { description: 'desc' };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.createQuickCase(req as Request, res as Response, next);

      expect(mockCreateQuickCase).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('成功應從 header/query 取 sessionId 並返回 201', async () => {
      req.body = { description: 'desc' };
      req.headers = { 'x-session-id': 's1' };
      const case_ = { id: 'c1', description: 'desc' };
      mockCreateQuickCase.mockResolvedValue({
        case: case_,
        sessionId: 's1',
        sessionExpiresAt: new Date('2026-01-02'),
      });

      await controller.createQuickCase(req as Request, res as Response, next);
      await flushJudgmentTrigger();

      expect(mockCreateQuickCase).toHaveBeenCalledWith({ description: 'desc' }, 's1');
      expect(mockGenerateJudgment).toHaveBeenCalledWith('c1', { sessionId: 's1' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          case: case_,
          session_id: 's1',
          session_expires_at: '2026-01-02T00:00:00.000Z',
        },
        message: '案件已提交，AI正在分析中...',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('無 session 時應傳 null 給 createQuickCase', async () => {
      req.body = {};
      req.headers = {};
      req.query = {};
      mockCreateQuickCase.mockResolvedValue({
        case: { id: 'c1' },
        sessionId: 'new-session',
        sessionExpiresAt: null,
      });

      await controller.createQuickCase(req as Request, res as Response, next);

      expect(mockCreateQuickCase).toHaveBeenCalledWith({}, null);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('createQuickCase 拋錯時應 next(error)', async () => {
      req.body = { plaintiff_statement: 'x'.repeat(50) };
      mockCreateQuickCase.mockRejectedValue(new Error('validation error'));

      await controller.createQuickCase(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('createQuickCase 成功但 generateJudgment 拋錯時應記錄 logger.error 且仍返回 201', async () => {
      req.body = { description: 'desc' };
      req.headers = { 'x-session-id': 's1' };
      mockCreateQuickCase.mockResolvedValue({
        case: { id: 'c1' },
        sessionId: 's1',
        sessionExpiresAt: null,
      });
      mockGenerateJudgment.mockRejectedValueOnce(new Error('judgment failed'));

      await controller.createQuickCase(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
      await flushJudgmentTrigger();
      await Promise.resolve();
      expect(logger.error).toHaveBeenCalledWith('Async judgment generation failed', { caseId: 'c1', error: expect.any(Error) });
    });
  });

  describe('createCase', () => {
    it('成功應調用 createCase 並觸發 generateJudgment', async () => {
      req.body = { description: 'desc' };
      const case_ = { id: 'c1', status: 'submitted' };
      mockCreateCase.mockResolvedValue(case_);

      await controller.createCase(req as Request, res as Response, next);
      await flushJudgmentTrigger();

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockCreateCase).toHaveBeenCalledWith('u1', { description: 'desc' });
      expect(mockGenerateJudgment).toHaveBeenCalledWith('c1', { userId: 'u1' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { case: case_ },
        message: '案件已提交',
      });
    });

    it('createCase 拋錯時應 next(error)', async () => {
      req.body = { pairing_id: 'p1', plaintiff_statement: 'x'.repeat(50) };
      mockCreateCase.mockRejectedValue(new Error('forbidden'));

      await controller.createCase(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('createCase 成功但 generateJudgment 拋錯時應記錄 logger.error 且仍返回 201', async () => {
      req.body = { description: 'desc' };
      mockCreateCase.mockResolvedValue({ id: 'c1', status: 'submitted' });
      mockGenerateJudgment.mockRejectedValueOnce(new Error('judgment failed'));

      await controller.createCase(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
      await flushJudgmentTrigger();
      await Promise.resolve();
      expect(logger.error).toHaveBeenCalledWith('Async judgment generation failed', { caseId: 'c1', error: expect.any(Error) });
    });
  });

  describe('createCollaborativeCase', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.body = { plaintiff_statement: 'x'.repeat(50) };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.createCollaborativeCase(req as Request, res as Response, next);

      expect(mockCreateCollaborativeCase).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('角色 A 成功時應返回 201 與 a_done', async () => {
      req.body = { plaintiff_statement: '角色A已寫足夠長度的描述內容' };
      req.headers = { 'x-session-id': 's1' };
      mockCreateCollaborativeCase.mockResolvedValue({
        case: { id: 'c-collab-1' },
        sessionId: 's1',
        sessionExpiresAt: new Date('2026-01-02'),
        phase: 'a_done',
      });

      await controller.createCollaborativeCase(req as Request, res as Response, next);

      expect(mockCreateCollaborativeCase).toHaveBeenCalledWith(req.body, 's1');
      expect(mockGenerateJudgment).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          case: { id: 'c-collab-1' },
          session_id: 's1',
          session_expires_at: '2026-01-02T00:00:00.000Z',
          phase: 'a_done',
        },
        message: '角色A陳述已記錄，請將設備交給角色B',
      });
    });

    it('角色 B 成功時應返回 200 並觸發 generateJudgment', async () => {
      req.body = { case_id: 'c-collab-1', defendant_statement: '角色B已寫足夠字數了' };
      req.headers = { 'x-session-id': 's1' };
      mockCreateCollaborativeCase.mockResolvedValue({
        case: { id: 'c-collab-1' },
        sessionId: 's1',
        sessionExpiresAt: new Date('2026-01-03'),
        phase: 'submitted',
      });

      await controller.createCollaborativeCase(req as Request, res as Response, next);
      await flushJudgmentTrigger();

      expect(mockCreateCollaborativeCase).toHaveBeenCalledWith(req.body, 's1');
      expect(mockGenerateJudgment).toHaveBeenCalledWith('c-collab-1', { sessionId: 's1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          case: { id: 'c-collab-1' },
          session_id: 's1',
          session_expires_at: '2026-01-03T00:00:00.000Z',
          phase: 'submitted',
        },
        message: '案件已提交，AI正在分析中...',
      });
    });

    it('createCollaborativeCase 拋錯時應 next(error)', async () => {
      req.body = { plaintiff_statement: 'x'.repeat(50) };
      req.headers = { 'x-session-id': 's1' };
      mockCreateCollaborativeCase.mockRejectedValue(new Error('service error'));

      await controller.createCollaborativeCase(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getCaseById', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.params = { id: 'c1' };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.getCaseById(req as Request, res as Response, next);

      expect(mockGetCaseById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('成功應返回 case', async () => {
      req.params = { id: 'c1' };
      req.query = { session_id: 's1' };
      const case_ = { id: 'c1' };
      mockGetCaseById.mockResolvedValue(case_);

      await controller.getCaseById(req as Request, res as Response, next);

      expect(mockGetAuthUserIdOptional).toHaveBeenCalledWith(req);
      expect(mockGetCaseById).toHaveBeenCalledWith('c1', 'u1', 's1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { case: case_ } });
    });

    it('getCaseById 拋錯時應 next(error)', async () => {
      req.params = { id: 'c1' };
      mockGetCaseById.mockRejectedValue(new Error('not found'));

      await controller.getCaseById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getCaseBySessionId', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.getCaseBySessionId(req as Request, res as Response, next);

      expect(mockGetCaseBySessionId).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('成功應返回 case', async () => {
      req.query = { session_id: 's1' };
      const case_ = { id: 'c1' };
      mockGetCaseBySessionId.mockResolvedValue(case_);

      await controller.getCaseBySessionId(req as Request, res as Response, next);

      expect(mockGetCaseBySessionId).toHaveBeenCalledWith('s1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { case: case_ } });
    });

    it('getCaseBySessionId 拋錯時應 next(error)', async () => {
      req.query = { session_id: 's1' };
      mockGetCaseBySessionId.mockRejectedValue(new Error('not found'));

      await controller.getCaseBySessionId(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('無 sessionId 時應調用 next(error)', async () => {
      req.query = {};
      req.headers = {};

      await controller.getCaseBySessionId(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(mockGetCaseBySessionId).not.toHaveBeenCalled();
    });

    it('案件不存在時應返回 404', async () => {
      req.query = { session_id: 's1' };
      mockGetCaseBySessionId.mockResolvedValue(null);

      await controller.getCaseBySessionId(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'NOT_FOUND', message: '案件不存在' },
      });
    });
  });

  describe('getJudgmentByCaseId', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.params = { id: 'c1' };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.getJudgmentByCaseId(req as Request, res as Response, next);

      expect(mockGetJudgmentByCaseId).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('有判決時應返回 data.judgment', async () => {
      req.params = { id: 'c1' };
      req.query = { session_id: 's1' };
      const judgment = { id: 'j1', case_id: 'c1' };
      mockGetJudgmentByCaseId.mockResolvedValue(judgment);

      await controller.getJudgmentByCaseId(req as Request, res as Response, next);

      expect(mockGetAuthUserIdOptional).toHaveBeenCalledWith(req);
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1', 'u1', 's1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { judgment } });
    });

    it('判決生成中應返回 202', async () => {
      req.params = { id: 'c1' };
      mockGetJudgmentByCaseId.mockResolvedValue(null);

      await controller.getJudgmentByCaseId(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'JUDGMENT_PENDING', message: '判決生成中，請稍後再試' },
      });
    });

    it('getJudgmentByCaseId 拋錯時應 next(error)', async () => {
      req.params = { id: 'c1' };
      mockGetJudgmentByCaseId.mockRejectedValue(new Error('service error'));

      await controller.getJudgmentByCaseId(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getCaseList', () => {
    it('無案件時應返回 cases 空陣列與 pagination total 0（F03 邊界）', async () => {
      req.query = { page: '1', page_size: '10' };
      mockGetCaseList.mockResolvedValue({
        cases: [],
        pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
      });

      await controller.getCaseList(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          cases: [],
          pagination: expect.objectContaining({ total: 0, total_pages: 0 }),
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('成功應傳 query 參數並返回列表', async () => {
      req.query = { status: 'submitted', page: '1', page_size: '10' };
      const result = { items: [], total: 0 };
      mockGetCaseList.mockResolvedValue(result);

      await controller.getCaseList(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetCaseList).toHaveBeenCalledWith('u1', {
        status: 'submitted',
        type: undefined,
        page: 1,
        page_size: 10,
        sort_by: undefined,
        sort_order: undefined,
        search: undefined,
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
    });

    it('getCaseList 拋錯時應 next(error)', async () => {
      req.query = {};
      mockGetCaseList.mockRejectedValue(new Error('db error'));

      await controller.getCaseList(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('submitCase', () => {
    it('成功應調用 submitCase 並觸發 generateJudgment', async () => {
      req.params = { id: 'c1' };
      const case_ = { id: 'c1', status: 'submitted' };
      mockSubmitCase.mockResolvedValue(case_);

      await controller.submitCase(req as Request, res as Response, next);
      await flushJudgmentTrigger();

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockSubmitCase).toHaveBeenCalledWith('c1', 'u1');
      expect(mockGenerateJudgment).toHaveBeenCalledWith('c1', { userId: 'u1' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { case: case_ },
        message: '案件已提交，AI正在分析中...',
      });
    });

    it('submitCase 成功但 generateJudgment 拋錯時應記錄 logger.error 且仍返回 200', async () => {
      req.params = { id: 'c1' };
      mockSubmitCase.mockResolvedValue({ id: 'c1', status: 'submitted' });
      mockGenerateJudgment.mockRejectedValueOnce(new Error('judgment failed'));

      await controller.submitCase(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(next).not.toHaveBeenCalled();
      await flushJudgmentTrigger();
      await Promise.resolve();
      expect(logger.error).toHaveBeenCalledWith('Async judgment generation failed', { caseId: 'c1', error: expect.any(Error) });
    });

    it('submitCase 拋錯時應 next(error)', async () => {
      req.params = { id: 'c1' };
      mockSubmitCase.mockRejectedValueOnce(new Error('submit failed'));

      await controller.submitCase(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateCase', () => {
    it('成功應返回更新後的 case', async () => {
      req.params = { id: 'c1' };
      req.body = { description: 'updated' };
      const case_ = { id: 'c1', description: 'updated' };
      mockUpdateCase.mockResolvedValue(case_);

      await controller.updateCase(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockUpdateCase).toHaveBeenCalledWith('c1', 'u1', { description: 'updated' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { case: case_ },
        message: '案件已更新',
      });
    });

    it('updateCase 拋錯時應 next(error)', async () => {
      req.params = { id: 'c1' };
      req.body = { title: 'x' };
      mockUpdateCase.mockRejectedValue(new Error('not found'));

      await controller.updateCase(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('錯誤時調用 next', () => {
    it('createCase 拋錯時應 next(error)', async () => {
      req.body = {};
      mockGetAuthUserId.mockReturnValue('u1');
      mockCreateCase.mockRejectedValue(new Error('db error'));

      await controller.createCase(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
