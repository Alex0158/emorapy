/**
 * NarrativeService 單元測試（mock Prisma、aiService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { findUnique: jest.fn() },
  profileNarrative: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
const mockGenerateText = jest.fn();
jest.mock('../../../src/services/ai.service', () => ({
  aiService: { generateText: (...args: unknown[]) => mockGenerateText(...args) },
}));

import { NarrativeService } from '../../../src/services/narrative.service';

describe('NarrativeService', () => {
  let service: NarrativeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NarrativeService();
  });

  describe('extractNarratives', () => {
    it('訪談不存在應拋出 NOT_FOUND（F06 邊界：pipeline 前置條件）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await expect(service.extractNarratives('session-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('訪談'),
      });
      expect(prismaMock.profileNarrative.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('訪談存在時應萃取敘事並寫入 ProfileNarrative（F06 成功路徑）', async () => {
      const session = {
        id: 'session-1',
        user_id: 'u1',
        domains_touched: ['personality'], // PsychDomain[] 簡化為字串
        turns: [
          { ai_message: '你好', user_response: '我比較內向', ai_target_domains: ['personality'] },
        ],
      };
      prismaMock.interviewSession.findUnique.mockResolvedValue(session);
      prismaMock.profileNarrative.findMany.mockResolvedValue([]);

      const mockUpdateMany = jest.fn();
      // @ts-expect-error mock 泛型推斷
      mockUpdateMany.mockResolvedValue({ count: 0 });
      const mockCreate = jest.fn();
      // @ts-expect-error mock 泛型推斷
      mockCreate.mockResolvedValue({ id: 'n-1' });
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          profileNarrative: { updateMany: mockUpdateMany, create: mockCreate },
        };
        return fn(tx);
      });

      await service.extractNarratives('session-1');

      expect(prismaMock.profileNarrative.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', domain: { in: ['personality'] }, is_latest: true },
        select: { domain: true, raw_narrative: true, ai_summary: true, source_sessions: true, completeness: true },
      });
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(mockUpdateMany).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'u1',
          domain: 'personality',
          raw_narrative: expect.stringContaining('你好'),
          is_latest: true,
          source_sessions: ['session-1'],
        }),
      });
    });
  });

  describe('summarizeNarratives', () => {
    it('無最新敘事時應不呼叫 AI 且正常返回（F06 邊界：空陣列不崩潰）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([]);

      await service.summarizeNarratives('u1');

      expect(prismaMock.profileNarrative.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', is_latest: true },
      });
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('有最新敘事時應呼叫 AI 並更新 ai_summary（F06 成功路徑）', async () => {
      const narratives = [
        { id: 'n-1', domain: 'personality', raw_narrative: '用戶敘事內容', is_latest: true },
      ];
      prismaMock.profileNarrative.findMany.mockResolvedValue(narratives);
      prismaMock.profileNarrative.update.mockResolvedValue({ id: 'n-1' });
      // @ts-expect-error mock 泛型推斷
      mockGenerateText.mockResolvedValue('摘要文字');

      await service.summarizeNarratives('u1');

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.stringContaining('敘事內容'),
        expect.any(Object)
      );
      expect(prismaMock.profileNarrative.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { ai_summary: '摘要文字' },
      });
    });
  });
});
