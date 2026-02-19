/**
 * evidence.controller 單元測試（mock prisma、fileService、sessionService、getAuthUserIdOptional、upload、logger）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import prisma from '../../../src/config/database';
import { EvidenceController } from '../../../src/controllers/evidence.controller';
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
jest.mock('../../../src/utils/request', () => ({
  getAuthUserIdOptional: (req: Request) => mockGetAuthUserIdOptional(req),
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
    controller = new EvidenceController(fileService, sessionService);
    req = { params: {}, query: {}, headers: {}, files: [] };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
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
  });

  describe('uploadEvidence (handler)', () => {
    const getHandler = (ctrl: EvidenceController) =>
      (ctrl.uploadEvidence as [unknown, (req: Request, res: Response, next: NextFunction) => void])[1];

    it('無 files 時應拋出 VALIDATION_ERROR', async () => {
      req.params = { id: caseId };
      req.files = [];

      await getHandler(controller)(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('請選擇') })
      );
      expect(prisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('案件不存在應拋出 NOT_FOUND', async () => {
      req.params = { id: caseId };
      req.files = [{ fieldname: 'files', filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 } as Express.Multer.File];
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(null as never);

      await getHandler(controller)(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND', message: expect.stringContaining('案件') })
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

      await getHandler(controller)(req as Request, res as Response, next);

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

      await getHandler(controller)(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SESSION_EXPIRED' })
      );
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

      await getHandler(controller)(req as Request, res as Response, next);

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

      await getHandler(controller)(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限上傳') })
      );
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

      await getHandler(controller)(req as Request, res as Response, next);

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

      await getHandler(controller)(req as Request, res as Response, next);

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

      await getHandler(controller)(req as Request, res as Response, next);

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

      await getHandler(controller)(req as Request, res as Response, next);

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

      await getHandler(controller)(req as Request, res as Response, next);

      expect(mockValidateFile).toHaveBeenCalled();
      expect(prisma.evidence.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { evidences: expect.any(Array) },
        message: '證據上傳成功',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvidence', () => {
    it('證據不存在應拋出 NOT_FOUND', async () => {
      req.params = { evidenceId };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue(null as never);

      await controller.deleteEvidence(req as Request, res as Response, next);

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

      await controller.deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限刪除') })
      );
      expect(mockDeleteFile).not.toHaveBeenCalled();
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

      await controller.deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SESSION_EXPIRED' })
      );
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

      await controller.deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', message: expect.stringContaining('無權限刪除') })
      );
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

      await controller.deleteEvidence(req as Request, res as Response, next);

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

      await controller.deleteEvidence(req as Request, res as Response, next);

      expect(mockDeleteFile).toHaveBeenCalledWith('a.jpg');
    });

    it('deleteEvidence 拋錯時應 next(error)', async () => {
      req.params = { evidenceId };
      req.query = { session_id: 's1' };
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: evidenceId,
        file_url: 'http://x.com/a.jpg',
        case: { mode: 'quick', session_id: 's1' },
      } as never);
      mockGetSession.mockResolvedValue({ id: 's1' } as never);
      (prisma.evidence.delete as jest.Mock).mockRejectedValue(new Error('db error') as never);

      await controller.deleteEvidence(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
