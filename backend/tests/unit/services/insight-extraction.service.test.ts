/**
 * InsightExtractionService 單元測試（mock Prisma、aiService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  profileNarrative: { findMany: jest.fn() },
  profileInsight: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
};
const mockGenerateText = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/services/ai.service', () => ({
  aiService: { generateText: (...args: unknown[]) => mockGenerateText(...args) },
}));

import { InsightExtractionService } from '../../../src/services/insight-extraction.service';

describe('InsightExtractionService', () => {
  let service: InsightExtractionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InsightExtractionService();
  });

  describe('extractInsights', () => {
    it('無最新敘事時應不呼叫 AI 且正常返回（F06 邊界：空陣列不崩潰）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([]);

      await service.extractInsights('u1', 'session-1');

      expect(prismaMock.profileNarrative.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', is_latest: true },
      });
      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(prismaMock.profileInsight.findFirst).not.toHaveBeenCalled();
    });

    it('敘事皆低於 100 字時應不呼叫 AI 且正常返回（F06 邊界：qualifiedNarratives 空陣列）', async () => {
      prismaMock.profileNarrative.findMany.mockResolvedValue([
        { domain: 'attachment', ai_summary: 'short', raw_narrative: 'x', completeness: 0.5 },
      ]);

      await service.extractInsights('u1', 'session-1');

      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(prismaMock.profileInsight.findFirst).not.toHaveBeenCalled();
    });
  });
});
