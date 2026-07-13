import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Errors } from '../../../src/utils/errors';

const mockListActorChannels = jest.fn();
const mockListMessages = jest.fn();
const mockResolveAccessibleChannel = jest.fn();
const mockGetContextPreference = jest.fn();
const mockUpdateContextPreference = jest.fn();
const mockSendMessageToChannel = jest.fn();
const mockPublish = jest.fn();
const mockPublishToChannel = jest.fn();
const mockSubscribeChannel = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();
const mockGetSessionIdFromSources = jest.fn();
const mockPrepareHandshake = jest.fn();

jest.mock('../../../src/services/chat-channel.service', () => ({
  chatChannelService: {
    listActorChannels: (...args: unknown[]) => mockListActorChannels(...args),
    listMessages: (...args: unknown[]) => mockListMessages(...args),
    resolveAccessibleChannel: (...args: unknown[]) => mockResolveAccessibleChannel(...args),
  },
}));
jest.mock('../../../src/services/chat.service', () => ({
  chatService: {
    sendMessageToChannel: (...args: unknown[]) => mockSendMessageToChannel(...args),
  },
}));
jest.mock('../../../src/services/chat-context-preference.service', () => ({
  chatContextPreferenceService: {
    get: (...args: unknown[]) => mockGetContextPreference(...args),
    update: (...args: unknown[]) => mockUpdateContextPreference(...args),
  },
}));
jest.mock('../../../src/services/chat-events.service', () => ({
  chatEventsService: {
    publish: (event: unknown) => mockPublish(event),
    publishToChannel: (event: unknown) => mockPublishToChannel(event),
    subscribeChannel: (...args: unknown[]) => mockSubscribeChannel(...args),
    subscribeChannelForParticipant: (...args: unknown[]) => mockSubscribeChannel(...args),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserIdOptional: (req: express.Request) => mockGetAuthUserIdOptional(req),
  getSessionIdFromSources: (req: express.Request) => mockGetSessionIdFromSources(req),
}));
jest.mock('../../../src/middleware/auth', () => ({
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/routes/chat-sse-entitlement-handshake', () => ({
  ChatSseEntitlementHandshake: {
    prepare: (...args: unknown[]) => mockPrepareHandshake(...args),
  },
}));

import chatChannelRouter from '../../../src/routes/chat-channel.routes';

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const privateChannelId = '660e8400-e29b-41d4-a716-446655440000';
const sharedChannelId = '770e8400-e29b-41d4-a716-446655440000';
const sessionId = 'guest_1700000000000_abcdefghijklmnop';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatChannelRouter);
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const code = (error as { code?: string }).code;
      const status = code === 'INVALID_SESSION_ID' || code === 'VALIDATION_ERROR'
        ? 400
        : code === 'FORBIDDEN'
          ? 403
          : code === 'RATE_LIMIT_EXCEEDED'
            ? 429
            : 500;
      res.status(status).json({ success: false, code, error: error.message });
    },
  );
  return app;
}

describe('chat-channel.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUserIdOptional.mockReturnValue(undefined);
    mockGetSessionIdFromSources.mockReturnValue({
      sessionId,
      hasConflict: false,
    });
    mockListActorChannels.mockResolvedValue([] as never);
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null } as never);
    mockGetContextPreference.mockResolvedValue({
      participantId: 'participant-a',
      mode: 'private_only',
    } as never);
    mockUpdateContextPreference.mockResolvedValue({
      participantId: 'participant-a',
      mode: 'shared_process_controls',
    } as never);
    mockSubscribeChannel.mockReturnValue(jest.fn());
    mockPrepareHandshake.mockResolvedValue({
      bindSubscription: jest.fn(),
      confirmBeforeHeaders: jest.fn(async () => undefined),
      activateAndFlush: jest.fn((writeReady: () => void) => {
        writeReady();
        return Promise.resolve();
      }),
      push: jest.fn(async () => undefined),
      dispose: jest.fn(),
    } as never);
  });

  it('only returns channels projected by the centralized channel service', async () => {
    mockListActorChannels.mockResolvedValueOnce([
      { id: sharedChannelId, room_id: roomId, kind: 'shared' },
      { id: privateChannelId, room_id: roomId, kind: 'private', owner_participant_id: 'p-a' },
    ] as never);

    const response = await request(createApp())
      .get(`/chat/rooms/${roomId}/channels`)
      .set('x-session-id', sessionId);

    expect(response.status).toBe(200);
    expect(response.body.data.channels).toHaveLength(2);
    expect(mockListActorChannels).toHaveBeenCalledWith(roomId, { userId: undefined, sessionId });
  });

  it('GET context-preference delegates the actor and returns the public response shape', async () => {
    const response = await request(createApp())
      .get(`/chat/rooms/${roomId}/context-preference`)
      .set('x-session-id', sessionId);

    expect(response.status).toBe(200);
    expect(mockGetContextPreference).toHaveBeenCalledWith(roomId, {
      userId: undefined,
      sessionId,
    });
    expect(response.body).toEqual({
      success: true,
      data: {
        preference: {
          participant_id: 'participant-a',
          mode: 'private_only',
        },
      },
    });
  });

  it('PUT context-preference validates and delegates the selected mode', async () => {
    const response = await request(createApp())
      .put(`/chat/rooms/${roomId}/context-preference`)
      .set('x-session-id', sessionId)
      .send({ mode: 'shared_process_controls' });

    expect(response.status).toBe(200);
    expect(mockUpdateContextPreference).toHaveBeenCalledWith(
      roomId,
      { userId: undefined, sessionId },
      'shared_process_controls',
    );
    expect(response.body.data.preference).toEqual({
      participant_id: 'participant-a',
      mode: 'shared_process_controls',
    });
  });

  it('PUT context-preference rejects unknown modes before service delegation', async () => {
    const response = await request(createApp())
      .put(`/chat/rooms/${roomId}/context-preference`)
      .set('x-session-id', sessionId)
      .send({ mode: 'share_everything' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateContextPreference).not.toHaveBeenCalled();
  });

  it('GET context-preference rejects an invalid room id before actor delegation', async () => {
    const response = await request(createApp())
      .get('/chat/rooms/not-a-uuid/context-preference')
      .set('x-session-id', sessionId);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockGetContextPreference).not.toHaveBeenCalled();
  });

  it('delegates channel message pagination without reimplementing access rules', async () => {
    const cursor = '2026-07-12T10:00:00.000Z';
    mockListMessages.mockResolvedValueOnce({
      messages: [{ id: 'message-1', channel_id: privateChannelId }],
      nextCursor: null,
    } as never);

    const response = await request(createApp())
      .get(`/chat/channels/${privateChannelId}/messages?limit=20&cursor=${encodeURIComponent(cursor)}`)
      .set('x-session-id', sessionId);

    expect(response.status).toBe(200);
    expect(mockListMessages).toHaveBeenCalledWith(
      privateChannelId,
      { userId: undefined, sessionId },
      { cursor, limit: 20 },
    );
  });

  it('publishes a private send only to its participant-scoped channel', async () => {
    mockSendMessageToChannel.mockResolvedValueOnce({
      id: 'message-private',
      room_id: roomId,
      channel_id: privateChannelId,
      sender_participant_id: 'p-a',
      message_type: 'user_text',
      visibility_scope: 'owner_only',
      channel: { id: privateChannelId, kind: 'private' },
    } as never);

    const response = await request(createApp())
      .post(`/chat/channels/${privateChannelId}/messages`)
      .set('x-session-id', sessionId)
      .send({ content: 'private note' });

    expect(response.status).toBe(200);
    expect(mockPublishToChannel).toHaveBeenCalledWith(expect.objectContaining({
      roomId,
      channelId: privateChannelId,
    }));
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes a shared send to both the shared channel and room stream', async () => {
    mockSendMessageToChannel.mockResolvedValueOnce({
      id: 'message-shared',
      room_id: roomId,
      channel_id: sharedChannelId,
      sender_participant_id: 'p-a',
      message_type: 'user_text',
      visibility_scope: 'all',
      channel: { id: sharedChannelId, kind: 'shared' },
    } as never);

    const response = await request(createApp())
      .post(`/chat/channels/${sharedChannelId}/messages`)
      .set('x-session-id', sessionId)
      .send({ content: 'shared note' });

    expect(response.status).toBe(200);
    expect(mockPublishToChannel).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('rejects channel stream access before any subscription is registered', async () => {
    mockResolveAccessibleChannel.mockRejectedValueOnce(
      Errors.FORBIDDEN('你沒有該私人對話空間權限') as never,
    );

    const response = await request(createApp())
      .get(`/chat/channels/${privateChannelId}/stream`)
      .set('x-session-id', sessionId);

    expect(response.status).toBe(403);
    expect(mockSubscribeChannel).not.toHaveBeenCalled();
  });

  it('subscribes only the authorized channel and handles capacity errors before SSE headers', async () => {
    mockResolveAccessibleChannel.mockResolvedValueOnce({
      room: { id: roomId },
      channel: { id: privateChannelId, kind: 'private' },
      participant: { id: 'participant-a' },
    } as never);
    mockSubscribeChannel.mockImplementationOnce(() => {
      throw Errors.RATE_LIMIT_EXCEEDED('對話空間即時連線已達上限');
    });

    const response = await request(createApp())
      .get(`/chat/channels/${privateChannelId}/stream`)
      .set('x-session-id', sessionId);

    expect(response.status).toBe(429);
    expect(mockSubscribeChannel).toHaveBeenCalledWith(
      privateChannelId,
      expect.any(Function),
    );
  });

  it('rejects conflicting session sources before calling channel services', async () => {
    mockGetSessionIdFromSources.mockReturnValueOnce({ sessionId, hasConflict: true });

    const response = await request(createApp())
      .get(`/chat/rooms/${roomId}/channels`)
      .set('x-session-id', sessionId);

    expect(response.status).toBe(400);
    expect(mockListActorChannels).not.toHaveBeenCalled();
  });
});
