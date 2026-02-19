/**
 * ProfileController 單元測試（mock profileService、getAuthUserId）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { ProfileController } from '../../../src/controllers/profile.controller';
import { profileService } from '../../../src/services/profile.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetUserProfile: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpsertUserProfile: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetRelationshipProfile: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpsertRelationshipProfile: any = jest.fn();
const mockGetAuthUserId = jest.fn();

jest.mock('../../../src/services/profile.service', () => ({
  profileService: {
    getUserProfile: (userId: string) => mockGetUserProfile(userId),
    upsertUserProfile: (userId: string, data: unknown) => mockUpsertUserProfile(userId, data),
    getRelationshipProfile: (pairingId: string, userId: string) =>
      mockGetRelationshipProfile(pairingId, userId),
    upsertRelationshipProfile: (pairingId: string, userId: string, data: unknown) =>
      mockUpsertRelationshipProfile(pairingId, userId, data),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
}));

describe('ProfileController', () => {
  let controller: ProfileController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProfileController(profileService);
    req = { body: {}, params: {} };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
  });

  describe('getUserProfile', () => {
    it('成功應返回 profile', async () => {
      const profile = { user_id: 'u1', nickname: 'U' };
      mockGetUserProfile.mockResolvedValue(profile);

      await controller.getUserProfile(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetUserProfile).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { profile } });
      expect(next).not.toHaveBeenCalled();
    });

    it('getUserProfile 拋錯時應 next(error)', async () => {
      mockGetUserProfile.mockRejectedValue(new Error('db error'));

      await controller.getUserProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('upsertUserProfile', () => {
    it('成功應 sanitize 並 upsert 白名單欄位', async () => {
      req.body = { education_level: 'bachelor', nickname: 'x' };
      const saved = { user_id: 'u1', education_level: 'bachelor' };
      mockUpsertUserProfile.mockResolvedValue(saved);

      await controller.upsertUserProfile(req as Request, res as Response, next);

      expect(mockUpsertUserProfile).toHaveBeenCalledWith('u1', { education_level: 'bachelor' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { profile: saved },
        message: '個人背景已更新',
      });
    });

    it('body 非對象應 next(VALIDATION_ERROR)', async () => {
      req.body = null;

      await controller.upsertUserProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = (next as jest.Mock).mock.calls[0][0] as { code: string };
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('upsertUserProfile 服務拋錯時應 next(error)', async () => {
      req.body = { nickname: 'x' };
      mockUpsertUserProfile.mockRejectedValue(new Error('db error'));

      await controller.upsertUserProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRelationshipProfile', () => {
    it('成功應返回 profile', async () => {
      req.params = { pairingId: 'pair-1' };
      const profile = { pairing_id: 'pair-1', notes: 'ok' };
      mockGetRelationshipProfile.mockResolvedValue(profile);

      await controller.getRelationshipProfile(req as Request, res as Response, next);

      expect(mockGetRelationshipProfile).toHaveBeenCalledWith('pair-1', 'u1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { profile } });
    });

    it('getRelationshipProfile 拋錯時應 next(error)', async () => {
      req.params = { pairingId: 'pair-1' };
      mockGetRelationshipProfile.mockRejectedValue(new Error('db error'));

      await controller.getRelationshipProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('upsertRelationshipProfile', () => {
    it('成功應 sanitize 並 upsert', async () => {
      req.params = { pairingId: 'pair-1' };
      req.body = { relationship_duration_days: 30 };
      const saved = { pairing_id: 'pair-1', relationship_duration_days: 30 };
      mockUpsertRelationshipProfile.mockResolvedValue(saved);

      await controller.upsertRelationshipProfile(req as Request, res as Response, next);

      expect(mockUpsertRelationshipProfile).toHaveBeenCalledWith('pair-1', 'u1', {
        relationship_duration_days: 30,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { profile: saved },
        message: '關係檔案已更新',
      });
    });

    it('upsertRelationshipProfile 拋錯時應 next(error)', async () => {
      req.params = { pairingId: 'pair-1' };
      req.body = { notes: 'x' };
      mockUpsertRelationshipProfile.mockRejectedValue(new Error('db error'));

      await controller.upsertRelationshipProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
