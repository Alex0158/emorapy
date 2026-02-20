/**
 * AIService 單元測試（useMock 與非 useMock 路徑）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEnvRef = {
  AI_MOCK: true,
  OPENAI_API_KEY: 'sk-dev-test',
  OPENAI_DAILY_LIMIT: 100,
};

const openaiCreateMock = jest.fn();
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef;
  },
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/config/openai', () => ({
  __esModule: true,
  openai: { chat: { completions: { create: (...args: unknown[]) => openaiCreateMock(...args) } } },
  AI_CONFIG: { model: 'gpt-3.5-turbo', maxTokens: 1000, temperature: 0.7, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
}));

const cacheGetMock = jest.fn();
const cacheSetMock = jest.fn();
const lockWithLockMock = jest.fn();
const CacheServiceKeyMock = jest.fn();
const CacheServiceHashKeyMock = jest.fn();
jest.mock('../../../src/utils/cache', () => ({
  __esModule: true,
  cacheService: { get: (...args: unknown[]) => cacheGetMock(...args), set: (...args: unknown[]) => cacheSetMock(...args) },
  CacheService: { generateKey: (...args: unknown[]) => CacheServiceKeyMock(...args), generateHashKey: (...args: unknown[]) => CacheServiceHashKeyMock(...args) },
}));
jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: { withLock: (...args: unknown[]) => lockWithLockMock(...args) },
}));

const retryWithBackoffMock = jest.fn();
jest.mock('../../../src/utils/retry', () => ({
  __esModule: true,
  retryWithBackoff: (...args: unknown[]) => retryWithBackoffMock(...args),
}));

import { AIService } from '../../../src/services/ai.service';

describe('AIService (useMock)', () => {
  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvRef.AI_MOCK = true;
    mockEnvRef.OPENAI_API_KEY = 'sk-dev-test';
    service = new AIService();
  });

  describe('generateText', () => {
    it('useMock 時應返回截斷的 prompt 前綴', async () => {
      const result = await service.generateText('這是一段很長的提示詞內容');
      expect(result).toBe('Mock AI response for: 這是一段很長的提示詞內容');
    });

    it('空 prompt 時應返回 Mock AI response for: ', async () => {
      const result = await service.generateText('');
      expect(result).toContain('Mock AI response for:');
    });
  });

  describe('detectCaseType', () => {
    it('useMock 時應返回 其他衝突', async () => {
      const result = await service.detectCaseType('原告陳述...', '被告陳述...');
      expect(result).toBe('其他衝突');
    });
  });

  describe('analyzeEmotionalDynamics', () => {
    it('useMock 時應返回預設的情感分析結構', async () => {
      const result = await service.analyzeEmotionalDynamics('陳述A', '陳述B');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('personA');
      expect(result).toHaveProperty('personB');
      expect(result).toHaveProperty('interactionCycle');
      expect(result).toHaveProperty('coreIssue');
      expect(result).toHaveProperty('gottmanFlags');
      expect(result).toHaveProperty('suggestedApproach');
      expect(result.personA).toHaveProperty('primaryFeelings');
      expect(result.personA).toHaveProperty('unmetNeeds');
      expect(result.personA).toHaveProperty('communicationPattern');
      expect(['mild', 'moderate', 'serious']).toContain(result.severity);
    });
  });

  describe('generateJudgment', () => {
    it('useMock 時應返回固定判決結構', async () => {
      const result = await service.generateJudgment(
        '生活習慣衝突',
        '原告陳述',
        '被告陳述'
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('responsibilityRatio');
      expect(result).toHaveProperty('summary');
      expect(result.responsibilityRatio).toEqual({ plaintiff: 55, defendant: 45 });
      expect(result.content).toContain('聽見你們');
      expect(result.content).toContain('生日晚餐');
      expect(result.summary).toContain('遲到');
    });
  });

  describe('generateSummary', () => {
    it('useMock 時應返回固定摘要', async () => {
      const result = await service.generateSummary('判決書內容...');
      expect(result).toContain('愛的語言');
      expect(result).toContain('安全感');
    });
  });

  describe('generateReconciliationPlans', () => {
    it('useMock 時應返回固定方案數組', async () => {
      const result = await service.generateReconciliationPlans(
        '生活習慣衝突',
        { plaintiff: 60, defendant: 40 },
        '判決摘要'
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('steps');
      expect(result[0]).toHaveProperty('plan_type');
      expect(result[0]).toHaveProperty('difficulty_level');
      expect(result[0]).toHaveProperty('estimated_duration');
    });
  });

  describe('resetDailyCallCount', () => {
    it('應完成不拋錯並記錄 logger.info', async () => {
      await expect(service.resetDailyCallCount()).resolves.toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith('AI service daily call count reset');
    });
  });
});

describe('AIService (non-useMock)', () => {
  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvRef.AI_MOCK = false;
    mockEnvRef.OPENAI_API_KEY = 'sk-prod-real-key-not-dev';
    mockEnvRef.OPENAI_DAILY_LIMIT = 100;
    service = new AIService();
    (lockWithLockMock as any).mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    (cacheGetMock as any).mockResolvedValue(0);
    (cacheSetMock as any).mockResolvedValue(undefined);
    (CacheServiceKeyMock as any).mockImplementation((...parts: string[]) => parts.join(':'));
    (CacheServiceHashKeyMock as any).mockImplementation((content: string) => 'hash-' + (content || '').slice(0, 8));
    (retryWithBackoffMock as any).mockImplementation(async (fn: () => Promise<string>) => fn());
  });

  describe('generateText', () => {
    it('應調用 openai 並返回內容', async () => {
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: 'AI 回覆內容' } }],
      });
      const result = await service.generateText('你好');
      expect(result).toBe('AI 回覆內容');
      expect(lockWithLockMock).toHaveBeenCalled();
      expect(openaiCreateMock).toHaveBeenCalled();
    });

    it('openai 返回空內容應拋出 AI_SERVICE_ERROR', async () => {
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });
      await expect(service.generateText('你好')).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
        message: expect.stringMatching(/空內容|暫時不可用/),
      });
    });

    it('openai 返回 429 應拋出 AI_SERVICE_ERROR 頻繁', async () => {
      const err = new Error('rate limit') as Error & { status?: number };
      err.status = 429;
      (openaiCreateMock as any).mockRejectedValueOnce(err);
      await expect(service.generateText('你好')).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
        message: expect.stringContaining('頻繁'),
      });
    });

    it('openai 返回 401 應拋出 AI_SERVICE_ERROR 認證失敗', async () => {
      const err = new Error('unauthorized') as Error & { status?: number };
      err.status = 401;
      (openaiCreateMock as any).mockRejectedValueOnce(err);
      await expect(service.generateText('你好')).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
        message: expect.stringContaining('認證失敗'),
      });
    });

    it('openai 返回其他錯誤應拋出 AI_SERVICE_ERROR 暫時不可用並記錄 logger.error', async () => {
      (openaiCreateMock as any).mockRejectedValueOnce(new Error('network error'));
      await expect(service.generateText('你好')).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
        message: expect.stringContaining('暫時不可用'),
      });
      expect(mockLogger.error).toHaveBeenCalledWith('OpenAI API error after retries', expect.objectContaining({
        error: 'network error',
        prompt: expect.any(String),
      }));
    });

    it('每日配額已達上限時應拋出 AI_SERVICE_ERROR', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(100);
      mockEnvRef.OPENAI_DAILY_LIMIT = 100;
      await expect(service.generateText('你好')).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
        message: expect.stringContaining('已達上限'),
      });
      expect(openaiCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('detectCaseType', () => {
    it('緩存未命中時應調用 generateText 並緩存結果', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (retryWithBackoffMock as any).mockImplementation(async (fn: () => Promise<string>) => fn());
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: '生活習慣衝突' } }],
      });
      const result = await service.detectCaseType('原告陳述', '被告陳述');
      expect(result).toBe('生活習慣衝突');
      expect(cacheSetMock).toHaveBeenCalledWith(
        expect.any(String),
        '生活習慣衝突',
        7 * 24 * 60 * 60
      );
    });

    it('緩存命中時應直接返回', async () => {
      (cacheGetMock as any).mockResolvedValueOnce('價值觀衝突');
      const result = await service.detectCaseType('A', 'B');
      expect(result).toBe('價值觀衝突');
      expect(openaiCreateMock).not.toHaveBeenCalled();
    });

    it('generateText 拋錯時應返回 其他衝突並記錄 logger.error', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (retryWithBackoffMock as any).mockRejectedValueOnce(new Error('API error'));
      const result = await service.detectCaseType('A', 'B');
      expect(result).toBe('其他衝突');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to detect case type', expect.objectContaining({ error: expect.any(Error) }));
    });

    it('AI 返回不在 validTypes 中的類型時應返回並緩存 其他衝突', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: '  未知類型名稱。  ' } }],
      });
      const result = await service.detectCaseType('原告', '被告');
      expect(result).toBe('其他衝突');
      expect(cacheSetMock).toHaveBeenCalledWith(
        expect.any(String),
        '其他衝突',
        7 * 24 * 60 * 60
      );
    });
  });

  describe('analyzeEmotionalDynamics', () => {
    it('緩存命中時應直接返回分析結果', async () => {
      const cachedAnalysis = { severity: 'mild', personA: { primaryFeelings: 'x', unmetNeeds: 'y', communicationPattern: 'z' }, personB: { primaryFeelings: 'a', unmetNeeds: 'b', communicationPattern: 'c' }, interactionCycle: 'cycle', coreIssue: 'issue', gottmanFlags: [], suggestedApproach: 'approach' };
      (cacheGetMock as any).mockResolvedValueOnce(cachedAnalysis);
      const result = await service.analyzeEmotionalDynamics('A', 'B');
      expect(result).toEqual(cachedAnalysis);
      expect(openaiCreateMock).not.toHaveBeenCalled();
    });

    it('緩存未命中時應調用 AI 並緩存結果', async () => {
      const analysis = { severity: 'moderate', personA: { primaryFeelings: '委屈', unmetNeeds: '被理解', communicationPattern: '追逐者' }, personB: { primaryFeelings: '壓力', unmetNeeds: '空間', communicationPattern: '迴避者' }, interactionCycle: '追逐-迴避', coreIssue: '安全感', gottmanFlags: [], suggestedApproach: '先建立安全感' };
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(analysis) } }],
      });
      const result = await service.analyzeEmotionalDynamics('陳述A', '陳述B');
      expect(result.severity).toBe('moderate');
      expect(result.personA.primaryFeelings).toBe('委屈');
      expect(cacheSetMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ severity: 'moderate' }),
        24 * 60 * 60
      );
    });

    it('AI 返回無效 JSON 時應返回預設分析', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: '這不是 JSON' } }],
      });
      const result = await service.analyzeEmotionalDynamics('A', 'B');
      expect(result.severity).toBe('moderate');
      expect(mockLogger.warn).toHaveBeenCalledWith('Emotional analysis failed, using default', expect.any(Object));
    });

    it('AI 拋錯時應返回預設分析', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (retryWithBackoffMock as any).mockRejectedValueOnce(new Error('API error'));
      const result = await service.analyzeEmotionalDynamics('A', 'B');
      expect(result.severity).toBe('moderate');
    });
  });

  describe('generateSummary', () => {
    it('應調用 generateText 並返回 trim 後摘要', async () => {
      (openaiCreateMock as any)
        .mockResolvedValueOnce({ choices: [{ message: { content: '  summary  ' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '  summary  ' } }] });
      const result = await service.generateSummary('判決書長內容...');
      expect(result).toBe('summary');
    });

    it('generateText 拋錯時應返回前 100 字加 ...', async () => {
      const longContent = 'x'.repeat(150);
      (retryWithBackoffMock as any).mockRejectedValueOnce(new Error('fail'));
      const result = await service.generateSummary(longContent);
      expect(result).toBe(longContent.substring(0, 100) + '...');
    });
  });

  describe('generateReconciliationPlans', () => {
    it('無法解析 JSON 時應拋出 AI_SERVICE_ERROR', async () => {
      (openaiCreateMock as any).mockResolvedValue({
        choices: [{ message: { content: '這不是 JSON，且無陣列結構' } }],
      });
      await expect(
        service.generateReconciliationPlans('類型', { plaintiff: 50, defendant: 50 }, '摘要')
      ).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
        message: expect.stringContaining('無法解析'),
      });
    });
  });
});
