/**
 * UserController 單元測試（mock prisma、fileService、getAuthUserId、env）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import prisma from '../../../src/config/database';
import { UserController, uploadAvatar } from '../../../src/controllers/user.controller';
import { fileService } from '../../../src/services/file.service';

const mockSignUrl = jest.fn();
const mockGetAuthUserId = jest.fn();
const mockValidateFile = jest.fn();
const mockProcessImage = jest.fn();
const mockGetFileUrl = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('../../../src/services/file.service', () => ({
  fileService: {
    signUrl: (url: string) => mockSignUrl(url),
    validateFile: (...args: unknown[]) => mockValidateFile(...args),
    processImage: (...args: unknown[]) => mockProcessImage(...args),
    getFileUrl: (filename: string) => mockGetFileUrl(filename),
  },
  upload: {
    single: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    FILE_BASE_URL: 'http://localhost:3001',
  },
}));
const mockUnlink = jest.fn();
jest.mock('fs/promises', () => ({
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

describe('UserController', () => {
  let controller: UserController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UserController();
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
    mockSignUrl.mockImplementation((url: unknown) => String(url ?? '') + ':signed');
  });

  describe('getProfile', () => {
    it('用戶不存在應 next(NOT_FOUND)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null as never);

      await controller.getProfile(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND', message: expect.stringContaining('用戶') })
      );
    });

    it('成功應返回 user 並簽名 avatar_url', async () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        nickname: 'U',
        avatar_url: 'http://cdn/avatar.jpg',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user as never);

      await controller.getProfile(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            ...user,
            avatar_url: 'http://cdn/avatar.jpg:signed',
          },
        },
      });
      expect(mockSignUrl).toHaveBeenCalledWith('http://cdn/avatar.jpg');
    });

    it('無 avatar_url 時不調用 signUrl 傳入 url', async () => {
      const user = { id: 'u1', email: 'a@b.com', avatar_url: null };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user as never);

      await controller.getProfile(req as Request, res as Response, next);

      expect(mockSignUrl).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { user: { ...user, avatar_url: null } },
      });
    });
  });

  describe('updateProfile', () => {
    it('無可更新字段時應拋出 VALIDATION_ERROR', async () => {
      req.body = {};

      await controller.updateProfile(req as Request, res as Response, next);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('沒有可更新') })
      );
    });

    it('成功應只更新白名單欄位並返回 user', async () => {
      req.body = { nickname: 'NewName', gender: 'male' };
      const updated = {
        id: 'u1',
        email: 'a@b.com',
        nickname: 'NewName',
        avatar_url: null,
      };
      (prisma.user.update as jest.Mock).mockResolvedValue(updated as never);

      await controller.updateProfile(req as Request, res as Response, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          nickname: 'NewName',
          gender: 'male',
          updated_at: expect.any(Date),
        }),
        select: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { user: expect.any(Object) },
        message: '資料更新成功',
      });
    });

    it('avatar_url 在允許域名內應一併更新', async () => {
      req.body = { nickname: 'U', avatar_url: 'http://localhost:3001/avatar.jpg' };
      const updated = { id: 'u1', email: 'a@b.com', nickname: 'U', avatar_url: 'http://localhost:3001/avatar.jpg' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updated as never);

      await controller.updateProfile(req as Request, res as Response, next);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ avatar_url: 'http://localhost:3001/avatar.jpg' }),
        })
      );
    });

    it('avatar_url 域名不在允許列表時應 next(VALIDATION_ERROR)', async () => {
      req.body = { nickname: 'U', avatar_url: 'http://evil.com/avatar.jpg' };

      await controller.updateProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.any(String) })
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('avatar_url 格式無效時應 next(VALIDATION_ERROR)', async () => {
      req.body = { nickname: 'U', avatar_url: 'not-a-valid-url' };

      await controller.updateProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('URL') })
      );
    });

    it('updateProfile 拋錯時應 next(error)', async () => {
      req.body = { nickname: 'x' };
      (prisma.user.update as jest.Mock).mockRejectedValue(new Error('db error') as never);

      await controller.updateProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getProfile 拋錯', () => {
    it('getProfile 拋錯時應 next(error)', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('db error') as never);

      await controller.getProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('uploadAvatar', () => {
    const handler = uploadAvatar[1] as (req: Request, res: Response, next: NextFunction) => Promise<void>;

    it('無 file 時應 next(VALIDATION_ERROR)', async () => {
      req.file = undefined;

      await handler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('頭像文件') })
      );
    });

    it('非圖片 mimetype 時應 unlink 並 next(INVALID_FILE_TYPE)', async () => {
      req.file = {
        mimetype: 'application/pdf',
        destination: '/tmp',
        filename: 'x.pdf',
      } as Express.Multer.File;
      (mockUnlink as any).mockResolvedValue(undefined);

      await handler(req as Request, res as Response, next);

      expect(mockUnlink).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_FILE_TYPE', message: expect.stringContaining('圖片') })
      );
    });

    it('成功時應 processImage、update、返回 user', async () => {
      req.file = {
        mimetype: 'image/png',
        destination: '/tmp',
        filename: 'x.png',
      } as Express.Multer.File;
      (mockValidateFile as any).mockResolvedValue(undefined);
      (mockProcessImage as any).mockResolvedValue({ filename: 'processed.png' });
      mockGetFileUrl.mockReturnValue('http://localhost/files/processed.png');
      const updated = { id: 'u1', email: 'a@b.com', nickname: 'U', avatar_url: 'http://localhost/files/processed.png' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updated as never);

      await handler(req as Request, res as Response, next);

      expect(mockValidateFile).toHaveBeenCalledWith(req.file);
      expect(mockProcessImage).toHaveBeenCalledWith(req.file);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { avatar_url: 'http://localhost/files/processed.png' },
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { user: expect.any(Object) },
        message: '頭像更新成功',
      });
    });
  });
});
