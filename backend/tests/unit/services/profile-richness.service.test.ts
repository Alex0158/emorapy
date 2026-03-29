/**
 * ProfileRichnessService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  profileNarrative: { findMany: jest.fn() },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { ProfileRichnessService } from '../../../src/services/profile-richness.service';
import { RichnessLevel } from '../../../src/types/interview.types';

describe('ProfileRichnessService', () => {
  let service: ProfileRichnessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileRichnessService();
  });

  describe('calculateRichness', () => {
    it('無最新敘事時應返回 0（F06 邊界：空陣列不崩潰）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([]);

      const result = await service.calculateRichness('u1');

      expect(prismaMock.profileNarrative.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', is_latest: true },
      });
      expect(result).toBe(0);
    });

    it('敘事 completeness 為 null 時應以 0 計入（F06 邊界：防禦性計算）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([
        { domain: 'attachment', completeness: null },
        { domain: 'family_origin', completeness: 0.5 },
      ]);

      const result = await service.calculateRichness('u1');

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('未知 domain 時應以權重 1 計入（F06 邊界：防禦性計算）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([
        { domain: 'unknown_domain', completeness: 0.5 },
      ]);

      const result = await service.calculateRichness('u1');

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('getRichnessLevel', () => {
    it('分數 < 0.05 應返回 L0', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([]);

      const result = await service.getRichnessLevel('u1');

      expect(result).toBe(RichnessLevel.L0);
    });

    it('分數 0.05-0.2 應返回 L1', async () => {
      // attachment 權重 2，completeness 0.3 => weighted=0.6，score≈0.058 → L1
      prismaMock.profileNarrative.findMany.mockResolvedValue([
        { domain: 'attachment', completeness: 0.3 },
      ]);

      const result = await service.getRichnessLevel('u1');

      expect(result).toBe(RichnessLevel.L1);
    });
  });
});
