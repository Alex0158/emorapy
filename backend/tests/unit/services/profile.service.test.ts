/**
 * ProfileService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  userProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  pairing: { findUnique: jest.fn() },
  relationshipProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { ProfileService } from '../../../src/services/profile.service';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileService();
  });

  describe('getUserProfile', () => {
    it('應按 user_id 查詢並返回', async () => {
      const profile = { user_id: 'u1', nickname: 'U1' };
      prismaMock.userProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getUserProfile('u1');

      expect(result).toEqual(profile);
      expect(prismaMock.userProfile.findUnique).toHaveBeenCalledWith({
        where: { user_id: 'u1' },
      });
    });

    it('無檔案應返回 null', async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getUserProfile('u1');

      expect(result).toBeNull();
    });
  });

  describe('upsertUserProfile', () => {
    it('應 upsert 並返回', async () => {
      const data = { nickname: 'New' };
      prismaMock.userProfile.upsert.mockResolvedValue({
        user_id: 'u1',
        ...data,
      });

      const result = await service.upsertUserProfile('u1', data);

      expect(result.user_id).toBe('u1');
      expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
        where: { user_id: 'u1' },
        create: { user_id: 'u1', ...data },
        update: expect.objectContaining({ ...data, updated_at: expect.any(Date) }),
      });
    });
  });

  describe('getRelationshipProfile', () => {
    it('配對不存在應拋出 NOT_FOUND', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue(null);

      await expect(service.getRelationshipProfile('pair-1', 'u1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('配對'),
      });
      expect(prismaMock.relationshipProfile.findUnique).not.toHaveBeenCalled();
    });

    it('非配對成員應拋出 FORBIDDEN', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        user1_id: 'u1',
        user2_id: 'u2',
      });

      await expect(service.getRelationshipProfile('pair-1', 'u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('成功應返回關係檔案', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        user1_id: 'u1',
        user2_id: 'u2',
      });
      const relProfile = { pairing_id: 'pair-1', notes: 'ok' };
      prismaMock.relationshipProfile.findUnique.mockResolvedValue(relProfile);

      const result = await service.getRelationshipProfile('pair-1', 'u1');

      expect(result).toEqual(relProfile);
      expect(prismaMock.relationshipProfile.findUnique).toHaveBeenCalledWith({
        where: { pairing_id: 'pair-1' },
      });
    });

    it('配對存在但無關係檔案時應返回 null（F08 邊界：尚未填寫關係檔案）', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        user1_id: 'u1',
        user2_id: 'u2',
      });
      prismaMock.relationshipProfile.findUnique.mockResolvedValue(null);

      const result = await service.getRelationshipProfile('pair-1', 'u1');

      expect(result).toBeNull();
    });
  });

  describe('upsertRelationshipProfile', () => {
    it('配對不存在應拋出 NOT_FOUND', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertRelationshipProfile('pair-1', 'u1', { notes: 'x' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(prismaMock.relationshipProfile.upsert).not.toHaveBeenCalled();
    });

    it('非成員應拋出 FORBIDDEN', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        user1_id: 'u1',
        user2_id: 'u2',
      });

      await expect(
        service.upsertRelationshipProfile('pair-1', 'u3', { notes: 'x' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('成功應 upsert 關係檔案', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        user1_id: 'u1',
        user2_id: 'u2',
      });
      prismaMock.relationshipProfile.upsert.mockResolvedValue({
        pairing_id: 'pair-1',
        notes: 'updated',
      });

      const result = await service.upsertRelationshipProfile('pair-1', 'u1', { notes: 'updated' });

      expect(result.pairing_id).toBe('pair-1');
      expect(prismaMock.relationshipProfile.upsert).toHaveBeenCalledWith({
        where: { pairing_id: 'pair-1' },
        create: { pairing_id: 'pair-1', notes: 'updated' },
        update: expect.objectContaining({
          notes: 'updated',
          last_updated_at: expect.any(Date),
        }),
      });
    });
  });
});
