/**
 * JudgmentController 單元測試（mock judgmentService、getAuthUserId、prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { JudgmentController } from '../../../src/controllers/judgment.controller';
import { judgmentService } from '../../../src/services/judgment.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGenerateJudgment: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetJudgmentByCaseId: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAcceptJudgment: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRepairJudgmentResponse: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRecordClinicalMetrics: any = jest.fn();
const mockGetAuthUserId = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  judgment: { findUnique: jest.fn() },
};

jest.mock('../../../src/services/judgment.service', () => ({
  judgmentService: {
    generateJudgment: (caseId: string, opts: unknown) => mockGenerateJudgment(caseId, opts),
    getJudgmentByCaseId: (caseId: string, userId?: string, sessionId?: string) =>
      mockGetJudgmentByCaseId(caseId, userId, sessionId),
    acceptJudgment: (id: string, userId: string, accepted: boolean, rating?: number) =>
      mockAcceptJudgment(id, userId, accepted, rating),
    repairJudgmentResponse: (id: string, feedback: string, opts: unknown) =>
      mockRepairJudgmentResponse(id, feedback, opts),
    recordClinicalMetrics: (id: string, body: unknown, opts: unknown) =>
      mockRecordClinicalMetrics(id, body, opts),
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
jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

describe('JudgmentController', () => {
  let controller: JudgmentController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new JudgmentController();
    req = { body: {}, params: {}, query: {}, headers: {} };
    res = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
    mockGetAuthUserIdOptional.mockReturnValue('u1');
  });

  describe('generateJudgment', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.params = { id: 'case-1' };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.generateJudgment(req as Request, res as Response, next);

      expect(mockGenerateJudgment).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('成功應調用 judgmentService.generateJudgment 並返回 JSON', async () => {
      req.params = { id: 'case-1' };
      req.query = { session_id: 's1' };
      const judgment = { id: 'j1', case_id: 'case-1', judgment_content: '...' };
      mockGenerateJudgment.mockResolvedValue(judgment);

      await controller.generateJudgment(req as Request, res as Response, next);

      expect(mockGetAuthUserIdOptional).toHaveBeenCalledWith(req);
      expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', {
        userId: 'u1',
        sessionId: 's1',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { judgment },
        message: '判決已生成',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('應從 x-session-id 讀取 sessionId', async () => {
      req.params = { id: 'case-1' };
      req.headers = { 'x-session-id': 's2' };
      mockGenerateJudgment.mockResolvedValue({ id: 'j1' });

      await controller.generateJudgment(req as Request, res as Response, next);

      expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', {
        userId: 'u1',
        sessionId: 's2',
      });
    });

    it('generateJudgment 拋錯時應 next(error)', async () => {
      req.params = { id: 'case-1' };
      mockGenerateJudgment.mockRejectedValue(new Error('service error'));

      await controller.generateJudgment(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getJudgmentById', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.params = { id: 'judge-1' };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case_id: 'case-1',
        case: {},
      });

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(mockGetJudgmentByCaseId).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('判決不存在應 next(NOT_FOUND)', async () => {
      req.params = { id: 'judge-1' };
      prismaMock.judgment.findUnique.mockResolvedValue(null);

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = (next as jest.Mock).mock.calls[0][0] as { code: string };
      expect(err.code).toBe('NOT_FOUND');
    });

    it('getJudgmentByCaseId 返回 null 應返回 202 JUDGMENT_PENDING', async () => {
      req.params = { id: 'judge-1' };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case_id: 'case-1',
        case: {},
      });
      mockGetJudgmentByCaseId.mockResolvedValue(null);

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'JUDGMENT_PENDING',
          message: '判決生成中，請稍後再試',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('有 result 應返回 judgment', async () => {
      req.params = { id: 'judge-1' };
      const judgment = { id: 'judge-1', case_id: 'case-1', judgment_content: '...' };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case_id: 'case-1',
        case: {},
      });
      mockGetJudgmentByCaseId.mockResolvedValue(judgment);

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { judgment },
      });
    });

    it('prisma.findUnique 拋錯時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      prismaMock.judgment.findUnique.mockRejectedValue(new Error('db error'));

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('getJudgmentByCaseId 拋錯（非 FORBIDDEN）時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case_id: 'case-1',
        case: {},
      });
      mockGetJudgmentByCaseId.mockRejectedValue(new Error('service error'));

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('getJudgmentByCaseId 拋錯（FORBIDDEN）時應 next(NOT_FOUND)', async () => {
      req.params = { id: 'judge-1' };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case_id: 'case-1',
        case: {},
      });
      const forbiddenErr = new Error('無權限') as Error & { code?: string };
      forbiddenErr.code = 'FORBIDDEN';
      mockGetJudgmentByCaseId.mockRejectedValue(forbiddenErr);

      await controller.getJudgmentById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND', message: '判決不存在' }));
    });
  });

  describe('acceptJudgment', () => {
    it('成功應返回 judgment 與 message', async () => {
      req.params = { id: 'judge-1' };
      req.body = { accepted: true, rating: 5 };
      const judgment = { id: 'judge-1', user1_accepted: true };
      mockAcceptJudgment.mockResolvedValue(judgment);

      await controller.acceptJudgment(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockAcceptJudgment).toHaveBeenCalledWith('judge-1', 'u1', true, 5);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { judgment },
        message: '判決已接受',
      });
    });

    it('accepted 為 false 時 message 為判決已拒絕', async () => {
      req.params = { id: 'judge-1' };
      req.body = { accepted: false };
      mockAcceptJudgment.mockResolvedValue({ id: 'judge-1' });

      await controller.acceptJudgment(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '判決已拒絕' })
      );
    });

    it('acceptJudgment 拋錯時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      req.body = { accepted: true };
      mockAcceptJudgment.mockRejectedValue(new Error('service error'));

      await controller.acceptJudgment(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('repairJudgment', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.params = { id: 'judge-1' };
      req.body = { feedback: 'test feedback' };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.repairJudgment(req as Request, res as Response, next);

      expect(mockRepairJudgmentResponse).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_SESSION_ID' }));
    });

    it('repairJudgment 拋錯時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      req.body = { feedback: 'test feedback' };
      mockRepairJudgmentResponse.mockRejectedValue(new Error('service error'));

      await controller.repairJudgment(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('recordClinicalMetrics', () => {
    it('header/query session 衝突時應 next(INVALID_SESSION_ID)', async () => {
      req.params = { id: 'judge-1' };
      req.body = { felt_understood: 5, felt_blamed: 2, willing_to_try: 4 };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await controller.recordClinicalMetrics(req as Request, res as Response, next);

      expect(mockRecordClinicalMetrics).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_SESSION_ID' }));
    });

    it('recordClinicalMetrics 拋錯時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      req.body = { felt_understood: 5, felt_blamed: 2, willing_to_try: 4 };
      mockRecordClinicalMetrics.mockRejectedValue(new Error('service error'));

      await controller.recordClinicalMetrics(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
