/**
 * JudgmentService 單元測試（快速體驗主流程與關鍵分支）
 */
import { AI_TIMEOUT } from '../../../src/utils/constants';

const prismaMock: any = {
  judgment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const aiServiceMock = {
  generateJudgment: jest.fn(),
  analyzeEmotionalDynamics: jest.fn(),
};

const sessionServiceMock = {
  getSession: jest.fn(),
  markSessionCompleted: jest.fn(),
};

const lockServiceMock = {
  withLock: jest.fn(async (_key: string, fn: any) => fn()),
};

const cacheServiceMock = {
  get: jest.fn(),
  set: jest.fn(),
};

const CacheServiceMock = {
  generateKey: jest.fn((prefix: string, day: string) => `${prefix}:${day}`),
};

const loggerMock = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: aiServiceMock,
  IPV_SIGNAL_REGEX: /控制|暴力|威脅/,
  CRISIS_SIGNAL_REGEX: /自傷|自殺/,
}));

jest.mock('../../../src/services/session.service', () => ({
  __esModule: true,
  sessionService: sessionServiceMock,
}));

jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: lockServiceMock,
}));

jest.mock('../../../src/utils/cache', () => ({
  __esModule: true,
  cacheService: cacheServiceMock,
  CacheService: CacheServiceMock,
}));

import { JudgmentService } from '../../../src/services/judgment.service';

const baseCase = (overrides: Record<string, unknown> = {}) => ({
  id: 'case-1',
  status: 'submitted',
  mode: 'quick',
  session_id: 'guest_1704067200000_abcdefghijklmnop',
  type: '其他衝突',
  plaintiff_statement: 'A'.repeat(60),
  defendant_statement: 'B'.repeat(60),
  plaintiff_id: null,
  defendant_id: null,
  pairing: { user1_id: null, user2_id: null },
  updated_at: new Date(Date.now() - 120000),
  ...overrides,
});

describe('JudgmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.case.update.mockResolvedValue({ id: 'case-1' });
    prismaMock.user.findMany.mockResolvedValue([]);
    aiServiceMock.analyzeEmotionalDynamics.mockResolvedValue({
      severity: 'moderate',
      personA: {
        primaryFeelings: '',
        unmetNeeds: '',
        communicationPattern: '',
      },
      personB: {
        primaryFeelings: '',
        unmetNeeds: '',
        communicationPattern: '',
      },
      interactionCycle: '',
      triggerPattern: '',
      coreIssue: '',
      relationshipStrengths: '',
      gottmanFlags: [],
      safetyFlags: [],
      suggestedApproach: '',
    });
    cacheServiceMock.get.mockResolvedValue(1);
    cacheServiceMock.set.mockResolvedValue(undefined);
    sessionServiceMock.markSessionCompleted.mockResolvedValue(undefined);
  });

  describe('generateJudgment', () => {
    it('已有判決時應直接返回 existing', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce({ id: 'j-existing', case_id: 'case-1' });
      const service = new JudgmentService();
      const result = await service.generateJudgment('case-1', { sessionId: 'guest_1704067200000_abcdefghijklmnop' });
      expect(result.id).toBe('j-existing');
      expect(aiServiceMock.generateJudgment).not.toHaveBeenCalled();
    });

    it('案件不存在應拋出 NOT_FOUND', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(null);
      const service = new JudgmentService();
      await expect(service.generateJudgment('missing', { sessionId: 's1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('quick 模式 session 不匹配應拋出 FORBIDDEN', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase({ session_id: 's-real' }));
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: 's-fake' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('collaborative 模式使用匹配 sessionId 時應允許生成判決', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({
          mode: 'collaborative',
          session_id: 's-collab',
          plaintiff_id: null,
          defendant_id: null,
        })
      );
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 55, defendant: 45 },
        summary: 'sum',
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j-collab', case_id: 'case-1' });

      const service = new JudgmentService();
      const result = await service.generateJudgment('case-1', { sessionId: 's-collab' });

      expect(aiServiceMock.generateJudgment).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'j-collab', case_id: 'case-1' });
    });

    it('formal collaborative 且 session_id 為 null 時應走 JWT 當事人授權', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({
          mode: 'collaborative',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        })
      );
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 55, defendant: 45 },
        summary: 'sum',
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j-formal-collab', case_id: 'case-1' });

      const service = new JudgmentService();
      const result = await service.generateJudgment('case-1', {
        userId: 'u1',
        sessionId: 'stale-session-should-not-win',
      });

      expect(aiServiceMock.generateJudgment).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'j-formal-collab', case_id: 'case-1' });
    });

    it('formal collaborative 且 session_id 為 null 時非當事人應被拒絕', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({
          mode: 'collaborative',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        })
      );

      const service = new JudgmentService();

      await expect(
        service.generateJudgment('case-1', {
          userId: 'u3',
          sessionId: 'stale-session-should-not-win',
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('remote 模式非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'remote', plaintiff_id: 'u1', defendant_id: 'u2', session_id: null })
      );
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { userId: 'u3' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('生成判決時若 defendant_statement 存在應傳入原值（覆蓋 || 空字串分支）', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase({ defendant_statement: '有被告陳述' }));
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j1', case_id: 'case-1' });

      const service = new JudgmentService();
      await service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });

      expect(aiServiceMock.generateJudgment).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        '有被告陳述',
        expect.objectContaining({ signal: expect.any(Object) })
      );
    });

    it('生成判決時若 defendant_statement 為空應傳入空字串', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase({ defendant_statement: null }));
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j1', case_id: 'case-1' });

      const service = new JudgmentService();
      await service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });

      expect(aiServiceMock.generateJudgment).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        '',
        expect.objectContaining({ signal: expect.any(Object) })
      );
    });

    it('案件狀態不允許應拋出 CASE_NOT_READY', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase({ status: 'completed' }));
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'CASE_NOT_READY',
      });
    });

    it('judgment_failed 且在冷卻期內應拋出 CONFLICT', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ status: 'judgment_failed', updated_at: new Date(Date.now() - 1000) })
      );
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('設置 in_progress 失敗時應記錄 warn 並繼續', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      prismaMock.case.update
        .mockRejectedValueOnce(new Error('update failed'))
        .mockResolvedValueOnce({ id: 'case-1' });
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j1', case_id: 'case-1' });

      const service = new JudgmentService();
      await service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Failed to set case status to in_progress',
        expect.objectContaining({ caseId: 'case-1', error: expect.any(Error) })
      );
    });

    it('AI 超時/abort 應標記 judgment_failed 並回拋 AI_SERVICE_ERROR', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockImplementationOnce(
        (_type: string, _p: string, _d: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener('abort', () => reject(new Error('AbortError')));
          })
      );

      jest.useFakeTimers();
      const service = new JudgmentService();
      const promise = service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });
      const rejected = expect(promise).rejects.toMatchObject({ code: 'AI_SERVICE_ERROR' });
      await jest.advanceTimersByTimeAsync(AI_TIMEOUT.JUDGMENT_GENERATION);
      await rejected;
      jest.useRealTimers();

      expect(prismaMock.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({ status: 'judgment_failed' }),
        })
      );
    });

    it('AI 401/429/上限/空內容分支都應更新失敗原因', async () => {
      const errorCases = [
        { err: Object.assign(new Error('x'), { status: 401 }), reason: '認證失敗' },
        { err: Object.assign(new Error('x'), { status: 429 }), reason: '過於頻繁' },
        { err: new Error('已達上限'), reason: '已達上限' },
        { err: new Error('空內容'), reason: '內容異常' },
      ];

      for (const c of errorCases) {
        jest.clearAllMocks();
        prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
        prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
        aiServiceMock.generateJudgment.mockRejectedValueOnce(c.err);
        const service = new JudgmentService();
        await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
          code: 'AI_SERVICE_ERROR',
        });
        expect(prismaMock.case.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'judgment_failed',
              judgment_failure_reason: expect.stringContaining(c.reason),
            }),
          })
        );
      }
    });

    it('更新 judgment_failed 失敗時應記錄 logger.error', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockRejectedValueOnce(new Error('timeout'));
      prismaMock.case.update
        .mockResolvedValueOnce({ id: 'case-1' }) // in_progress
        .mockRejectedValueOnce(new Error('db failed')); // judgment_failed
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to update case status to judgment_failed',
        expect.objectContaining({ caseId: 'case-1' })
      );
    });

    it('AI 拋出非 Error 類型時仍應進入失敗分支並記錄 fallback 錯誤', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockRejectedValueOnce('plain-string-error');
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Judgment generation failed',
        expect.objectContaining({ caseId: 'case-1', status: 'judgment_failed' })
      );
    });

    it('AI 拋出 undefined 時應使用默認失敗訊息（覆蓋 String(... || ... || "")）', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockRejectedValueOnce(undefined);
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
      });
      expect(prismaMock.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'judgment_failed',
            judgment_failure_reason: expect.stringContaining('暫時不可用'),
          }),
        })
      );
    });

    it('責任比例總和不為 100 應拋出 VALIDATION_ERROR，並回補 AI 配額', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 90, defendant: 20 },
        summary: 'sum',
      });
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(cacheServiceMock.set).toHaveBeenCalled();
    });

    it('回補配額時 cache count 缺失應以 0 起算（覆蓋 || 0 分支）', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 90, defendant: 20 },
        summary: 'sum',
      });
      cacheServiceMock.get.mockResolvedValueOnce(undefined);
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(cacheServiceMock.set).toHaveBeenCalledWith(expect.any(String), 0, 24 * 60 * 60);
    });

    it('transaction 內 existing2 存在時應直接返回', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.$transaction.mockImplementationOnce(async (fn: any) =>
        fn({
          judgment: { findUnique: jest.fn().mockResolvedValue({ id: 'j-existing2', case_id: 'case-1' }) },
          case: { update: jest.fn() },
        })
      );
      const service = new JudgmentService();
      const result = await service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });
      expect(result.id).toBe('j-existing2');
    });

    it('P2002(case_id) 競態時應返回已存在判決', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.$transaction.mockImplementationOnce(async (fn: any) =>
        fn({
          judgment: {
            findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'j-race', case_id: 'case-1' }),
            create: jest.fn().mockRejectedValue({ code: 'P2002', meta: { target: ['case_id'] } }),
          },
          case: { update: jest.fn() },
        })
      );
      const service = new JudgmentService();
      const result = await service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });
      expect(result.id).toBe('j-race');
    });

    it('transaction create 拋出非 P2002 錯誤時應原樣拋出', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.$transaction.mockImplementationOnce(async (fn: any) =>
        fn({
          judgment: {
            findUnique: jest.fn().mockResolvedValueOnce(null),
            create: jest.fn().mockRejectedValue(new Error('tx-create-fail')),
          },
          case: { update: jest.fn() },
        })
      );

      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toThrow(
        'tx-create-fail'
      );
    });

    it('isResponsibilityRatio 無效格式應拋出 VALIDATION_ERROR', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: NaN, defendant: NaN } as any,
        summary: 'sum',
      });
      const service = new JudgmentService();
      await expect(service.generateJudgment('case-1', { sessionId: baseCase().session_id as string })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('quick 成功後 markSessionCompleted 失敗應僅記錄 warn', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j1', case_id: 'case-1' });
      sessionServiceMock.markSessionCompleted.mockRejectedValueOnce(new Error('session mark failed'));
      const service = new JudgmentService();
      await service.generateJudgment('case-1', { sessionId: baseCase().session_id as string });
      await Promise.resolve();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Failed to mark session completed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('remote 模式應寫入 context_governance 審計（含 consent 治理結果）', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({
          mode: 'remote',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        })
      );
      // 未返回任何 consent，觸發 consent missing 路徑
      prismaMock.user.findMany.mockResolvedValueOnce([]);
      aiServiceMock.generateJudgment.mockResolvedValueOnce({
        content: 'ok',
        responsibilityRatio: { plaintiff: 60, defendant: 40 },
        summary: 'sum',
        emotionalAnalysis: {
          severity: 'moderate',
          personA: {},
          personB: {},
          interactionCycle: '',
          triggerPattern: '',
          coreIssue: '',
          relationshipStrengths: '',
          gottmanFlags: [],
          safetyFlags: [],
          suggestedApproach: '',
        },
      });
      prismaMock.judgment.create.mockResolvedValueOnce({ id: 'j-ctx', case_id: 'case-1' });

      const service = new JudgmentService();
      await service.generateJudgment('case-1', { userId: 'u1' });

      expect(prismaMock.judgment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emotional_analysis: expect.objectContaining({
              context_governance: expect.objectContaining({
                profileContext: expect.objectContaining({
                  reason: expect.stringMatching(/plaintiff_consent_missing|no_eligible_profile_sources/),
                }),
                caseContext: expect.objectContaining({
                  reason: expect.stringMatching(/plaintiff_consent_missing|case_context_not_available/),
                }),
              }),
            }),
          }),
        })
      );
    });
  });

  describe('getJudgmentByCaseId', () => {
    it('quick 且 judgment_failed 應拋出 JUDGMENT_FAILED', async () => {
      const caseId = 'case-2';
      const sessionId = 'guest_1704067200000_a1b2c3d4e5f6g7h8';

      prismaMock.case.findUnique.mockResolvedValueOnce({
        ...baseCase({ id: caseId, session_id: sessionId, status: 'judgment_failed' }),
      });
      sessionServiceMock.getSession.mockResolvedValueOnce({
        id: sessionId,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      });

      const service = new JudgmentService();
      await expect(service.getJudgmentByCaseId(caseId, undefined, sessionId)).rejects.toMatchObject({
        code: 'JUDGMENT_FAILED',
      });
    });

    it('案件不存在應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(null);
      const service = new JudgmentService();
      await expect(service.getJudgmentByCaseId('no-case', undefined, 's1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('quick 模式無 session 或不匹配應 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase({ session_id: 's-real' }));
      const service = new JudgmentService();
      await expect(service.getJudgmentByCaseId('case-1', undefined, 's-fake')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('quick 模式 session 過期應 SESSION_EXPIRED', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      sessionServiceMock.getSession.mockResolvedValueOnce(null);
      const service = new JudgmentService();
      await expect(
        service.getJudgmentByCaseId('case-1', undefined, baseCase().session_id as string)
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });

    it('collaborative 模式應允許以 sessionId 讀取判決', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'collaborative', session_id: 's-collab', plaintiff_id: null, defendant_id: null })
      );
      sessionServiceMock.getSession.mockResolvedValueOnce({ id: 's-collab' });
      prismaMock.judgment.findUnique.mockResolvedValueOnce({
        id: 'j-collab',
        case_id: 'case-1',
        plaintiff_ratio: 55,
        defendant_ratio: 45,
        reconciliation_plans: [],
      });
      const service = new JudgmentService();

      const judgment = await service.getJudgmentByCaseId('case-1', undefined, 's-collab');

      expect(sessionServiceMock.getSession).toHaveBeenCalledWith('s-collab');
      expect(judgment).toMatchObject({ id: 'j-collab', case_id: 'case-1' });
    });

    it('collaborative 模式 session 不匹配時應拒絕讀取判決', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'collaborative', session_id: 's-collab', plaintiff_id: null, defendant_id: null })
      );
      const service = new JudgmentService();

      await expect(service.getJudgmentByCaseId('case-1', undefined, 's-wrong')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('collaborative full-mode（無 session_id）應允許當事人以 userId 讀取判決', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'collaborative', session_id: null, plaintiff_id: 'u1', defendant_id: 'u2' })
      );
      prismaMock.judgment.findUnique.mockResolvedValueOnce({
        id: 'j-collab-full',
        case_id: 'case-1',
        plaintiff_ratio: 52,
        defendant_ratio: 48,
        reconciliation_plans: [],
      });
      const service = new JudgmentService();

      const judgment = await service.getJudgmentByCaseId('case-1', 'u1');

      expect(sessionServiceMock.getSession).not.toHaveBeenCalled();
      expect(judgment).toMatchObject({ id: 'j-collab-full', case_id: 'case-1' });
    });

    it('collaborative full-mode（無 session_id）非當事人應 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'collaborative', session_id: null, plaintiff_id: 'u1', defendant_id: 'u2' })
      );
      const service = new JudgmentService();

      await expect(service.getJudgmentByCaseId('case-1', 'u3')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('remote 模式無 userId 應 UNAUTHORIZED', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'remote', plaintiff_id: 'u1', defendant_id: 'u2', session_id: null })
      );
      const service = new JudgmentService();
      await expect(service.getJudgmentByCaseId('case-1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('remote 模式非當事人應 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(
        baseCase({ mode: 'remote', plaintiff_id: 'u1', defendant_id: 'u2', session_id: null })
      );
      const service = new JudgmentService();
      await expect(service.getJudgmentByCaseId('case-1', 'u3')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('判決不存在應返回 null', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      sessionServiceMock.getSession.mockResolvedValueOnce({ id: baseCase().session_id });
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      const service = new JudgmentService();
      await expect(
        service.getJudgmentByCaseId('case-1', undefined, baseCase().session_id as string)
      ).resolves.toBeNull();
    });

    it('判決存在應返回 normalize 後結果', async () => {
      prismaMock.case.findUnique.mockResolvedValueOnce(baseCase());
      sessionServiceMock.getSession.mockResolvedValueOnce({ id: baseCase().session_id });
      prismaMock.judgment.findUnique.mockResolvedValueOnce({
        id: 'j1',
        case_id: 'case-1',
        plaintiff_ratio: 60,
        defendant_ratio: 40,
        reconciliation_plans: [],
      });
      const service = new JudgmentService();
      const judgment = await service.getJudgmentByCaseId('case-1', undefined, baseCase().session_id as string);
      expect(judgment).toMatchObject({ id: 'j1', case_id: 'case-1' });
    });
  });

  describe('acceptJudgment', () => {
    it('判決不存在應 NOT_FOUND', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce(null);
      const service = new JudgmentService();
      await expect(service.acceptJudgment('j-x', 'u1', true)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('非案件當事人應 FORBIDDEN', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce({
        id: 'j1',
        case: { plaintiff_id: 'u1', defendant_id: 'u2' },
      });
      const service = new JudgmentService();
      await expect(service.acceptJudgment('j1', 'u3', true)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('原告接受時應寫入 user1_acceptance/user1_rating', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce({
        id: 'j1',
        case: { plaintiff_id: 'u1', defendant_id: 'u2' },
      });
      prismaMock.judgment.update.mockResolvedValueOnce({ id: 'j1', user1_acceptance: true, user1_rating: 5 });
      const service = new JudgmentService();
      const result = await service.acceptJudgment('j1', 'u1', true, 5);
      expect(prismaMock.judgment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'j1' },
          data: { user1_acceptance: true, user1_rating: 5 },
        })
      );
      expect(result.id).toBe('j1');
    });

    it('被告拒絕時應寫入 user2_acceptance/user2_rating', async () => {
      prismaMock.judgment.findUnique.mockResolvedValueOnce({
        id: 'j2',
        case: { plaintiff_id: 'u1', defendant_id: 'u2' },
      });
      prismaMock.judgment.update.mockResolvedValueOnce({ id: 'j2', user2_acceptance: false, user2_rating: 2 });
      const service = new JudgmentService();
      await service.acceptJudgment('j2', 'u2', false, 2);
      expect(prismaMock.judgment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'j2' },
          data: { user2_acceptance: false, user2_rating: 2 },
        })
      );
    });
  });
});
