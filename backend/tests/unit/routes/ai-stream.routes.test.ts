import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockAssertScopeAccess = jest.fn<(...args: unknown[]) => Promise<{
  chatParticipantId: string;
  replayNotBefore: Date;
}>>();
const mockSubscribe = jest.fn<(
  scopeType: string,
  scopeId: string,
  listener: (event: Record<string, unknown>) => void,
  options: Record<string, unknown>,
) => Promise<() => void>>();
const mockGetSnapshots = jest.fn<(...args: unknown[]) => Promise<Array<Record<string, unknown>>>>();
const mockEmitScopeHeartbeat = jest.fn<(...args: unknown[]) => Promise<null>>();
const mockWatchParticipant = jest.fn<(
  participantId: string,
  listener: () => void,
) => () => void>();
const mockRevalidateParticipantNow = jest.fn<(participantId: string) => Promise<boolean>>();
let revokeListener: (() => void) | undefined;

jest.mock('../../../src/middleware/auth', () => ({
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/routes/chat-route-actor', () => ({
  getChatActorFromRequest: () => ({ userId: 'user-b2' }),
}));
jest.mock('../../../src/routes/ai-stream-scope-access', () => ({
  isAIStreamScopeType: (value: string) => value === 'chat_room' || value === 'chat_channel',
  assertAIStreamScopeAccess: mockAssertScopeAccess,
}));
jest.mock('../../../src/services/ai-stream.service', () => ({
  aiStreamService: {
    subscribe: mockSubscribe,
    getSnapshots: mockGetSnapshots,
    emitScopeHeartbeat: mockEmitScopeHeartbeat,
  },
}));
jest.mock('../../../src/services/chat-stream-entitlement.service', () => ({
  chatStreamEntitlementService: {
    watchParticipant: mockWatchParticipant,
    revalidateParticipantNow: mockRevalidateParticipantNow,
  },
}));

import aiStreamRouter from '../../../src/routes/ai-stream.routes';

function createApp() {
  const app = express();
  app.use('/ai-stream', aiStreamRouter);
  app.use((
    error: Error & { statusCode?: number; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(error.statusCode ?? 500).json({ code: error.code, error: error.message });
  });
  return app;
}

describe('ai-stream.routes replay authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertScopeAccess.mockReset();
    mockSubscribe.mockReset();
    mockGetSnapshots.mockReset();
    mockEmitScopeHeartbeat.mockReset();
    mockWatchParticipant.mockReset();
    mockRevalidateParticipantNow.mockReset();
    revokeListener = undefined;
    mockAssertScopeAccess.mockResolvedValue({
      chatParticipantId: 'participant-b2',
      replayNotBefore: new Date('2026-07-12T20:00:00.000Z'),
    });
    mockWatchParticipant.mockImplementation((_participantId: string, listener: () => void) => {
      revokeListener = listener;
      return jest.fn();
    });
    mockGetSnapshots.mockResolvedValue([{ text: 'PREJOIN_SECRET_SNAPSHOT' }]);
    mockEmitScopeHeartbeat.mockResolvedValue(null);
  });

  it('registers and revalidates before replay, then emits no buffered data when entitlement is revoked', async () => {
    const unsubscribe = jest.fn();
    mockRevalidateParticipantNow
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockSubscribe.mockImplementation(async (
      _scopeType: string,
      _scopeId: string,
      listener: (event: Record<string, unknown>) => void,
    ) => {
      revokeListener?.();
      listener({
        eventType: 'stream.persisted',
        streamId: 'prejoin-stream',
        fullText: 'PREJOIN_SECRET_EVENT',
      });
      return unsubscribe;
    });

    const response = await request(createApp()).get('/ai-stream/chat_room/room-1');

    expect(response.status).toBe(403);
    expect(response.text).not.toContain('PREJOIN_SECRET_EVENT');
    expect(response.text).not.toContain('PREJOIN_SECRET_SNAPSHOT');
    expect(mockWatchParticipant).toHaveBeenCalledWith('participant-b2', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith(
      'chat_room',
      'room-1',
      expect.any(Function),
      {
        afterSeq: 0,
        notBefore: new Date('2026-07-12T20:00:00.000Z'),
      },
    );
    expect(mockWatchParticipant.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubscribe.mock.invocationCallOrder[0],
    );
    expect(mockRevalidateParticipantNow.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubscribe.mock.invocationCallOrder[0],
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each(['chat_room', 'chat_channel'] as const)(
    '%s drops snapshot-bearing ready payload when delivery-time durable access is revoked',
    async scopeType => {
      const unsubscribe = jest.fn();
      let validationCount = 0;
      mockRevalidateParticipantNow.mockImplementation(async () => {
        validationCount += 1;
        if (validationCount === 3) {
          revokeListener?.();
          return false;
        }
        return true;
      });
      mockSubscribe.mockResolvedValue(unsubscribe);
      mockGetSnapshots.mockResolvedValue([{ text: 'PRIVATE-SNAPSHOT-CANARY' }]);

      const response = await request(createApp()).get(`/ai-stream/${scopeType}/scope-1`);

      expect(response.status).toBe(200);
      expect(response.text).not.toContain('PRIVATE-SNAPSHOT-CANARY');
      expect(mockRevalidateParticipantNow).toHaveBeenCalledTimes(3);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['chat_room', 'chat_channel'] as const)(
    '%s serially revalidates and drops a buffered event revoked after ready authorization',
    async scopeType => {
      const unsubscribe = jest.fn();
      let validationCount = 0;
      mockRevalidateParticipantNow.mockImplementation(async () => {
        validationCount += 1;
        if (validationCount === 4) {
          revokeListener?.();
          return false;
        }
        return true;
      });
      mockSubscribe.mockImplementation(async (
        _scopeType: string,
        _scopeId: string,
        listener: (event: Record<string, unknown>) => void,
      ) => {
        listener({
          eventType: 'stream.delta',
          streamId: 'stream-private',
          requestId: 'request-private',
          scopeType,
          scopeId: 'scope-1',
          seq: 1,
          createdAt: '2026-07-13T00:00:00.000Z',
          deltaText: 'PRIVATE-EVENT-CANARY',
        });
        return unsubscribe;
      });
      mockGetSnapshots.mockResolvedValue([]);

      const response = await request(createApp()).get(`/ai-stream/${scopeType}/scope-1`);

      expect(response.status).toBe(200);
      expect(response.text).toContain('event: ready');
      expect(response.text).not.toContain('PRIVATE-EVENT-CANARY');
      expect(mockRevalidateParticipantNow).toHaveBeenCalledTimes(4);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    },
  );

  it('drops snapshot payload and closes when exact chat_channel scope revalidation errors', async () => {
    const access = {
      chatParticipantId: 'participant-b2',
      replayNotBefore: new Date('2026-07-12T20:00:00.000Z'),
    };
    mockAssertScopeAccess
      .mockResolvedValueOnce(access)
      .mockResolvedValueOnce(access)
      .mockResolvedValueOnce(access)
      .mockRejectedValueOnce(new Error('database unavailable'));
    mockRevalidateParticipantNow.mockResolvedValue(true);
    const unsubscribe = jest.fn();
    mockSubscribe.mockResolvedValue(unsubscribe);
    mockGetSnapshots.mockResolvedValue([{ text: 'PRIVATE-CHANNEL-SNAPSHOT' }]);

    const response = await request(createApp()).get('/ai-stream/chat_channel/private-channel-1');

    expect(response.status).toBe(200);
    expect(response.text).not.toContain('PRIVATE-CHANNEL-SNAPSHOT');
    expect(mockAssertScopeAccess).toHaveBeenCalledTimes(4);
    expect(mockRevalidateParticipantNow).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('delivers snapshot-covered replay before ready and only newer buffered events after ready', async () => {
    const unsubscribe = jest.fn();
    let validationCount = 0;
    mockRevalidateParticipantNow.mockImplementation(async () => {
      validationCount += 1;
      return validationCount < 6;
    });
    mockSubscribe.mockImplementation(async (
      _scopeType: string,
      _scopeId: string,
      listener: (event: Record<string, unknown>) => void,
    ) => {
      listener({
        eventType: 'stream.delta',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_channel',
        scopeId: 'private-channel-1',
        seq: 1,
        createdAt: '2026-07-13T00:00:00.000Z',
        deltaText: 'COVERED-DELTA',
      });
      listener({
        eventType: 'stream.delta',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_channel',
        scopeId: 'private-channel-1',
        seq: 3,
        createdAt: '2026-07-13T00:00:02.000Z',
        deltaText: 'NEWER-DELTA',
      });
      listener({
        eventType: 'stream.heartbeat',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_channel',
        scopeId: 'private-channel-1',
        seq: 4,
        createdAt: '2026-07-13T00:00:03.000Z',
      });
      return unsubscribe;
    });
    mockGetSnapshots.mockResolvedValue([{
      streamId: 'stream-1',
      requestId: 'request-1',
      scopeType: 'chat_channel',
      scopeId: 'private-channel-1',
      status: 'streaming',
      lastSeq: 1,
      text: 'COVERED-DELTA',
      updatedAt: '2026-07-13T00:00:00.000Z',
    }]);

    const response = await request(createApp()).get('/ai-stream/chat_channel/private-channel-1');

    expect(response.status).toBe(200);
    const coveredIndex = response.text.indexOf('COVERED-DELTA');
    const readyIndex = response.text.indexOf('event: ready');
    const newerIndex = response.text.indexOf('NEWER-DELTA');
    expect(coveredIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(coveredIndex);
    expect(newerIndex).toBeGreaterThan(readyIndex);
    expect(response.text).not.toContain('event: stream.heartbeat');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cancels async setup before subscribe when the transport closes during initial access', async () => {
    let releaseAccess!: (value: {
      chatParticipantId: string;
      replayNotBefore: Date;
    }) => void;
    let markAccessStarted!: () => void;
    const accessStarted = new Promise<void>((resolve) => {
      markAccessStarted = resolve;
    });
    mockAssertScopeAccess.mockImplementationOnce(() => {
      markAccessStarted();
      return new Promise(resolve => {
        releaseAccess = resolve;
      });
    });

    const server = createApp().listen();
    try {
      const connection = request(server).get('/ai-stream/chat_room/room-setup-close');
      const settled = connection.then(
        () => undefined,
        () => undefined,
      );
      await accessStarted;
      connection.abort();
      releaseAccess({
        chatParticipantId: 'participant-b2',
        replayNotBefore: new Date('2026-07-12T20:00:00.000Z'),
      });
      await settled;
      await new Promise(resolve => setImmediate(resolve));

      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(mockGetSnapshots).not.toHaveBeenCalled();
      expect(mockEmitScopeHeartbeat).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  });

  it('cleans a subscription that resolves after the transport already closed', async () => {
    let releaseSubscribe!: (cleanup: () => void) => void;
    let markSubscribeStarted!: () => void;
    const subscribeStarted = new Promise<void>((resolve) => {
      markSubscribeStarted = resolve;
    });
    mockRevalidateParticipantNow.mockResolvedValue(true);
    let markWatcherCleaned!: () => void;
    const watcherCleaned = new Promise<void>((resolve) => {
      markWatcherCleaned = resolve;
    });
    mockWatchParticipant.mockImplementationOnce((_participantId: string, listener: () => void) => {
      revokeListener = listener;
      return () => markWatcherCleaned();
    });
    mockSubscribe.mockImplementationOnce(() => {
      markSubscribeStarted();
      return new Promise(resolve => {
        releaseSubscribe = resolve;
      });
    });
    const lateUnsubscribe = jest.fn();

    const server = createApp().listen();
    try {
      const connection = request(server).get('/ai-stream/chat_channel/private-setup-close');
      const settled = connection.then(
        () => undefined,
        () => undefined,
      );
      await subscribeStarted;
      connection.abort();
      await watcherCleaned;
      releaseSubscribe(lateUnsubscribe);
      await settled;
      await new Promise(resolve => setImmediate(resolve));

      expect(lateUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockGetSnapshots).not.toHaveBeenCalled();
      expect(mockEmitScopeHeartbeat).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  });
});
