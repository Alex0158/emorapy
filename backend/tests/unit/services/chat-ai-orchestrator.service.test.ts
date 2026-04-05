/**
 * ChatAIOrchestrator 單元測試 — detectValidationSeeking 情境偵測、prompt 選擇
 */

const generateTextStreamMock = jest.fn();

jest.mock('../../../src/config/database', () => {
  const mock = {
    chatParticipant: { findFirst: jest.fn(), count: jest.fn() },
    chatMessage: { findMany: jest.fn(), create: jest.fn() },
  };
  return { __esModule: true, default: mock };
});

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: { generateTextStream: generateTextStreamMock },
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
    prisma.chatParticipant.findFirst.mockResolvedValue({ id: 'ai-1' });
    prisma.chatParticipant.count.mockResolvedValue(0); // 無 roleB → 單方 support
    prisma.chatMessage.findMany.mockResolvedValue([
      { content: 'A: 你說我有問題嗎', sender_participant: { role_in_room: 'roleA' }, message_type: 'user_text' },
    ]);
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
      },
      { id: 'p-a', role_in_room: 'roleA', is_active: true } as any,
      { id: 'm1', content: '你說我有問題嗎', visibility_scope: 'all' }
    );
    await lockDone;

    expect(generateTextStreamMock).toHaveBeenCalledTimes(1);
    const [, options] = generateTextStreamMock.mock.calls[0];
    expect(options.systemPrompt).toContain('本輪情境：用戶似乎在尋求你對其爭議行為的認同或背書');
  });

  it('一般訊息應傳入 SUPPORT_SYSTEM_PROMPT（非 validation-seeking）', async () => {
    const lockDone = new Promise<void>((r) => { lockState.resolve = r; });
    chatAIOrchestrator.onUserMessage(
      {
        roomId: 'room-general-support',
        roomStatus: 'solo_active',
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
    prisma.chatParticipant.count.mockResolvedValue(1);
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
});
