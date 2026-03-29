/**
 * AsyncPipelineService 單元測試（mock Prisma、lockService、依賴 services）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { findUnique: jest.fn(), update: jest.fn() },
};
const mockAcquire = jest.fn();
const mockRelease = jest.fn();
const mockWithLock = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/lock', () => ({
  lockService: {
    acquire: (...args: unknown[]) => mockAcquire(...args),
    release: (...args: unknown[]) => mockRelease(...args),
    withLock: (...args: unknown[]) => mockWithLock(...args),
  },
}));
jest.mock('../../../src/services/domain-classification.service', () => ({ domainClassificationService: {} }));
jest.mock('../../../src/services/narrative.service', () => ({ narrativeService: {} }));
jest.mock('../../../src/services/insight-extraction.service', () => ({ insightExtractionService: {} }));
jest.mock('../../../src/services/profile-richness.service', () => ({ profileRichnessService: {} }));
jest.mock('../../../src/services/ai.service', () => ({ aiService: {} }));

import { AsyncPipelineService } from '../../../src/services/async-pipeline.service';

describe('AsyncPipelineService', () => {
  let service: AsyncPipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AsyncPipelineService();
  });

  describe('process', () => {
    it('session 不存在時應不執行 pipeline 且正常返回（F06 邊界：pipeline 前置條件）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await service.process('session-1');

      expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
      expect(mockAcquire).not.toHaveBeenCalled();
    });

    it('session 狀態非 PROCESSING 時應不執行 pipeline 且正常返回（F06 邊界：狀態護欄）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: 'session-1',
        user_id: 'u1',
        status: INTERVIEW_STATUS.COMPLETED,
      });

      await service.process('session-1');

      expect(mockAcquire).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('session 不存在時應拋出 VALIDATION_ERROR（F06 邊界：retry 前置條件）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await expect(service.resume('session-1', 0)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('僅可重試處理失敗的訪談'),
      });
      expect(mockWithLock).not.toHaveBeenCalled();
    });

    it('session 狀態為 IN_PROGRESS 時應拋出 VALIDATION_ERROR（F06 邊界：retry 狀態護欄）', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: 'session-1',
        user_id: 'u1',
        status: INTERVIEW_STATUS.IN_PROGRESS,
      });

      await expect(service.resume('session-1', 0)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('僅可重試處理失敗的訪談'),
      });
      expect(mockWithLock).not.toHaveBeenCalled();
    });
  });
});
