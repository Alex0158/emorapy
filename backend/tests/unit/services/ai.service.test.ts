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

let aiLedgerCounter = 0;
const mockAiLedgerStart = jest.fn(async (_input: unknown) => ({ requestId: `ledger-${++aiLedgerCounter}` }));
const mockAiLedgerComplete = jest.fn(async (_input: unknown) => undefined);
const mockAiLedgerFail = jest.fn(async (_input: unknown) => undefined);
jest.mock('../../../src/services/ai-request-ledger.service', () => ({
  __esModule: true,
  aiRequestLedgerService: {
    start: (input: unknown) => mockAiLedgerStart(input),
    complete: (input: unknown) => mockAiLedgerComplete(input),
    fail: (input: unknown) => mockAiLedgerFail(input),
  },
}));

import { AIService, IPV_SIGNAL_REGEX } from '../../../src/services/ai.service';

describe('IPV_SIGNAL_REGEX', () => {
  it('應匹配常見暴力/動手口語敘述', () => {
    expect(IPV_SIGNAL_REGEX.test('他打我')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('我打了他')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('對方動手')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('推我')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('扇巴掌')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('砸東西')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('掐')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('拉扯')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('摔東西')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('衝過來')).toBe(true);
  });
  it('應匹配既有安全詞', () => {
    expect(IPV_SIGNAL_REGEX.test('控制行為')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('暴力')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('威脅')).toBe(true);
  });
  it('應匹配 F02-BUG-002 擴充詞：打人、摔碗', () => {
    expect(IPV_SIGNAL_REGEX.test('打人')).toBe(true);
    expect(IPV_SIGNAL_REGEX.test('摔碗')).toBe(true);
  });
});

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
      expect(result).toHaveProperty('emotionalAnalysis');
      expect(result.responsibilityRatio).toEqual({ plaintiff: 55, defendant: 45 });
      expect(result.content).toContain('聽見你們');
      expect(result.content).toContain('生日晚餐');
      expect(result.summary).toContain('遲到');

      const ea = result.emotionalAnalysis!;
      expect(ea.severity).toBe('moderate');
      expect(ea.interactionCycle).toContain('追-逃');
      expect(ea.personA.readinessStage).toBe('準備期');
      expect(ea.personB.readinessStage).toBe('沉思期');
      expect(ea.coreIssue).toBeTruthy();
      expect(ea.gottmanFlags).toContain('批評（翻舊帳模式）');
      expect(ea.suggestedApproach).toBeTruthy();
    });

    it('useMock 且 en-US 時應返回英文判決可見內容', async () => {
      const result = await service.generateJudgment(
        '生活習慣衝突',
        '原告陳述',
        '被告陳述',
        { locale: 'en-US' },
      );

      expect(result.content).toContain('I hear both of you');
      expect(result.summary).toContain('emotionally safe');
      expect(result.emotionalAnalysis?.coreIssue).toContain('both people are asking');
      expect(`${result.content} ${result.summary} ${result.emotionalAnalysis?.coreIssue}`).not.toMatch(/[\u4e00-\u9fff]/);
    });
  });

  describe('generateSummary', () => {
    it('useMock 時應返回固定摘要', async () => {
      const result = await service.generateSummary('判決書內容...');
      expect(result).toContain('愛的語言');
      expect(result).toContain('安全感');
    });

    it('useMock 且 en-US 時應返回英文摘要', async () => {
      const result = await service.generateSummary('Judgment content...', undefined, undefined, undefined, 'en-US');
      expect(result).toContain('emotionally safe');
      expect(result).not.toMatch(/[\u4e00-\u9fff]/);
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

    it('useMock 且 en-US 時應返回英文可見方案內容', async () => {
      const result = await service.generateReconciliationPlans(
        '生活習慣衝突',
        { plaintiff: 60, defendant: 40 },
        '判決摘要',
        undefined,
        undefined,
        undefined,
        { locale: 'en-US' },
      );

      const visibleText = [
        result[0].title,
        result[0].description,
        result[0].first_step,
        result[0].fallback_step,
        result[0].pause_rule,
        result[0].steps.join(' '),
      ].join(' ');
      expect(visibleText).toContain('Today');
      expect(visibleText).not.toMatch(/[\u4e00-\u9fff]/);
    });
  });

  describe('generateReplannedRepairPlan', () => {
    const originalPlan = {
      title: 'Repair plan',
      description: 'Original description.',
      steps: ['Original first step'],
      expected_effect: 'Original effect.',
      fit_reason: 'Original fit.',
      do_not_use_when: [],
      first_step: 'Original first step',
      fallback_step: 'Original fallback.',
      pause_rule: 'Original pause rule.',
      time_cost: 1,
      money_cost: 1,
      emotion_cost: 1,
      skill_requirement: 1,
      plan_type: 'communication' as const,
      estimated_duration: 1,
      difficulty_level: 'easy' as const,
    };

    it('useMock 且 en-US 時應返回英文重調內容', async () => {
      const result = await service.generateReplannedRepairPlan({
        originalPlan,
        intent: 'repair',
        mode: 'lower_pressure',
        reason: 'manual',
        relationshipMode: 'solo',
        locale: 'en-US',
      });

      expect(result.title).toContain('adjusted version');
      expect(result.first_step).toContain('lighter');
      expect(result.pause_rule).not.toMatch(/[\u4e00-\u9fff]/);
      expect(result.steps.join(' ')).not.toMatch(/[\u4e00-\u9fff]/);
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
    aiLedgerCounter = 0;
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
        promptChars: 2,
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

    it('generateText 拋錯時應返回 其他衝突並記錄 logger.warn', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (retryWithBackoffMock as any).mockRejectedValueOnce(new Error('API error'));
      const result = await service.detectCaseType('A', 'B');
      expect(result).toBe('其他衝突');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to detect case type, fallback to default',
        expect.objectContaining({ error: expect.any(Error) })
      );
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
      expect(mockLogger.warn).toHaveBeenCalledWith('Emotional analysis failed, using generic fallback', expect.any(Object));
    });

    it('AI 拋錯時應返回預設分析', async () => {
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (retryWithBackoffMock as any).mockRejectedValueOnce(new Error('API error'));
      const result = await service.analyzeEmotionalDynamics('A', 'B');
      expect(result.severity).toBe('moderate');
    });

    it('en-US 時應在情感分析 prompt 中要求英文可見值且 cache key 含 locale', async () => {
      openaiCreateMock.mockReset();
      const analysis = {
        severity: 'moderate',
        personA: { primaryFeelings: 'hurt', unmetNeeds: 'care', communicationPattern: 'pursues reassurance' },
        personB: { primaryFeelings: 'pressure', unmetNeeds: 'space', communicationPattern: 'withdraws' },
        interactionCycle: 'pursue-withdraw',
        triggerPattern: 'late replies',
        coreIssue: 'safety',
        relationshipStrengths: 'still trying',
        gottmanFlags: [],
        safetyFlags: [],
        suggestedApproach: 'slow down first',
      };
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (openaiCreateMock as any).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(analysis) } }],
      });

      await service.analyzeEmotionalDynamics('A statement', 'B statement', undefined, undefined, undefined, 'en-US');

      expect(CacheServiceHashKeyMock).toHaveBeenCalledWith('emotionalAnalysis', expect.stringContaining('en-US'));
      const request = (openaiCreateMock as any).mock.calls[0][0];
      const userMessage = request.messages.find((message: { role: string }) => message.role === 'user');
      expect(userMessage.content).toContain('Output language requirement');
      expect(userMessage.content).toContain('must be in natural English');
      expect(userMessage.content).toContain('Keep JSON field names');
    });
  });

  describe('generateJudgment', () => {
    it('en-US 時應在判決草稿與摘要 prompt 中要求英文可見內容', async () => {
      openaiCreateMock.mockReset();
      const analysis = {
        severity: 'moderate' as const,
        personA: { primaryFeelings: 'hurt', unmetNeeds: 'care', communicationPattern: 'pursues reassurance' },
        personB: { primaryFeelings: 'pressure', unmetNeeds: 'space', communicationPattern: 'withdraws' },
        interactionCycle: 'pursue-withdraw',
        triggerPattern: 'late replies',
        coreIssue: 'safety',
        relationshipStrengths: 'still trying',
        gottmanFlags: [],
        safetyFlags: [],
        suggestedApproach: 'slow down first',
      };
      (openaiCreateMock as any)
        .mockResolvedValueOnce({ choices: [{ message: { content: 'English judgment draft' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"plaintiff":50,"defendant":50,"confidence":1}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'English summary' } }] });

      const result = await service.generateJudgment(
        'relationship conflict',
        'A statement',
        'B statement',
        { locale: 'en-US', prefetchedAnalysis: analysis },
      );

      expect(result.content).toBe('English judgment draft');
      expect(result.summary).toBe('English summary');
      const userMessages = (openaiCreateMock as any).mock.calls.map((call: any[]) =>
        call[0].messages.find((message: { role: string }) => message.role === 'user')?.content || '',
      );
      expect(userMessages[0]).toContain('Output language requirement');
      expect(userMessages[0]).toContain('must be in natural English');
      expect(userMessages[2]).toContain('Output language requirement');
      expect(userMessages[2]).toContain('must be in natural English');
    });

    it('應優先採用結構化責任分輸出（confidence=1）', async () => {
      const analysis = {
        severity: 'moderate',
        personA: { primaryFeelings: '委屈', unmetNeeds: '被理解', communicationPattern: '追逐型' },
        personB: { primaryFeelings: '壓力', unmetNeeds: '被體諒', communicationPattern: '迴避型' },
        interactionCycle: '追逐-沉默',
        triggerPattern: '家務分工',
        coreIssue: '被重視需求',
        relationshipStrengths: '仍願意溝通',
        gottmanFlags: [],
        safetyFlags: [],
        suggestedApproach: '先同理後協調',
      };
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (openaiCreateMock as any)
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(analysis) } }] })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '### 各自可以調整的方向\n**調整比重**：\n- 原告：70% 調整空間\n- 被告：30% 調整空間' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '{"plaintiff":40,"defendant":60,"confidence":1}' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '摘要內容' } }],
        });

      const result = await service.generateJudgment(
        '生活習慣衝突',
        '我覺得家務分配一直很不平均。',
        '我最近工作很忙。',
        {
          ledger: {
            scopeType: 'case',
            scopeId: 'case-1',
            productFlow: 'formal_remote',
          },
        }
      );

      expect(result.responsibilityRatio).toEqual({ plaintiff: 40, defendant: 60 });
      expect(result.summary).toBe('摘要內容');
      const ledgerStarts = mockAiLedgerStart.mock.calls.map((call) => call[0]);
      expect(ledgerStarts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          requestKind: 'emotional_analysis',
          promptVersion: 'judgment-emotional-analysis@v1.0',
        }),
        expect.objectContaining({
          requestKind: 'judgment_draft',
          promptVersion: 'judgment-draft@v4.0',
        }),
        expect.objectContaining({
          requestKind: 'responsibility_ratio',
          promptVersion: 'judgment-responsibility-ratio@v1.0',
        }),
        expect.objectContaining({
          requestKind: 'judgment_summary',
          promptVersion: 'judgment-summary@v1.0',
        }),
      ]));
    });

    it('結構化評估失敗時應回退為文案抽取+規則校準', async () => {
      const analysis = {
        severity: 'moderate',
        personA: { primaryFeelings: '失落', unmetNeeds: '被看見', communicationPattern: '' },
        personB: { primaryFeelings: '壓力', unmetNeeds: '被理解', communicationPattern: '' },
        interactionCycle: '反覆誤解',
        triggerPattern: '家務安排',
        coreIssue: '需求未對齊',
        relationshipStrengths: '願意對話',
        gottmanFlags: [],
        safetyFlags: [],
        suggestedApproach: '先澄清需求',
      };
      (cacheGetMock as any).mockResolvedValueOnce(null);
      (openaiCreateMock as any)
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(analysis) } }] })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '### 各自可以調整的方向\n**調整比重**：\n- 原告：70% 調整空間\n- 被告：30% 調整空間' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'not-json' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '摘要內容' } }],
        });

      const result = await service.generateJudgment(
        '生活習慣衝突',
        '我們最近在家務安排上一直有摩擦。',
        '我最近也在調整，但還沒找到節奏。'
      );

      // 回退路徑：70/30（抽取） 與 50/50（規則）按 0.55 混合，約為 61/39
      expect(result.responsibilityRatio).toEqual({ plaintiff: 61, defendant: 39 });
    });

    it('safety_support 應跳過一般比例算法並將明確加害方設為主要安全介入負擔', async () => {
      const analysis = {
        severity: 'serious' as const,
        personA: { primaryFeelings: '害怕', unmetNeeds: '安全', communicationPattern: '自我保護' },
        personB: { primaryFeelings: '失控', unmetNeeds: '情緒調節', communicationPattern: '高壓控制' },
        interactionCycle: '暴力升級',
        triggerPattern: '爭吵時',
        coreIssue: '安全風險',
        relationshipStrengths: '',
        gottmanFlags: [],
        safetyFlags: ['暴力'],
        suggestedApproach: '先做安全支持',
      };
      (openaiCreateMock as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: '本案先處理安全與邊界，不輸出對稱式調整比重。' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '摘要內容' } }],
        });

      const result = await service.generateJudgment(
        '情感需求衝突',
        '他打我，摔碗後又威脅我。',
        '我只是太生氣。',
        { routeType: 'safety_support', prefetchedAnalysis: analysis }
      );

      expect(result.responsibilityRatio).toEqual({ plaintiff: 20, defendant: 80 });
      expect(openaiCreateMock).toHaveBeenCalledTimes(2);
    });

    it('safety_support 應識別角色 A 自承動手時由角色 A 承擔主要安全介入負擔', async () => {
      const analysis = {
        severity: 'serious' as const,
        personA: { primaryFeelings: '失控', unmetNeeds: '情緒調節', communicationPattern: '高壓控制' },
        personB: { primaryFeelings: '害怕', unmetNeeds: '安全', communicationPattern: '退縮' },
        interactionCycle: '暴力升級',
        triggerPattern: '爭吵時',
        coreIssue: '安全風險',
        relationshipStrengths: '',
        gottmanFlags: [],
        safetyFlags: ['暴力'],
        suggestedApproach: '先做安全支持',
      };
      (openaiCreateMock as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: '本案先處理安全與邊界。' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '摘要內容' } }],
        });

      const result = await service.generateJudgment(
        '情感需求衝突',
        '我打了他，也摔東西。',
        '我很害怕。',
        { routeType: 'safety_support', prefetchedAnalysis: analysis }
      );

      expect(result.responsibilityRatio).toEqual({ plaintiff: 80, defendant: 20 });
      expect(openaiCreateMock).toHaveBeenCalledTimes(2);
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
    it('en-US 時應在 prompt 中要求 JSON 可見值使用英文', async () => {
      openaiCreateMock.mockReset();
      (openaiCreateMock as any).mockResolvedValue({
        choices: [{ message: { content: '[]' } }],
      });

      await service.generateReconciliationPlans(
        '生活習慣衝突',
        { plaintiff: 50, defendant: 50 },
        '摘要',
        undefined,
        undefined,
        undefined,
        { locale: 'en-US' },
      );

      const request = (openaiCreateMock as any).mock.calls[0][0];
      const userMessage = request.messages.find((message: { role: string }) => message.role === 'user');
      expect(userMessage.content).toContain('Output language requirement');
      expect(userMessage.content).toContain('must be in natural English');
      expect(userMessage.content).toContain('Keep JSON field names exactly as specified');
    });

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

  describe('generateReplannedRepairPlan', () => {
    it('en-US 時應在 replan prompt 中要求 JSON 可見值使用英文', async () => {
      openaiCreateMock.mockReset();
      (openaiCreateMock as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Adjusted plan',
              description: 'A lower-pressure version.',
              steps: ['Do one smaller step.'],
              expected_effect: 'It may feel more sustainable.',
              fit_reason: 'It fits recent check-ins.',
              do_not_use_when: ['When contact feels unsafe.'],
              first_step: 'Do one smaller step.',
              fallback_step: 'Write it down first.',
              pause_rule: 'Pause if stress rises.',
              risk_note: 'Do not rush.',
              time_cost: 1,
              money_cost: 1,
              emotion_cost: 1,
              skill_requirement: 1,
              plan_type: 'communication',
              estimated_duration: 1,
            }),
          },
        }],
      });

      await service.generateReplannedRepairPlan({
        originalPlan: {
          title: 'Repair plan',
          description: 'Original description.',
          steps: ['Original step'],
          expected_effect: 'Original effect.',
          fit_reason: 'Original fit.',
          do_not_use_when: [],
          first_step: 'Original step',
          fallback_step: 'Original fallback.',
          pause_rule: 'Original pause.',
          time_cost: 1,
          money_cost: 1,
          emotion_cost: 1,
          skill_requirement: 1,
          plan_type: 'communication',
          estimated_duration: 1,
        },
        intent: 'repair',
        mode: 'lower_pressure',
        reason: 'manual',
        relationshipMode: 'solo',
        locale: 'en-US',
      });

      const request = (openaiCreateMock as any).mock.calls[0][0];
      const userMessage = request.messages.find((message: { role: string }) => message.role === 'user');
      expect(userMessage.content).toContain('Output language requirement');
      expect(userMessage.content).toContain('must be in natural English');
    });
  });
});
