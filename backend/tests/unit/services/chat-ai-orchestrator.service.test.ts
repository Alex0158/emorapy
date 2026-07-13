/**
 * ChatAIOrchestrator 單元測試 — detectValidationSeeking 情境偵測、prompt 選擇
 */

const generateTextStreamMock = jest.fn();
const resolveSharedMediationMock = jest.fn();

jest.mock('../../../src/config/database', () => {
  const mock = {
    chatParticipant: { findFirst: jest.fn(), count: jest.fn() },
    chatChannel: { findFirst: jest.fn() },
    chatMessage: { findMany: jest.fn(), create: jest.fn() },
  };
  return { __esModule: true, default: mock };
});

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: { generateTextStream: generateTextStreamMock },
}));

jest.mock('../../../src/services/chat-context-policy.service', () => ({
  __esModule: true,
  chatContextPolicyService: {
    resolveSharedMediation: resolveSharedMediationMock,
  },
}));

jest.mock('../../../src/services/safety-routing.service', () => ({
  __esModule: true,
  safetyRoutingService: {
    decideRoute: jest.fn(() => ({ route: 'standard', detectedFlags: [] })),
  },
}));

const lockState = { resolve: null as (() => void) | null };
jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: {
    withLock: jest.fn(async (_key: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } finally {
        lockState.resolve?.();
      }
    }),
  },
}));

jest.mock('../../../src/services/chat-events.service', () => ({
  __esModule: true,
  chatEventsService: { publish: jest.fn() },
}));

jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    createStream: jest.fn(() => ({ streamId: 'stream-1', requestId: 'request-1', scopeType: 'chat_room', scopeId: 'room-1' })),
    start: jest.fn(),
    delta: jest.fn(),
    completed: jest.fn(),
    persisted: jest.fn(),
    failed: jest.fn(),
  },
}));

jest.mock('../../../src/services/chat-metrics.service', () => ({
  __esModule: true,
  chatMetricsService: { recordAiTrigger: jest.fn(), recordSafetyHit: jest.fn() },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { chatAIOrchestrator, detectValidationSeeking } from '../../../src/services/chat-ai-orchestrator.service';
import { chatEventsService } from '../../../src/services/chat-events.service';
import { aiStreamService } from '../../../src/services/ai-stream.service';
import { chatMetricsService } from '../../../src/services/chat-metrics.service';

describe('detectValidationSeeking', () => {
  describe('應觸發（validation-seeking）', () => {
    it.each([
      ['你說我有問題嗎'],
      ['你說我有沒有問題？'],
      ['你覺得我有問題嗎'],
      ['你也覺得沒有問題吧'],
      ['你也覺得和另一個男的親嘴沒有問題吧'],
      ['我愛和誰親嘴搞關係有什麼問題'],
      ['親嘴有什麼問題'],
      ['出軌有什麼問題'],
      ['那咋了，我愛和誰親嘴搞關係'],
      ['親嘴那又怎樣'],
    ])('「%s」應回 true', (input) => {
      expect(detectValidationSeeking(input)).toBe(true);
    });
  });

  describe('不應觸發（一般支持情境）', () => {
    it.each([
      ['我們應該好好溝通，對吧？'],
      ['你覺得我們該怎麼辦，你說呢？'],
      ['他遲到了那又怎樣，我還是很生氣'],
      ['我想約他出來談談，有什麼問題？'],
      ['他都不回我訊息，我好難過'],
      ['我今天和男朋友吵架了'],
      [''],
      ['   '],
    ])('「%s」應回 false', (input) => {
      expect(detectValidationSeeking(input)).toBe(false);
    });
  });
});

describe('ChatAIOrchestrator prompt 選擇', () => {
  const prisma = require('../../../src/config/database').default;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.chatParticipant.findFirst.mockImplementation(async (args: { where?: { role_in_room?: string } }) => (
      args?.where?.role_in_room === 'aiMediator' ? { id: 'ai-1' } : null
    ));
    prisma.chatChannel.findFirst.mockResolvedValue({ id: 'channel-shared-1' });
    resolveSharedMediationMock.mockResolvedValue({
      audience: 'room_participants',
      purpose: 'shared_mediation',
      policyVersion: 'chat-context-policy@v1',
      messages: [
        {
          id: 'context-message-1',
          content: 'A: 你說我有問題嗎',
          messageType: 'user_text',
          role: 'roleA',
          audience: 'room_participants',
          createdAt: new Date('2026-07-12T12:01:00.000Z'),
        },
      ],
      capsules: [],
      controls: null,
      sourceRefs: ['context-message-1'],
      authorizationRefs: [],
    });
    prisma.chatMessage.create.mockResolvedValue({ id: 'msg-1' });
    generateTextStreamMock.mockResolvedValue('AI 回應');
    (chatMetricsService.recordAiTrigger as jest.Mock).mockResolvedValue(undefined);
    (chatMetricsService.recordSafetyHit as jest.Mock).mockResolvedValue(undefined);
  });

  it('validation-seeking 訊息應傳入 SUPPORT_VALIDATION_SEEKING_PROMPT', async () => {
    const lockDone = new Promise<void>((r) => { lockState.resolve = r; });
    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-validation-seeking',
        roomStatus: 'solo_active',
        historyVisibilityMode: 'share_summary_only',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm1', content: '你說我有問題嗎', visibility_scope: 'all' }
    );
    await lockDone;

    expect(generateTextStreamMock).toHaveBeenCalledTimes(1);
    const [, options] = generateTextStreamMock.mock.calls[0];
    expect(options.systemPrompt).toContain('本輪情境：用戶似乎在尋求你對其爭議行為的認同或背書');
    expect(options.ledger).toMatchObject({
      productFlow: 'chat_first',
      sourceChannel: 'chat_room',
      entryPoint: 'chat_room_ai_response',
      requestKind: 'chat_room_ai_response',
      promptVersion: 'chat-room-ai-response@v1.0',
      scopeType: 'chat_room',
      scopeId: 'room-1',
    });
  });

  it('一般訊息應傳入 SUPPORT_SYSTEM_PROMPT（非 validation-seeking）', async () => {
    const lockDone = new Promise<void>((r) => { lockState.resolve = r; });
    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-general-support',
        roomStatus: 'solo_active',
        historyVisibilityMode: 'share_summary_only',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm1', content: '他都不回我訊息，我好難過', visibility_scope: 'all' }
    );
    await lockDone;

    expect(generateTextStreamMock).toHaveBeenCalledTimes(1);
    const [, options] = generateTextStreamMock.mock.calls[0];
    expect(options.systemPrompt).toContain('價值澄清（重要）');
    expect(options.systemPrompt).not.toContain('本輪情境：用戶似乎在尋求你對其爭議行為的認同或背書');
  });

  it('應以 AI Stream 發送草稿事件，聊天室事件流只在落庫後發 message', async () => {
    const lockDone = new Promise<void>((r) => { lockState.resolve = r; });
    prisma.chatParticipant.findFirst.mockImplementation(async (args: { where?: { role_in_room?: string } }) => (
      args?.where?.role_in_room === 'aiMediator'
        ? { id: 'ai-1' }
        : { joined_at: new Date('2026-07-12T12:00:00.000Z') }
    ));
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-1',
      sender_participant_id: 'ai-1',
      content: 'AI 回應',
      ai_strategy: 'mediation',
      message_type: 'ai_mediation',
      visibility_scope: 'all',
    });
    generateTextStreamMock.mockImplementation(async (_prompt: string, options: { onToken?: (token: string) => void }) => {
      options.onToken?.('AI ');
      options.onToken?.('回應');
      return 'AI 回應';
    });

    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-1',
        roomStatus: 'group_active',
        historyVisibilityMode: 'share_summary_only',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm1', content: '請幫我協調', visibility_scope: 'all' }
    );
    await lockDone;

    expect(aiStreamService.start).toHaveBeenCalled();
    expect(aiStreamService.delta).toHaveBeenCalledTimes(2);
    expect(aiStreamService.completed).toHaveBeenCalled();
    expect(aiStreamService.persisted).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-1', requestId: 'request-1' }),
      expect.objectContaining({ messageId: 'msg-1', fullText: 'AI 回應' })
    );

    expect(chatEventsService.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'message',
      roomId: 'room-1',
      payload: expect.objectContaining({ streamId: 'stream-1', requestId: 'request-1', messageId: 'msg-1' }),
    }));
    expect(chatEventsService.publish).toHaveBeenCalledTimes(1);
  });

  it('AI 產生失敗時 stream payload 應跟隨 locale 且不外露原始錯誤', async () => {
    const lockDone = new Promise<void>((r) => { lockState.resolve = r; });
    generateTextStreamMock.mockRejectedValueOnce(new Error('provider down'));

    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-stream-failed',
        roomStatus: 'solo_active',
        historyVisibilityMode: 'share_summary_only',
        locale: 'en-US',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm1', content: '他都不回我訊息，我好難過', visibility_scope: 'all' }
    );
    await lockDone;

    expect(aiStreamService.failed).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-1', requestId: 'request-1' }),
      expect.objectContaining({
        code: 'CHAT_AI_STREAM_FAILED',
        message: 'AI reply failed. Please try again later.',
        retryable: true,
      }),
      expect.objectContaining({ actorRole: 'aiMediator', phase: 'thinking' })
    );
    expect((aiStreamService.failed as jest.Mock).mock.calls[0][1].message).not.toBe('provider down');
  });

  it('room-wide AI prompt 只通過 typed shared mediation resolver 取得 context', async () => {
    const joinedAt = new Date('2026-07-12T12:00:00.000Z');
    prisma.chatParticipant.findFirst.mockImplementation(async (args: { where?: { role_in_room?: string } }) => (
      args?.where?.role_in_room === 'aiMediator'
        ? { id: 'ai-1' }
        : { joined_at: joinedAt }
    ));
    const lockDone = new Promise<void>((resolve) => { lockState.resolve = resolve; });

    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-shared-context',
        roomStatus: 'group_active',
        historyVisibilityMode: 'share_from_join_time',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm-public', content: '共同內容', visibility_scope: 'all' },
    );
    await lockDone;

    expect(resolveSharedMediationMock).toHaveBeenCalledWith({
      roomId: 'room-shared-context',
      maxMessages: 30,
    });
    expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it('private message 不會讀 context、建立 stream 或產生 room-wide AI reply', async () => {
    await chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-private',
        roomStatus: 'group_active',
        historyVisibilityMode: 'share_full_history',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm-private', content: 'private canary', visibility_scope: 'owner_only' },
    );

    expect(resolveSharedMediationMock).not.toHaveBeenCalled();
    expect(aiStreamService.createStream).not.toHaveBeenCalled();
    expect(generateTextStreamMock).not.toHaveBeenCalled();
  });

  it('malicious echo provider 也收不到 private canary', async () => {
    resolveSharedMediationMock.mockResolvedValueOnce({
      audience: 'room_participants',
      purpose: 'shared_mediation',
      policyVersion: 'chat-context-policy@v1',
      messages: [
        {
          id: 'm-shared',
          content: '共同內容',
          messageType: 'user_text',
          role: 'roleA',
          audience: 'room_participants',
          createdAt: new Date('2026-07-12T12:01:00.000Z'),
        },
      ],
      capsules: [],
      controls: null,
      sourceRefs: ['m-shared'],
      authorizationRefs: [],
    });
    generateTextStreamMock.mockImplementationOnce(async (prompt: string) => prompt);
    const lockDone = new Promise<void>((resolve) => { lockState.resolve = resolve; });

    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-malicious-echo',
        roomStatus: 'solo_active',
        historyVisibilityMode: 'share_full_history',
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm-shared', content: '共同內容', visibility_scope: 'all' },
    );
    await lockDone;

    const prompt = generateTextStreamMock.mock.calls[0][0] as string;
    expect(prompt).toContain('共同內容');
    expect(prompt).not.toContain('PRIVATE_CANARY_DO_NOT_ECHO');
  });
});
