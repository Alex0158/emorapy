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
  isAIStreamScopeType: (value: string) => value === 'chat_room',
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
});
