const prismaMock = {
  chatParticipant: { findFirst: jest.fn() },
  chatMessage: { findMany: jest.fn(), create: jest.fn() },
};
const generateTextStreamMock = jest.fn();
const resolvePrivateSupportMock = jest.fn();
const activateSafetyRouteMock = jest.fn();
const decideRouteMock = jest.fn();
const withLockMock = jest.fn();
const createStreamMock = jest.fn();
const startStreamMock = jest.fn();
const deltaStreamMock = jest.fn();
const completeStreamMock = jest.fn();
const persistStreamMock = jest.fn();
const failStreamMock = jest.fn();
const publishToChannelMock = jest.fn();
const publishToRoomMock = jest.fn();
const recordAiTriggerMock = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: { generateTextStream: generateTextStreamMock },
}));

jest.mock('../../../src/services/chat-context-policy.service', () => ({
  __esModule: true,
  chatContextPolicyService: { resolvePrivateSupport: resolvePrivateSupportMock },
}));

jest.mock('../../../src/services/chat-safety-router.service', () => ({
  __esModule: true,
  chatSafetyRouterService: { activateForRoute: activateSafetyRouteMock },
}));

jest.mock('../../../src/services/safety-routing.service', () => ({
  __esModule: true,
  safetyRoutingService: { decideRoute: decideRouteMock },
}));

jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: { withLock: withLockMock },
}));

jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    createStream: createStreamMock,
    start: startStreamMock,
    delta: deltaStreamMock,
    completed: completeStreamMock,
    persisted: persistStreamMock,
    failed: failStreamMock,
  },
}));

jest.mock('../../../src/services/chat-events.service', () => ({
  __esModule: true,
  chatEventsService: {
    publishToChannel: publishToChannelMock,
    publish: publishToRoomMock,
  },
}));

jest.mock('../../../src/services/chat-metrics.service', () => ({
  __esModule: true,
  chatMetricsService: { recordAiTrigger: recordAiTriggerMock },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { PrivateAnalystOrchestrator } from '../../../src/services/private-analyst-orchestrator.service';

const ROOM_ID = 'room-private-runtime';
const PRIVATE_CHANNEL_ID = 'channel-private-a';
const OWNER_PARTICIPANT_ID = 'participant-a';
const AI_PARTICIPANT_ID = 'participant-ai';
const OTHER_PRIVATE_CANARY = 'PRIVATE_B_CANARY_MUST_NEVER_REACH_PROVIDER';

function privateContext() {
  return {
    roomId: ROOM_ID,
    roomStatus: 'solo_active' as const,
    privateChannelId: PRIVATE_CHANNEL_ID,
    ownerParticipantId: OWNER_PARTICIPANT_ID,
    aiParticipant: { id: AI_PARTICIPANT_ID } as never,
    locale: 'en-US' as const,
  };
}

function ownerBundle(content = 'OWNER_A_PRIVATE_CONTEXT') {
  return {
    audience: 'private_owner',
    purpose: 'private_support',
    policyVersion: 'chat-context-policy@v1',
    messages: [
      {
        id: 'owner-message-1',
        content,
        messageType: 'user_text',
        role: 'roleA',
        audience: 'private_owner',
        createdAt: new Date('2026-07-12T12:00:00.000Z'),
      },
    ],
    sourceRefs: ['owner-message-1'],
  };
}

async function runPrivateAnalyst(
  orchestrator: PrivateAnalystOrchestrator,
  message = { id: 'owner-message-1', content: '請幫我整理現在的感受' },
): Promise<void> {
  await orchestrator.onUserMessage(privateContext(), message);
  const lockResult = withLockMock.mock.results.at(-1)?.value as Promise<void> | undefined;
  expect(lockResult).toBeDefined();
  await lockResult;
}

describe('PrivateAnalystOrchestrator privacy/runtime contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    withLockMock.mockImplementation(async (_key: string, run: () => Promise<void>) => run());
    decideRouteMock.mockReturnValue({ route: 'standard', detectedFlags: [] });
    activateSafetyRouteMock.mockResolvedValue({ action: 'continue' });
    resolvePrivateSupportMock.mockResolvedValue(ownerBundle());
    createStreamMock.mockResolvedValue({
      streamId: 'stream-private-1',
      requestId: 'request-private-1',
      scopeType: 'chat_channel',
      scopeId: PRIVATE_CHANNEL_ID,
    });
    startStreamMock.mockResolvedValue(undefined);
    deltaStreamMock.mockResolvedValue(undefined);
    completeStreamMock.mockResolvedValue(undefined);
    persistStreamMock.mockResolvedValue(undefined);
    failStreamMock.mockResolvedValue(undefined);
    generateTextStreamMock.mockResolvedValue('只給 A 的私密回應');
    prismaMock.chatParticipant.findFirst.mockResolvedValue({ id: AI_PARTICIPANT_ID });
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { id: 'participant-b-private', content: OTHER_PRIVATE_CANARY },
    ]);
    prismaMock.chatMessage.create.mockResolvedValue({
      id: 'ai-private-message-1',
      room_id: ROOM_ID,
      channel_id: PRIVATE_CHANNEL_ID,
      sender_participant_id: AI_PARTICIPANT_ID,
      content: '只給 A 的私密回應',
      message_type: 'ai_reflection',
      visibility_scope: 'owner_only',
    });
    recordAiTriggerMock.mockResolvedValue(undefined);
  });

  it('only consumes the owner-scoped private-support bundle, even with a malicious echo provider', async () => {
    generateTextStreamMock.mockImplementationOnce(async (prompt: string) => prompt);
    prismaMock.chatMessage.create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'ai-private-message-echo',
      sender_participant_id: AI_PARTICIPANT_ID,
      message_type: 'ai_reflection',
      content: data.content,
    }));

    await runPrivateAnalyst(new PrivateAnalystOrchestrator());

    expect(resolvePrivateSupportMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      privateChannelId: PRIVATE_CHANNEL_ID,
      ownerParticipantId: OWNER_PARTICIPANT_ID,
      maxMessages: 30,
    });
    expect(prismaMock.chatMessage.findMany).not.toHaveBeenCalled();
    const providerPrompt = generateTextStreamMock.mock.calls[0]?.[0] as string;
    expect(providerPrompt).toContain('OWNER_A_PRIVATE_CONTEXT');
    expect(providerPrompt).not.toContain(OTHER_PRIVATE_CANARY);
    expect(JSON.stringify(prismaMock.chatMessage.create.mock.calls)).not.toContain(
      OTHER_PRIVATE_CANARY,
    );
  });

  it('uses chat_channel scope and persists owner_only output on the same private channel', async () => {
    generateTextStreamMock.mockImplementationOnce(async (
      _prompt: string,
      options: { onToken?: (text: string) => void },
    ) => {
      options.onToken?.('只給 ');
      options.onToken?.('A');
      return '只給 A 的私密回應';
    });

    await runPrivateAnalyst(new PrivateAnalystOrchestrator());

    expect(createStreamMock).toHaveBeenCalledWith('chat_channel', PRIVATE_CHANNEL_ID);
    expect(startStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: 'chat_channel', scopeId: PRIVATE_CHANNEL_ID }),
      expect.objectContaining({ metadata: { strategy: 'private_support', audience: 'private_owner' } }),
    );
    expect(deltaStreamMock).toHaveBeenCalledTimes(2);
    expect(generateTextStreamMock.mock.calls[0]?.[1].ledger).toMatchObject({
      scopeType: 'chat_channel',
      scopeId: PRIVATE_CHANNEL_ID,
      requestKind: 'chat_private_support_response',
      sourceChannel: 'chat_private',
      metadata: { audience: 'private_owner', strategy: 'private_support' },
    });
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        room_id: ROOM_ID,
        channel_id: PRIVATE_CHANNEL_ID,
        sender_participant_id: AI_PARTICIPANT_ID,
        content: '只給 A 的私密回應',
        message_type: 'ai_reflection',
        visibility_scope: 'owner_only',
        ai_strategy: 'private_support',
        safety_flag: false,
      }),
    });
  });

  it('publishes a private message only to the channel, never to the room audience', async () => {
    await runPrivateAnalyst(new PrivateAnalystOrchestrator());

    expect(publishToChannelMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'message',
      roomId: ROOM_ID,
      channelId: PRIVATE_CHANNEL_ID,
      payload: {
        messageId: 'ai-private-message-1',
        senderParticipantId: AI_PARTICIPANT_ID,
        messageType: 'ai_reflection',
        audience: 'private_owner',
      },
    }));
    expect(publishToRoomMock).not.toHaveBeenCalled();
    expect(persistStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: 'chat_channel', scopeId: PRIVATE_CHANNEL_ID }),
      expect.objectContaining({
        messageId: 'ai-private-message-1',
        fullText: '只給 A 的私密回應',
        metadata: { strategy: 'private_support', audience: 'private_owner' },
      }),
    );
  });

  it('keeps safety routing and its reason inside the private channel path', async () => {
    const safetyReasonCanary = 'PRIVATE_SAFETY_REASON_MUST_NOT_REACH_SHARED';
    decideRouteMock.mockReturnValueOnce({
      route: 'safety_support',
      detectedFlags: [safetyReasonCanary],
    });
    resolvePrivateSupportMock.mockResolvedValueOnce(ownerBundle('我現在可能不安全'));
    generateTextStreamMock.mockResolvedValueOnce('請先確認你現在是否安全');
    prismaMock.chatMessage.create.mockResolvedValueOnce({
      id: 'ai-private-safety',
      sender_participant_id: AI_PARTICIPANT_ID,
      content: '請先確認你現在是否安全',
      message_type: 'safety_notice',
    });

    await runPrivateAnalyst(
      new PrivateAnalystOrchestrator(),
      { id: 'owner-safety-message', content: '我現在可能不安全' },
    );

    expect(activateSafetyRouteMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      ownerParticipantId: OWNER_PARTICIPANT_ID,
      route: 'safety_support',
    });
    expect(activateSafetyRouteMock.mock.invocationCallOrder[0]).toBeLessThan(
      generateTextStreamMock.mock.invocationCallOrder[0] as number,
    );

    expect(generateTextStreamMock.mock.calls[0]?.[1]).toMatchObject({
      temperature: 0.3,
      ledger: {
        scopeType: 'chat_channel',
        scopeId: PRIVATE_CHANNEL_ID,
        metadata: { audience: 'private_owner', strategy: 'private_safety_support' },
      },
    });
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel_id: PRIVATE_CHANNEL_ID,
        message_type: 'safety_notice',
        visibility_scope: 'owner_only',
        ai_strategy: 'private_safety_support',
        safety_flag: true,
      }),
    });
    const persistedData = prismaMock.chatMessage.create.mock.calls[0]?.[0].data;
    expect(persistedData).not.toHaveProperty('safety_detail');
    expect(publishToRoomMock).not.toHaveBeenCalled();
    expect(JSON.stringify(publishToChannelMock.mock.calls)).not.toContain(safetyReasonCanary);
  });

  it('does not call the external provider when durable safety activation fails', async () => {
    activateSafetyRouteMock.mockRejectedValueOnce(new Error('safety state unavailable'));

    await runPrivateAnalyst(new PrivateAnalystOrchestrator());

    expect(generateTextStreamMock).not.toHaveBeenCalled();
    expect(resolvePrivateSupportMock).not.toHaveBeenCalled();
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it('emits a sanitized failure payload without the provider raw error', async () => {
    const providerError = 'provider raw error with PRIVATE_B_CANARY';
    generateTextStreamMock.mockRejectedValueOnce(new Error(providerError));

    await runPrivateAnalyst(new PrivateAnalystOrchestrator());

    expect(failStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: 'chat_channel', scopeId: PRIVATE_CHANNEL_ID }),
      expect.objectContaining({
        code: 'CHAT_PRIVATE_AI_STREAM_FAILED',
        retryable: true,
      }),
      expect.objectContaining({
        actorRole: 'aiMediator',
        metadata: { strategy: 'private_support', audience: 'private_owner' },
      }),
    );
    expect(JSON.stringify(failStreamMock.mock.calls)).not.toContain(providerError);
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
    expect(publishToChannelMock).not.toHaveBeenCalled();
    expect(publishToRoomMock).not.toHaveBeenCalled();
  });
});
