/**
 * ClinicalQualityService 單元測試（mock cacheService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockGenerateKey = jest.fn((...parts: string[]) => parts.join(':'));

jest.mock('../../../src/utils/cache', () => ({
  cacheService: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
  CacheService: {
    generateKey: (...args: string[]) => mockGenerateKey(...args),
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { clinicalQualityService } from '../../../src/services/clinical-quality.service';

describe('ClinicalQualityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordPostResponseMetrics', () => {
    it('cache 為空時應以預設值聚合並寫入（F04 邊界：首次記錄不崩潰）', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockGet as any).mockResolvedValue(null);

      await clinicalQualityService.recordPostResponseMetrics({
        judgmentId: 'j1',
        promptVersion: 'v1',
        feltUnderstood: 4,
        feltBlamed: 1,
        willingToTry: 5,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.any(String),
        {
          count: 1,
          understoodSum: 4,
          blamedSum: 1,
          willingSum: 5,
        },
        expect.any(Number)
      );
    });

    it('cache 有既有資料時應正確累加（F04 邊界：聚合邏輯）', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockGet as any).mockResolvedValue({
        count: 2,
        understoodSum: 6,
        blamedSum: 2,
        willingSum: 8,
      });

      await clinicalQualityService.recordPostResponseMetrics({
        judgmentId: 'j2',
        promptVersion: 'v1',
        feltUnderstood: 5,
        feltBlamed: 0,
        willingToTry: 4,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.any(String),
        {
          count: 3,
          understoodSum: 11,
          blamedSum: 2,
          willingSum: 12,
        },
        expect.any(Number)
      );
    });

    it('route 與 caseType 未提供時應使用 fallback（F04 邊界：輸入防禦）', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockGet as any).mockResolvedValue(null);

      await clinicalQualityService.recordPostResponseMetrics({
        judgmentId: 'j3',
        promptVersion: 'v1',
        feltUnderstood: 3,
        feltBlamed: 2,
        willingToTry: 3,
      });

      expect(mockGenerateKey).toHaveBeenCalledWith(
        'clinical:metrics:aggregate',
        expect.stringMatching(/:standard:unknown$/)
      );
    });

    it('promptVersion 缺失時應使用集中未知版本分桶（F04 邊界：legacy 判決）', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockGet as any).mockResolvedValue(null);

      await clinicalQualityService.recordPostResponseMetrics({
        judgmentId: 'j4',
        promptVersion: '   ',
        feltUnderstood: 3,
        feltBlamed: 2,
        willingToTry: 3,
      });

      expect(mockGenerateKey).toHaveBeenCalledWith(
        'clinical:metrics:aggregate',
        expect.stringContaining(':judgment-prompt-version-unknown:')
      );
    });
  });
});
