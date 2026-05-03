/**
 * evidence.controller 單元測試（mock prisma、fileService、sessionService、getAuthUserIdOptional、upload、logger）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import prisma from '../../../src/config/database';
import { EvidenceController, deleteEvidence } from '../../../src/controllers/evidence.controller';
import { fileService } from '../../../src/services/file.service';
import { sessionService } from '../../../src/services/session.service';

const mockValidateFile = jest.fn();
const mockProcessImage = jest.fn();
const mockProcessVideo = jest.fn();
const mockGetFileUrl = jest.fn();
const mockSignUrl = jest.fn();
const mockDeleteFile = jest.fn();
const mockGetSession = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    case: { findUnique: jest.fn() },
    evidence: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
jest.mock('../../../src/services/file.service', () => ({
  fileService: {
    validateFile: (file: unknown) => mockValidateFile(file),
    processImage: (file: unknown) => mockProcessImage(file),
    processVideo: (file: unknown) => mockProcessVideo(file),
    getFileUrl: (filename: string) => mockGetFileUrl(filename),
    signUrl: (url: string) => mockSignUrl(url),
    deleteFile: (filename: string) => mockDeleteFile(filename),
  },
  upload: {
    array: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  },
}));
jest.mock('../../../src/services/session.service', () => ({
  sessionService: {
    getSession: (id: string) => mockGetSession(id),
  },
}));
jest.mock('../../../src/utils/lock', () => ({
  lockService: {
    withLock: async (_key: string, fn: () => Promise<unknown>) => fn(),
  },
}));
jest.mock('../../../src/utils/request', () => ({
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
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('evidence.controller', () => {
  let controller: EvidenceController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const caseId = '550e8400-e29b-41d4-a716-446655440000';
  const evidenceId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EvidenceController();
    req = { params: {}, query: {}, headers: {}, files: [] };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserIdOptional.mockReturnValue(undefined);
    (mockValidateFile as jest.Mock).mockResolvedValue(undefined as never);
    mockGetFileUrl.mockImplementation((f: unknown) => `http://files/${f}`);
    mockSignUrl.mockImplementation((u: unknown) => String(u ?? '') + ':signed');
    mockProcessImage.mockImplementation((f: unknown) =>
      Promise.resolve({
        filename: (f as { filename: string }).filename,
        size: (f as { size: number }).size,
        mimetype: (f as { mimetype: string }).mimetype,
      })
    );
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        evidence: {
          create: prisma.evidence.create,
        },
      })
    );
  });

  describe('uploadEvidence (handler)', () => {
    const getUploadHandlerOnly = (ctrl: EvidenceController) => {
      const [, , handler] = ctrl.uploadEvidence as [
        (req: Request, res: Response, next: NextFunction) => void,
        (req: Request, res: Response, next: NextFunction) => void,
        (req: Request, res: Response, next: NextFunction) => void
      ];
      return handler;
    };

    const runUpload = async (
      ctrl: EvidenceController,
      request: Request,
      response: Response,
      nextSpy: NextFunction
    ) => {
      const [preAuthorize, uploadMiddleware, handler] = ctrl.uploadEvidence as [
        (req: Request, res: Response, next: NextFunction) => void,
        (req: Request, res: Response, next: NextFunction) => void,
        (req: Request, res: Response, next: NextFunction) => void
      ];

      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        const originalJson = response.json?.bind(response);
        const originalStatus = response.status?.bind(response);
        (response as any).json = jest.fn((...args: unknown[]) => {
          const ret = originalJson ? (originalJson as any)(...args) : response;
          done();
          return ret;
        });
        (response as any).status = jest.fn((...args: unknown[]) => {
          const ret = originalStatus ? (originalStatus as any)(...args) : response;
          return ret;
        });

        preAuthorize(request, response, (err?: unknown) => {
          if (err) {
            nextSpy(err as never);
            done();
            return;
          }
          uploadMiddleware(request, response, (err2?: unknown) => {
            if (err2) {
              nextSpy(err2 as never);
              done();
              return;
            }
            Promise.resolve(handler(request, response, (err3?: unknown) => {
              if (err3) {
                nextSpy(err3 as never);
              }
              done();
            })).catch((error) => {
              nextSpy(error as never);
              done();
            });
          });
        });
      });
    };

    it('無 files 時應拋出 VALIDATION_ERROR', async () => {
      req.params = { id: caseId };
      req.query = { session_id: 's1' };
      req.files = [];
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('請選擇') })
      );
      expect(prisma.case.findUnique).toHaveBeenCalled();
    });

    it('prisma.case.findUnique 拋錯時應 next(error)', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockRejectedValue(new Error('db error') as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('案件不存在應拋出 NOT_FOUND', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(null as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND', message: expect.stringContaining('案件') })
      );
    });

    it('header/query session 衝突時應拋出 INVALID_SESSION_ID', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_SESSION_ID' })
      );
    });

    it('quick 模式無 sessionId 應拋出 FORBIDDEN', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = {};
      req.headers = {};
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限上傳') })
      );
    });

    it('quick 模式 Session 已過期應拋出 SESSION_EXPIRED', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockResolvedValue(null as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SESSION_EXPIRED' })
      );
    });

    it('sessionService.getSession 拋錯時應 next(error)', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockRejectedValue(new Error('db error') as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('remote 模式無 userId 應拋出 UNAUTHORIZED', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      mockGetAuthUserIdOptional.mockReturnValue(undefined);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'remote',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', message: expect.stringContaining('需要認證') })
      );
    });

    it('remote 模式非當事人應拋出 FORBIDDEN', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      mockGetAuthUserIdOptional.mockReturnValue('u3');
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'remote',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限上傳') })
      );
    });

    it('collaborative 模式應允許以 session 上傳證據', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's-collab' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'collaborative',
        session_id: 's-collab',
        status: 'submitted',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's-collab' } as never);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0 as never);
      (prisma.evidence.create as jest.Mock).mockResolvedValue({
        id: evidenceId,
        case_id: caseId,
        file_url: 'http://files/a.jpg',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(mockGetSession).toHaveBeenCalledWith('s-collab');
      expect(prisma.evidence.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '證據上傳成功',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('formal collaborative 且 session_id 為 null 時應允許當事人用 JWT 上傳證據', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.headers = { 'x-session-id': 'stale-session-should-not-win' };
      mockGetAuthUserIdOptional.mockReturnValue('u1');
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'collaborative',
        session_id: null,
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'submitted',
      } as never);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0 as never);
      (prisma.evidence.create as jest.Mock).mockResolvedValue({
        id: evidenceId,
        case_id: caseId,
        file_url: 'http://files/a.jpg',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(mockGetSession).not.toHaveBeenCalled();
      expect(prisma.evidence.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '證據上傳成功',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('案件狀態不允許上傳時應拋出 CASE_NOT_EDITABLE', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'completed',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CASE_NOT_EDITABLE', message: expect.stringContaining('狀態') })
      );
    });

    it('現有證據加新文件超過 3 個應拋出 TOO_MANY_FILES', async () => {
      req.params = { id: caseId };
      req.files = [
        { fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File,
        { fieldname: 'files', filename: 'b.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File,
      ];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(2 as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TOO_MANY_FILES', message: expect.stringContaining('最多') })
      );
    });

    it('video mimetype 時應調用 processVideo', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'v.mp4', mimetype: 'video/mp4', size: 200 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0 as never);
      (mockProcessVideo as jest.Mock).mockResolvedValue({
        filename: 'v_processed.mp4',
        size: 180,
        mimetype: 'video/mp4',
      } as never);
      (prisma.evidence.create as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://files/v_processed.mp4',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(mockProcessVideo).toHaveBeenCalled();
      expect(mockProcessImage).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { evidences: expect.any(Array) },
        message: '證據上傳成功',
      });
    });

    it('uploadEvidence 拋錯時應 next(error)', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0 as never);
      (mockValidateFile as jest.Mock).mockRejectedValue(new Error('validate failed') as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('成功 quick 模式應創建證據並返回', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: caseId,
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0 as never);
      (prisma.evidence.create as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://files/a.jpg',
      } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(mockValidateFile).toHaveBeenCalled();
      expect(prisma.evidence.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { evidences: expect.any(Array) },
        message: '證據上傳成功',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('鎖內再次讀取案件不存在時應拋出 NOT_FOUND', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: caseId,
          mode: 'quick',
          session_id: 's1',
          status: 'draft',
        } as never)
        .mockResolvedValueOnce(null as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('鎖內案件狀態不可上傳時應拋出 CASE_NOT_EDITABLE', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.query = { session_id: 's1' };
      (prisma.case.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: caseId,
          mode: 'quick',
          session_id: 's1',
          status: 'draft',
        } as never)
        .mockResolvedValueOnce({ status: 'completed' } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);

      await runUpload(controller, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CASE_NOT_EDITABLE' }));
    });

    it('僅調用 handler 時 header/query 衝突也應拋 INVALID_SESSION_ID（覆蓋 handler 內 hasConflict 分支）', async () => {
      const handler = getUploadHandlerOnly(controller);
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await handler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_SESSION_ID' }));
    });

    it('僅調用 handler 且 files 未定義時應拋 VALIDATION_ERROR（覆蓋 files || [] 分支）', async () => {
      const handler = getUploadHandlerOnly(controller);
      req.params = { id: caseId };
      req.files = undefined as unknown as Express.Multer.File[];
      req.headers = {};
      req.query = {};

      await handler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    });
  });

  describe('deleteEvidence', () => {
    it('證據不存在應拋出 NOT_FOUND', async () => {
      req.params = { evidenceId };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue(null as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND', message: expect.stringContaining('證據') })
      );
      expect(prisma.evidence.delete).not.toHaveBeenCalled();
    });

    it('quick 模式 sessionId 不匹配應拋出 FORBIDDEN', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's2' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: {
          mode: 'quick',
          session_id: 's1',
        },
      } as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限刪除') })
      );
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it('header/query session 衝突時應拋出 INVALID_SESSION_ID', async () => {
      req.params = { id: caseId, evidenceId };
      req.headers = { 'x-session-id': 's1' };
      req.query = { session_id: 's2' };

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_SESSION_ID' }));
    });

    it('evidence 不屬於請求 caseId 時應拋出 NOT_FOUND', async () => {
      req.params = { id: caseId, evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        case_id: 'another-case-id',
        file_url: 'http://x.com/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('quick 模式 session 不存在應拋出 SESSION_EXPIRED', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue(null as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SESSION_EXPIRED' })
      );
    });

    it('sessionService.getSession 拋錯時應 next(error)', async () => {
      req.params = { id: caseId, evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockRejectedValue(new Error('db error') as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('remote 模式非當事人應拋出 FORBIDDEN', async () => {
      req.params = { evidenceId };
      mockGetAuthUserIdOptional.mockReturnValue('u3');
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: {
          mode: 'remote',
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        },
      } as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限刪除') })
      );
    });

    it('collaborative 模式應允許以 session 刪除證據', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's-collab' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/uploads/a.jpg',
        case: {
          mode: 'collaborative',
          session_id: 's-collab',
        },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's-collab' } as never);
      (prisma.evidence.delete as jest.Mock).mockResolvedValue({} as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockGetSession).toHaveBeenCalledWith('s-collab');
      expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: evidenceId } });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {},
        message: '證據已刪除',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('formal collaborative 且 session_id 為 null 時應允許當事人用 JWT 刪除證據', async () => {
      req.params = { id: caseId, evidenceId };
      req.headers = { 'x-session-id': 'stale-session-should-not-win' };
      mockGetAuthUserIdOptional.mockReturnValue('u2');
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        case_id: caseId,
        file_url: 'http://x.com/uploads/a.jpg',
        case: {
          mode: 'collaborative',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        },
      } as never);
      (prisma.evidence.delete as jest.Mock).mockResolvedValue({} as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockGetSession).not.toHaveBeenCalled();
      expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: evidenceId } });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {},
        message: '證據已刪除',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('成功應刪除文件與 DB 記錄並返回', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/uploads/a.jpg',
        case: {
          mode: 'quick',
          session_id: 's1',
        },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.delete as jest.Mock).mockResolvedValue({} as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockDeleteFile).toHaveBeenCalled();
      expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: evidenceId } });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {},
        message: '證據已刪除',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('file_url 無 URL 格式時應從 path 取 filename', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'relative/path/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.delete as jest.Mock).mockResolvedValue({} as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockDeleteFile).toHaveBeenCalledWith('a.jpg');
    });

    it('file_url 解析後 filename 為空時不應調用 deleteFile', async () => {
      req.params = { id: caseId, evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        case_id: caseId,
        file_url: 'http://x.com/uploads/',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.delete as jest.Mock).mockResolvedValue({} as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockDeleteFile).not.toHaveBeenCalled();
      expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: evidenceId } });
    });

    it('file_url 非 URL 且結尾為 "/" 時 filename 為空也不應刪文件（覆蓋 catch 分支）', async () => {
      req.params = { id: caseId, evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        case_id: caseId,
        file_url: 'relative/path/',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.delete as jest.Mock).mockResolvedValue({} as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockDeleteFile).not.toHaveBeenCalled();
      expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: evidenceId } });
    });

    it('prisma.evidence.findUnique 拋錯時應 next(error)', async () => {
      req.params = { id: caseId, evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockRejectedValue(new Error('db error') as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('deleteEvidence 拋錯時應 next(error)', async () => {
      req.params = { id: caseId, evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.delete as jest.Mock).mockRejectedValue(new Error('db error') as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('fileService.deleteFile 拋錯時應 next(error)', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      mockDeleteFile.mockRejectedValueOnce(new Error('file delete error') as never);

      await deleteEvidence(req as Request, res as Response, next);

      expect(mockDeleteFile).toHaveBeenCalledWith('a.jpg');
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
