/**
 * DomainClassificationService 單元測試（mock Prisma、aiService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { findUnique: jest.fn(), update: jest.fn() },
  interviewTurn: { update: jest.fn() },
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

import { DomainClassificationService } from '../../../src/services/domain-classification.service';

describe('DomainClassificationService', () => {
  let service: DomainClassificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DomainClassificationService();
  });

  describe('batchClassify', () => {
    it('session 不存在時應不呼叫 AI 且正常返回（F06 邊界：pipeline 前置條件）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await service.batchClassify('session-1');

      expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: { turns: { orderBy: { turn_order: 'asc' } } },
      });
      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(prismaMock.interviewTurn.update).not.toHaveBeenCalled();
    });

    it('無有效 turns（皆 skipped 或無 user_response）時應不呼叫 AI 且正常返回（F06 邊界：空陣列不崩潰）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: 'session-1',
        domains_touched: [],
        turns: [
          { id: 't1', user_response: null, skipped: false },
          { id: 't2', user_response: '', skipped: false },
          { id: 't3', user_response: '  ', skipped: false },
          { id: 't4', user_response: '有內容', skipped: true },
        ],
      });

      await service.batchClassify('session-1');

      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(prismaMock.interviewTurn.update).not.toHaveBeenCalled();
    });
  });
});
