/**
 * ProfileSnapshotService 單元測試（mock Prisma、profileRichnessService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  profileNarrative: { findMany: jest.fn() },
  profileInsight: { findMany: jest.fn() },
  profileSnapshot: { upsert: jest.fn(), findUnique: jest.fn() },
};
const mockCalculateRichness = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/profile-richness.service', () => ({
  profileRichnessService: { calculateRichness: (...args: unknown[]) => mockCalculateRichness(...args) },
}));

import { ProfileSnapshotService } from '../../../src/services/profile-snapshot.service';

describe('ProfileSnapshotService', () => {
  let service: ProfileSnapshotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileSnapshotService();
  });

  describe('createSnapshot', () => {
    it('無敘事與洞見時應仍寫入快照（F06 邊界：空陣列不崩潰）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([]);
      prismaMock.profileInsight.findMany.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCalculateRichness as any).mockResolvedValue(0);
      prismaMock.profileSnapshot.upsert.mockResolvedValue({});

      await service.createSnapshot('u1', 'case-1');

      expect(prismaMock.profileNarrative.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', is_latest: true },
        select: {
          domain: true,
          ai_summary: true,
          completeness: true,
        },
      });
      expect(prismaMock.profileInsight.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', is_active: true },
      });
      expect(mockCalculateRichness).toHaveBeenCalledWith('u1');
      expect(prismaMock.profileSnapshot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { case_id_user_id: { case_id: 'case-1', user_id: 'u1' } },
          create: expect.objectContaining({
            user_id: 'u1',
            case_id: 'case-1',
            richness_score: 0,
          }),
          update: expect.objectContaining({
            richness_score: 0,
          }),
        })
      );
      const upsertCall = prismaMock.profileSnapshot.upsert.mock.calls[0][0];
      const snapshotData = upsertCall.create.snapshot_data as { narratives: unknown[]; insights: unknown[] };
      expect(snapshotData.narratives).toEqual([]);
      expect(snapshotData.insights).toEqual([]);
    });

    it('不得讀取或保存 raw_narrative fallback，只保留已有 AI summary', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([
        { domain: 'attachment', ai_summary: null, raw_narrative: 'x'.repeat(600), completeness: 0.5 },
        { domain: 'family_origin', ai_summary: '  已批准的摘要  ', raw_narrative: 'private canary', completeness: 0.8 },
      ]);
      prismaMock.profileInsight.findMany.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCalculateRichness as any).mockResolvedValue(0.1);
      prismaMock.profileSnapshot.upsert.mockResolvedValue({});

      await service.createSnapshot('u1', 'case-1');

      const upsertCall = prismaMock.profileSnapshot.upsert.mock.calls[0][0];
      const snapshotData = upsertCall.create.snapshot_data as { narratives: Array<{ summary: string }> };
      expect(snapshotData.narratives).toEqual([{ domain: 'family_origin', summary: '已批准的摘要', completeness: 0.8 }]);
      expect(JSON.stringify(snapshotData)).not.toContain('private canary');
      expect(JSON.stringify(snapshotData)).not.toContain('x'.repeat(20));
    });
  });

  describe('getSnapshot', () => {
    it('快照不存在時應返回 null（F06 邊界：NOT_FOUND 語義）', async () => {
      prismaMock.profileSnapshot.findUnique.mockResolvedValue(null);

      const result = await service.getSnapshot('case-1', 'u1');

      expect(prismaMock.profileSnapshot.findUnique).toHaveBeenCalledWith({
        where: { case_id_user_id: { case_id: 'case-1', user_id: 'u1' } },
      });
      expect(result).toBeNull();
    });
  });
});
