/**
 * InterviewService 單元測試 — respond 邊界、key_facts 解析、endSession、retryFailed、startSession 狀態轉移
 */
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const originalOpenAIApiKey = process.env.OPENAI_API_KEY;
const originalAiMock = process.env.AI_MOCK;

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'sk-test-provider-path';
  delete process.env.AI_MOCK;
});

afterEach(() => {
  if (originalOpenAIApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAIApiKey;
  }

  if (originalAiMock === undefined) {
    delete process.env.AI_MOCK;
  } else {
    process.env.AI_MOCK = originalAiMock;
  }
});

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    interviewTurn: { create: jest.fn(), update: jest.fn() },
    profileInsight: { findMany: jest.fn() },
    profileNarrative: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    INTERVIEW_MAX_TURNS: 30,
    INTERVIEW_SOFT_TARGET: 10,
    INTERVIEW_TURN_INTERVAL_MS: 0,
  },
}));
jest.mock('../../../src/config/openai', () => ({
  __esModule: true,
  openai: { chat: { completions: { create: jest.fn() } } },
  INTERVIEW_AI_CONFIG: { model: 'gpt-4o-mini', maxTokens: 800, temperature: 0.85, topP: 0.95 },
}));
jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: { withLock: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()) },
}));
jest.mock('../../../src/utils/retry', () => ({
  __esModule: true,
  retryWithBackoff: jest.fn((fn: () => Promise<unknown>) => fn()),
}));
jest.mock('../../../src/services/async-pipeline.service', () => ({
  __esModule: true,
  asyncPipelineService: {
    runPipeline: jest.fn(),
    process: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../../src/services/system-config.service', () => ({
  __esModule: true,
  systemConfigService: { getNumberConfig: jest.fn() },
}));
jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    createStream: jest.fn(() => ({
      streamId: 'stream-interview-1',
      requestId: 'request-interview-1',
      scopeType: 'interview_session',
      scopeId: 's1',
    })),
    start: jest.fn(),
    delta: jest.fn(),
    phase: jest.fn(),
    completed: jest.fn(),
    persisted: jest.fn(),
    failed: jest.fn(),
    cancelled: jest.fn(),
  },
}));

import { InterviewService } from '../../../src/services/interview.service';
import prisma from '../../../src/config/database';
import { systemConfigService } from '../../../src/services/system-config.service';
import { openai } from '../../../src/config/openai';
import { aiStreamService } from '../../../src/services/ai-stream.service';

const service = new InterviewService();

describe('InterviewService — key_facts 解析邏輯', () => {
  it('應從合法 metadata 中提取 key_facts 陣列', () => {
    const parsedMeta: Record<string, unknown> = {
      intent: 'exploring',
      target_domains: ['personality'],
      should_end: false,
      safety_flag: false,
      safety_message: '',
      key_facts: ['用戶來自澳門', 'MBTI 為 ENTP'],
    };
    const keyFacts = parsedMeta.key_facts;
    const newFacts = Array.isArray(keyFacts)
      ? (keyFacts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual(['用戶來自澳門', 'MBTI 為 ENTP']);
  });

  it('key_facts 為空陣列時結果也為空', () => {
    const parsedMeta = { key_facts: [] };
    const newFacts = Array.isArray(parsedMeta.key_facts)
      ? (parsedMeta.key_facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual([]);
  });

  it('key_facts 缺失時結果為空', () => {
    const parsedMeta: Record<string, unknown> = { intent: 'opening' };
    const newFacts = Array.isArray(parsedMeta.key_facts)
      ? (parsedMeta.key_facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual([]);
  });

  it('key_facts 含無效值時應過濾掉', () => {
    const parsedMeta = { key_facts: ['有效事實', '', null, 123, '   ', '另一個事實'] };
    const newFacts = Array.isArray(parsedMeta.key_facts)
      ? (parsedMeta.key_facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual(['有效事實', '另一個事實']);
  });

  it('collectedFacts 應累積合併新舊事實', () => {
    const existingFacts = ['用戶來自澳門'];
    const newFacts = ['MBTI 為 ENTP', '對星座有興趣'];
    const updated = [...existingFacts, ...newFacts];
    expect(updated).toEqual(['用戶來自澳門', 'MBTI 為 ENTP', '對星座有興趣']);
  });
});

describe('InterviewService — startSession CONSENT_REQUIRED', () => {
  const mockedPrisma = prisma as any;

  it('psych_consent_given 為 false 時應拋出 CONSENT_REQUIRED', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ psych_consent_given: false });
    await expect(service.startSession('u1', 'organic')).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
    });
  });

  it('已知 user.age 小於 18 時應拒絕開始心理訪談', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ psych_consent_given: true, age: 17 });
    await expect(service.startSession('u1', 'organic')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringContaining('未成年人'),
    });
    expect(mockedPrisma.interviewSession.findMany).not.toHaveBeenCalled();
  });
});

describe('InterviewService — runtime config 行為', () => {
  const mockedPrisma = prisma as any;
  const mockedSystemConfig = systemConfigService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => args[1]);
  });

  it('startSession 應使用 runtime dailySessionLimit 阻擋超額啟動', async () => {
    (mockedPrisma.user.findUnique as any).mockResolvedValue({ psych_consent_given: true });
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => {
      const [key, fallback] = args;
      if (key === 'interview.dailySessionLimit') return 1;
      return fallback;
    });
    (mockedPrisma.interviewSession.findMany as any).mockResolvedValue([
      { created_at: new Date().toISOString(), _count: { turns: 3 } },
    ]);

    await expect(service.startSession('u1', 'organic')).rejects.toThrow('今日開始訪談次數已達上限');
  });

  it('respond 應使用 runtime maxTurns 阻擋超輪次並拋出 MAX_TURNS_REACHED', async () => {
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => {
      const [key, fallback] = args;
      if (key === 'interview.maxTurns') return 2;
      return fallback;
    });
    (mockedPrisma.interviewSession.findUnique as any).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [{ id: 't1', created_at: new Date(Date.now() - 1000 * 60) }, { id: 't2', created_at: new Date() }],
    });

    await expect(service.respond('s1', 'u1', 'hello')).rejects.toMatchObject({ code: 'MAX_TURNS_REACHED' });
  });

  it('respond 應使用 runtime turnIntervalMs 阻擋過快輸入並拋出 TURN_TOO_FAST', async () => {
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => {
      const [key, fallback] = args;
      if (key === 'interview.maxTurns') return 10;
      if (key === 'interview.turnIntervalMs') return 120000;
      return fallback;
    });
    (mockedPrisma.interviewSession.findUnique as any).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [{ id: 't1', created_at: new Date() }],
    });

    await expect(service.respond('s1', 'u1', 'hello')).rejects.toMatchObject({ code: 'TURN_TOO_FAST' });
  });
});

describe('InterviewService — respond 邊界與異常', () => {
  const mockedPrisma = prisma as any;
  const mockedSystemConfig = systemConfigService as any;
  const mockedOpenAI = openai as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => args[1]);
    mockedPrisma.profileInsight.findMany.mockResolvedValue([]);
    mockedPrisma.profileNarrative.findMany.mockResolvedValue([]);
  });

  function mockRespondSession(overrides: Record<string, unknown> = {}) {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      domains_touched: [],
      collected_facts: [],
      turns: [
        {
          id: 't1',
          ai_message: '最近過得如何？',
          user_response: null,
          ai_intent: 'opening',
          extracted_facts: [],
          created_at: new Date(Date.now() - 60_000),
        },
      ],
      ...overrides,
    });
  }

  function mockOpenAIStreamContent(content: string) {
    mockedOpenAI.chat.completions.create.mockResolvedValue((async function* () {
      yield {
        choices: [
          {
            delta: { content },
          },
        ],
      };
    })());
  }

  it('session 不存在時應拋出 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue(null);
    await expect(service.respond('s1', 'u1', 'hello')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('session 屬於其他用戶時應拋出 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'other-user',
      status: 'in_progress',
      turns: [{ id: 't1', created_at: new Date(Date.now() - 10000) }],
    });
    await expect(service.respond('s1', 'u1', 'hello')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('session 非 IN_PROGRESS 時應拋出 SESSION_COMPLETED', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'completed',
      turns: [{ id: 't1', created_at: new Date(Date.now() - 10000) }],
    });
    await expect(service.respond('s1', 'u1', 'hello')).rejects.toMatchObject({ code: 'SESSION_COMPLETED' });
  });

  it('成功回覆時應同步發送 AI Stream delta/completed/persisted', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      domains_touched: [],
      collected_facts: [],
      turns: [
        {
          id: 't1',
          ai_message: '最近過得如何？',
          user_response: null,
          ai_intent: 'opening',
          extracted_facts: [],
          created_at: new Date(Date.now() - 60_000),
        },
      ],
    });
    mockedPrisma.interviewTurn.update.mockResolvedValue({});
    mockedPrisma.interviewTurn.create.mockResolvedValue({ id: 'turn-ai-2' });
    mockedPrisma.interviewSession.update.mockResolvedValue({});
    mockedOpenAI.chat.completions.create.mockResolvedValue((async function* () {
      yield {
        choices: [
          {
            delta: {
              content: '謝謝你願意說這些。---METADATA---{"intent":"deepening","target_domains":["personality"],"should_end":false,"safety_flag":false,"safety_message":"","key_facts":["用戶來自澳門"]}',
            },
          },
        ],
      };
    })());

    const sseEvents: string[] = [];
    await service.respond('s1', 'u1', '我最近壓力很大', (event) => {
      if ('text' in event) sseEvents.push(`token:${event.text}`);
      if ('turn_order' in event) sseEvents.push(`metadata:${event.turn_order}`);
      if ('session_id' in event) sseEvents.push(`complete:${event.session_id}`);
    });

    expect(aiStreamService.createStream).toHaveBeenCalledWith('interview_session', 's1');
    expect(aiStreamService.start).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      expect.objectContaining({ actorRole: 'aiMediator', phase: 'thinking' })
    );
    expect(aiStreamService.delta).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      '謝謝你願意說這些。',
      expect.objectContaining({ actorRole: 'aiMediator' })
    );
    expect(aiStreamService.completed).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      expect.objectContaining({ fullText: '謝謝你願意說這些。', phase: 'completed' })
    );
    expect(aiStreamService.persisted).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      expect.objectContaining({ messageId: 'turn-ai-2', fullText: '謝謝你願意說這些。' })
    );
    expect(sseEvents).toContain('complete:s1');
  });

  it('safety_flag 與 safety_message 存在時應發送 SSE safety alert 並同步 stream phase', async () => {
    mockRespondSession();
    mockedPrisma.interviewTurn.update.mockResolvedValue({});
    mockedPrisma.interviewTurn.create.mockResolvedValue({ id: 'turn-ai-2' });
    mockedPrisma.interviewSession.update.mockResolvedValue({});
    mockOpenAIStreamContent(
      '我會先停下來陪你看這個部分。---METADATA---{"intent":"safety_support","target_domains":["life_events"],"should_end":false,"safety_flag":true,"safety_message":"觀察到自傷風險語句","key_facts":["用戶提到不想活"]}'
    );

    const safetyEvents: string[] = [];
    await service.respond('s1', 'u1', '我不想活了', (event) => {
      if ('message' in event) safetyEvents.push(event.message);
    }, false, { locale: 'en-US' });

    expect(safetyEvents).toEqual([
      'We detected a possible safety risk and switched to a safety-first response.',
    ]);
    expect(mockedPrisma.interviewTurn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        safety_flag: true,
        safety_detail: '觀察到自傷風險語句',
      }),
    });
    expect(aiStreamService.phase).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      'safety_alert',
      expect.objectContaining({
        actorRole: 'aiMediator',
        metadata: {
          message: 'We detected a possible safety risk and switched to a safety-first response.',
          severity: 'warning',
        },
      })
    );
    expect(aiStreamService.persisted).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      expect.objectContaining({ messageId: 'turn-ai-2' })
    );
  });

  it('OpenAI 呼叫失敗且 stream 已建立時應標記 stream.failed 並拋回原錯誤', async () => {
    mockRespondSession();
    mockedPrisma.interviewTurn.update.mockResolvedValue({});
    const providerError = Object.assign(new Error('provider down'), { code: 'AI_PROVIDER_DOWN' });
    mockedOpenAI.chat.completions.create.mockRejectedValue(providerError);

    await expect(service.respond('s1', 'u1', 'hello')).rejects.toThrow('provider down');

    expect(aiStreamService.createStream).toHaveBeenCalledWith('interview_session', 's1');
    expect(aiStreamService.start).toHaveBeenCalled();
    expect(aiStreamService.failed).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      { code: 'AI_PROVIDER_DOWN', message: '服務內部錯誤' },
      expect.objectContaining({
        actorRole: 'aiMediator',
        fullText: undefined,
        metadata: { mode: 'respond' },
      })
    );
    expect(aiStreamService.completed).not.toHaveBeenCalled();
    expect(aiStreamService.persisted).not.toHaveBeenCalled();
  });

  it('AI 文字已完成但落庫失敗時應帶 latestText 標記 stream.failed', async () => {
    mockRespondSession();
    mockedPrisma.interviewTurn.update.mockResolvedValue({});
    const writeError = Object.assign(new Error('db write failed'), { code: 'DB_WRITE_FAILED' });
    mockedPrisma.interviewTurn.create.mockRejectedValue(writeError);
    mockedPrisma.interviewSession.update.mockResolvedValue({});
    mockOpenAIStreamContent(
      '謝謝你願意說這些。---METADATA---{"intent":"deepening","target_domains":["personality"],"should_end":false,"safety_flag":false,"safety_message":"","key_facts":[]}'
    );

    await expect(service.respond('s1', 'u1', '我最近壓力很大')).rejects.toThrow('db write failed');

    expect(aiStreamService.completed).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      expect.objectContaining({ fullText: '謝謝你願意說這些。', phase: 'completed' })
    );
    expect(aiStreamService.failed).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      { code: 'DB_WRITE_FAILED', message: '服務內部錯誤' },
      expect.objectContaining({
        actorRole: 'aiMediator',
        fullText: '謝謝你願意說這些。',
        metadata: { mode: 'respond' },
      })
    );
    expect(aiStreamService.persisted).not.toHaveBeenCalled();
  });

  it('signal 中止時應發送 stream.cancelled 並不拋錯', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      domains_touched: [],
      collected_facts: [],
      turns: [
        {
          id: 't1',
          ai_message: '最近過得如何？',
          user_response: null,
          ai_intent: 'opening',
          extracted_facts: [],
          created_at: new Date(Date.now() - 60_000),
        },
      ],
    });
    mockedPrisma.interviewTurn.update.mockResolvedValue({});

    const controller = new AbortController();
    controller.abort();

    await expect(
      service.respond('s1', 'u1', '我想跳過', undefined, false, { signal: controller.signal })
    ).resolves.toBeUndefined();

    expect(aiStreamService.createStream).toHaveBeenCalledWith('interview_session', 's1');
    expect(aiStreamService.start).toHaveBeenCalled();
    expect(aiStreamService.cancelled).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-interview-1' }),
      expect.objectContaining({
        actorRole: 'aiMediator',
        metadata: expect.objectContaining({ reason: 'client_abort', mode: 'respond' }),
      })
    );
    expect(aiStreamService.failed).not.toHaveBeenCalled();
  });

  it('submitResponse 應啟動背景 respond 任務', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [{ id: 't1', created_at: new Date(Date.now() - 60_000) }],
    });
    const respondSpy = jest.spyOn(service, 'respond').mockResolvedValue(undefined);

    await service.submitResponse('s1', 'u1', 'hello', 'en-US');
    await Promise.resolve();

    expect(respondSpy).toHaveBeenCalledWith('s1', 'u1', 'hello', undefined, false, expect.objectContaining({
      locale: 'en-US',
      signal: expect.any(Object),
    }));
    respondSpy.mockRestore();
  });

  it('submitResponse 遇到 TURN_TOO_FAST 時應同步拋錯，避免前端進入無限 thinking', async () => {
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => {
      const [key, fallback] = args;
      if (key === 'interview.turnIntervalMs') return 120000;
      return fallback;
    });
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [{ id: 't1', created_at: new Date() }],
    });
    const respondSpy = jest.spyOn(service, 'respond').mockResolvedValue(undefined);

    await expect(service.submitResponse('s1', 'u1', 'hello')).rejects.toMatchObject({ code: 'TURN_TOO_FAST' });
    expect(respondSpy).not.toHaveBeenCalled();

    respondSpy.mockRestore();
  });

  it('cancelActiveStream 在有進行中任務時應返回 true', async () => {
    const respondSpy = jest.spyOn(service, 'respond').mockImplementation(async (_s, _u, _m, _onSSE, _isSkip, options) => {
      await new Promise<void>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      });
    });
    mockedPrisma.interviewSession.findFirst.mockResolvedValue({ id: 's1', user_id: 'u1' });

    await service.submitResponse('s1', 'u1', 'hello');
    await Promise.resolve();
    await expect(service.cancelActiveStream('s1', 'u1')).resolves.toBe(true);

    respondSpy.mockRestore();
  });
});

describe('InterviewService — endSession 狀態轉移', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('session 不存在時應拋出 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue(null);
    await expect(service.endSession('s1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('session 屬於其他用戶時應拋出 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'other-user',
      status: 'in_progress',
      turns: [{ user_response: 'a'.repeat(60) }],
      _count: { turns: 5 },
    });
    await expect(service.endSession('s1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('session 非 IN_PROGRESS 時應拋出 SESSION_COMPLETED', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'completed',
      turns: [],
      _count: { turns: 5 },
    });
    await expect(service.endSession('s1', 'u1')).rejects.toMatchObject({ code: 'SESSION_COMPLETED' });
  });

  it('內容不足（turns < 5）時應更新為 COMPLETED 且不觸發 pipeline', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [
        { user_response: 'a'.repeat(20) },
        { user_response: 'b'.repeat(20) },
      ],
      _count: { turns: 2 },
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await service.endSession('s1', 'u1');

    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ status: 'completed' }),
    });
    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.process).not.toHaveBeenCalled();
  });

  it('內容不足（總字數 < 50）時應更新為 COMPLETED 且不觸發 pipeline', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [
        { user_response: 'a' },
        { user_response: 'b' },
        { user_response: 'c' },
        { user_response: 'd' },
        { user_response: 'e' },
      ],
      _count: { turns: 5 },
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await service.endSession('s1', 'u1');

    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ status: 'completed' }),
    });
    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.process).not.toHaveBeenCalled();
  });

  it('內容足夠時應更新為 PROCESSING 且觸發 pipeline', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [
        { user_response: 'a'.repeat(20) },
        { user_response: 'b'.repeat(20) },
        { user_response: 'c'.repeat(20) },
        { user_response: 'd'.repeat(20) },
        { user_response: 'e'.repeat(20) },
      ],
      _count: { turns: 5 },
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await service.endSession('s1', 'u1');

    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ status: 'processing' }),
    });
    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.process).toHaveBeenCalledWith('s1', { locale: 'zh-TW' });
  });
});

describe('InterviewService — retryFailed', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('session 不存在時應拋出 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(null);
    await expect(service.retryFailed('s1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('session 屬於其他用戶時應拋出 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(null);
    await expect(service.retryFailed('s1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('session 非 PROCESSING_FAILED 時應拋出 VALIDATION_ERROR', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'completed',
      pipeline_step: 0,
    });
    await expect(service.retryFailed('s1', 'u1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('PROCESSING_FAILED 時應更新為 PROCESSING 且觸發 resume', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'processing_failed',
      pipeline_step: 2,
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await service.retryFailed('s1', 'u1');

    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'processing' },
    });
    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.resume).toHaveBeenCalledWith('s1', 3, { locale: 'zh-TW' });
  });
});

describe('InterviewService — startSession 每小時限額與舊 session 處理', () => {
  const mockedPrisma = prisma as any;
  const mockedSystemConfig = systemConfigService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => args[1]);
  });

  it('每小時 substantive session 達限時應拋出 RATE_LIMIT_EXCEEDED（每小時開始訪談次數已達上限）', async () => {
    (mockedPrisma.user.findUnique as any).mockResolvedValue({ psych_consent_given: true });
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => {
      const [key, fallback] = args;
      if (key === 'interview.dailySessionLimit') return 2;
      if (key === 'interview.startRateLimit') return 1;
      return fallback;
    });
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    (mockedPrisma.interviewSession.findMany as any).mockResolvedValue([
      { created_at: thirtyMinAgo.toISOString(), _count: { turns: 5 } },
    ]);
    (mockedPrisma.interviewSession.findFirst as any).mockResolvedValue(null);
    (mockedPrisma.profileInsight.findMany as any).mockResolvedValue([]);
    (mockedPrisma.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        interviewSession: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({ id: 's2', user_id: 'u1', status: 'in_progress' }),
          findUnique: jest.fn().mockResolvedValue({ id: 's2', user_id: 'u1', status: 'in_progress', turns: [] }),
        },
        interviewTurn: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await expect(service.startSession('u1', 'organic')).rejects.toThrow('每小時開始訪談次數已達上限');
  });

  it('有舊 IN_PROGRESS 且 turns >= 5 時應將舊 session 設為 PROCESSING 並建立新 session', async () => {
    (mockedPrisma.user.findUnique as any).mockResolvedValue({ psych_consent_given: true });
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => args[1]);
    (mockedPrisma.interviewSession.findMany as any).mockResolvedValue([]);
    (mockedPrisma.interviewSession.findFirst as any).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: Array(5).fill({ id: 't', created_at: new Date() }),
    });
    (mockedPrisma.profileInsight.findMany as any).mockResolvedValue([]);
    const newSession = { id: 's2', user_id: 'u1', status: 'in_progress', turns: [{ turn_order: 1 }] };
    (mockedPrisma.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        interviewSession: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue(newSession),
          findUnique: jest.fn().mockResolvedValue({ ...newSession, turns: [{ turn_order: 1 }] }),
        },
        interviewTurn: { create: jest.fn().mockResolvedValue({}) },
      };
      const result = await fn(tx);
      expect(tx.interviewSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'processing' },
      });
      return result;
    });

    const result = await service.startSession('u1', 'organic');
    expect(result).toBeDefined();
    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.process).toHaveBeenCalledWith('s1', { locale: 'zh-TW' });
  });

  it('有舊 IN_PROGRESS 且 turns < 5 時應將舊 session 設為 ABANDONED', async () => {
    (mockedPrisma.user.findUnique as any).mockResolvedValue({ psych_consent_given: true });
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => args[1]);
    (mockedPrisma.interviewSession.findMany as any).mockResolvedValue([]);
    (mockedPrisma.interviewSession.findFirst as any).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: [{ id: 't1' }],
    });
    (mockedPrisma.profileInsight.findMany as any).mockResolvedValue([]);
    const newSession = { id: 's2', user_id: 'u1', status: 'in_progress', turns: [{ turn_order: 1 }] };
    (mockedPrisma.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        interviewSession: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue(newSession),
          findUnique: jest.fn().mockResolvedValue({ ...newSession, turns: [{ turn_order: 1 }] }),
        },
        interviewTurn: { create: jest.fn().mockResolvedValue({}) },
      };
      const result = await fn(tx);
      expect(tx.interviewSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'abandoned' },
      });
      return result;
    });

    const result = await service.startSession('u1', 'organic');
    expect(result).toBeDefined();
    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.process).not.toHaveBeenCalled();
  });

  it('舊 session 需要 pipeline 但建立新 session transaction 失敗時不應觸發 pipeline', async () => {
    (mockedPrisma.user.findUnique as any).mockResolvedValue({ psych_consent_given: true });
    (mockedSystemConfig.getNumberConfig as jest.Mock).mockImplementation(async (...args: any[]) => args[1]);
    (mockedPrisma.interviewSession.findMany as any).mockResolvedValue([]);
    (mockedPrisma.interviewSession.findFirst as any).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      turns: Array(5).fill({ id: 't', created_at: new Date() }),
    });
    (mockedPrisma.profileInsight.findMany as any).mockResolvedValue([]);
    const transactionError = new Error('transaction failed');
    (mockedPrisma.$transaction as any).mockRejectedValue(transactionError);

    await expect(service.startSession('u1', 'organic')).rejects.toBe(transactionError);

    const { asyncPipelineService } = require('../../../src/services/async-pipeline.service');
    expect(asyncPipelineService.process).not.toHaveBeenCalled();
  });
});
