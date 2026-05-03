/**
 * chat.routes 單元測試（mock chatService、chatEventsService、request utils）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockCreateRoom = jest.fn();
const mockGetRoom = jest.fn();
const mockCreateInvite = jest.fn();
const mockAcceptInvite = jest.fn();
const mockDeclineInvite = jest.fn();
const mockListMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockRequestJudgment = jest.fn();
const mockLeaveRoom = jest.fn();
const mockKickParticipantB = jest.fn();
const mockGetJudgmentStatus = jest.fn();
const mockPublish = jest.fn();
const mockSubscribe = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();
const mockGetSessionIdFromSources = jest.fn();

jest.mock('../../../src/services/chat.service', () => ({
  chatService: {
    createRoom: (...args: unknown[]) => mockCreateRoom(...args),
    getRoom: (...args: unknown[]) => mockGetRoom(...args),
    createInvite: (...args: unknown[]) => mockCreateInvite(...args),
    acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
    declineInvite: (...args: unknown[]) => mockDeclineInvite(...args),
    listMessages: (...args: unknown[]) => mockListMessages(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    requestJudgment: (...args: unknown[]) => mockRequestJudgment(...args),
    leaveRoom: (...args: unknown[]) => mockLeaveRoom(...args),
    kickParticipantB: (...args: unknown[]) => mockKickParticipantB(...args),
    getJudgmentStatus: (...args: unknown[]) => mockGetJudgmentStatus(...args),
  },
}));
jest.mock('../../../src/services/chat-events.service', () => ({
  chatEventsService: {
    publish: (event: unknown) => mockPublish(event),
    subscribe: (_roomId: string, _cb: (e: unknown) => void) => {
      mockSubscribe();
      return () => {};
    },
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserIdOptional: (req: express.Request) => mockGetAuthUserIdOptional(req),
  getSessionIdFromSources: (req: express.Request) => mockGetSessionIdFromSources(req),
}));
jest.mock('../../../src/middleware/auth', () => ({
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import chatRouter from '../../../src/routes/chat.routes';

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const sessionId = 'guest_1700000000000_abcdefghijklmnop';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatRouter);
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const code = (err as { code?: string }).code;
      const status = code === 'INVALID_SESSION_ID' ? 400 : code === 'FORBIDDEN' ? 403 : 500;
      res.status(status).json({ success: false, error: err.message, code });
    }
  );
  return app;
}

function setupActor() {
  mockGetAuthUserIdOptional.mockReturnValue(undefined);
  mockGetSessionIdFromSources.mockReturnValue({
    sessionId,
    headerSessionId: sessionId,
    querySessionId: undefined,
    hasConflict: false,
  });
}

describe('chat.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupActor();
    mockCreateRoom.mockResolvedValue({ id: 'room-1' } as never);
    mockGetRoom.mockResolvedValue({ id: roomId } as never);
    mockCreateInvite.mockResolvedValue({ id: 'inv-1', status: 'pending', invite_code: 'ABC123' } as never);
    mockAcceptInvite.mockResolvedValue({ id: 'room-2', status: 'group_active' } as never);
    mockDeclineInvite.mockResolvedValue({ id: 'inv-1', room_id: 'room-1', status: 'declined' } as never);
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null } as never);
    mockSendMessage.mockResolvedValue({
      id: 'm-1',
      content: 'hi',
      sender_participant_id: 'p-1',
      message_type: 'user_text',
      visibility_scope: 'all',
    } as never);
    mockRequestJudgment.mockResolvedValue({
      status: 'judgment_completed',
      caseId: 'c1',
      judgmentId: 'j1',
      linkId: 'l1',
    } as never);
    mockLeaveRoom.mockResolvedValue({ id: roomId, status: 'group_active' } as never);
    mockKickParticipantB.mockResolvedValue({ id: roomId, participantKicked: true } as never);
    mockGetJudgmentStatus.mockResolvedValue({ roomStatus: 'group_active' } as never);
  });

  describe('錯誤傳遞', () => {
    it('createRoom 拋錯時應 next(error) 返回 500', async () => {
      mockCreateRoom.mockRejectedValueOnce(new Error('db error') as never);
      const app = createApp();
      const res = await request(app)
        .post('/chat/rooms')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'db error' });
    });

    it('getRoom 拋錯時應 next(error) 返回 500', async () => {
      mockGetRoom.mockRejectedValueOnce(new Error('room not found') as never);
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'room not found' });
    });

    it('createInvite 拋錯時應 next(error) 返回 500', async () => {
      mockCreateInvite.mockRejectedValueOnce(new Error('invite failed') as never);
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/invites`)
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'invite failed' });
    });

    it('acceptInvite 拋錯時應 next(error) 返回 500', async () => {
      mockAcceptInvite.mockRejectedValueOnce(new Error('accept failed') as never);
      const app = createApp();
      const res = await request(app)
        .post('/chat/invites/ABC12345/accept')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'accept failed' });
    });

    it('declineInvite 拋錯時應 next(error) 返回 500', async () => {
      mockDeclineInvite.mockRejectedValueOnce(new Error('decline failed') as never);
      const app = createApp();
      const res = await request(app)
        .post('/chat/invites/ABC12345/decline')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'decline failed' });
    });

    it('listMessages 拋錯時應 next(error) 返回 500', async () => {
      mockListMessages.mockRejectedValueOnce(new Error('list failed') as never);
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}/messages?limit=20`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'list failed' });
    });

    it('sendMessage 拋錯時應 next(error) 返回 500', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('send failed') as never);
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/messages`)
        .set('x-session-id', sessionId)
        .send({ content: 'hello' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'send failed' });
    });

    it('requestJudgment 拋錯時應 next(error) 返回 500', async () => {
      mockRequestJudgment.mockRejectedValueOnce(new Error('request failed') as never);
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/request-judgment`)
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'request failed' });
    });

    it('leaveRoom 拋錯時應 next(error) 返回 500', async () => {
      mockLeaveRoom.mockRejectedValueOnce(new Error('leave failed') as never);
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/leave`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'leave failed' });
    });

    it('kickParticipantB 拋錯時應 next(error) 返回 500', async () => {
      mockKickParticipantB.mockRejectedValueOnce(new Error('kick failed') as never);
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/kick-b`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'kick failed' });
    });

    it('getJudgmentStatus 拋錯時應 next(error) 返回 500', async () => {
      mockGetJudgmentStatus.mockRejectedValueOnce(new Error('status failed') as never);
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}/judgment-status`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'status failed' });
    });

    it('stream 端點 getRoom 拋錯時應 next(error) 返回 500（F07 SSE 錯誤傳遞）', async () => {
      mockGetRoom.mockRejectedValueOnce(new Error('stream getRoom failed') as never);
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}/stream`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'stream getRoom failed' });
    });
  });

  describe('成功路徑', () => {
    it('POST /rooms 應調用 createRoom 並返回 200', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/chat/rooms')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.room.id).toBe('room-1');
      expect(mockCreateRoom).toHaveBeenCalled();
    });

    it('GET /rooms/:roomId/messages 無訊息時應返回 messages 空陣列（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}/messages?limit=20`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(200);
      expect(res.body.data.messages).toEqual([]);
      expect(res.body.data.nextCursor).toBeNull();
    });

    it('listMessages 成功時應返回 data.messages、data.nextCursor（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}/messages?limit=20`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('messages');
      expect(res.body.data).toHaveProperty('nextCursor');
      expect(Array.isArray(res.body.data.messages)).toBe(true);
    });
  });

  describe('成功回應結構邊界（F07 data.xxx）', () => {
    it('createRoom 成功時應返回 data.room（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/chat/rooms')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('room');
      expect(res.body.data.room).toHaveProperty('id');
    });

    it('getRoom 成功時應返回 data.room（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('room');
      expect(res.body.data.room).toHaveProperty('id');
    });

    it('createInvite 成功時應返回 data.invite（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/invites`)
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('invite');
      expect(res.body.data.invite).toHaveProperty('id');
      expect(res.body.data.invite).toHaveProperty('invite_code');
    });

    it('acceptInvite 成功時應返回 data.room（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/chat/invites/ABC12345/accept')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('room');
      expect(res.body.data.room).toHaveProperty('id');
    });

    it('declineInvite 成功時應返回 data.invite（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/chat/invites/ABC12345/decline')
        .set('x-session-id', sessionId)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('invite');
      expect(res.body.data.invite).toHaveProperty('id');
    });

    it('sendMessage 成功時應返回 data.message（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/messages`)
        .set('x-session-id', sessionId)
        .send({ content: 'hello' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data.message).toHaveProperty('id');
      expect(res.body.data.message).toHaveProperty('content');
    });

    it('requestJudgment 成功時應返回 data 含 status、caseId、judgmentId、linkId（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/request-judgment`)
        .set('x-session-id', sessionId)
        .send({ participant_consent: { role_b_included_messages: true } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('caseId');
      expect(res.body.data).toHaveProperty('judgmentId');
      expect(res.body.data).toHaveProperty('linkId');
      expect(mockRequestJudgment).toHaveBeenCalledWith(
        roomId,
        expect.any(Object),
        expect.objectContaining({
          participantConsent: { roleBIncludedMessages: true },
        }),
      );
    });

    it('leaveRoom 成功時應返回 data.room（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/leave`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('room');
      expect(res.body.data.room).toHaveProperty('id');
    });

    it('kickParticipantB 成功時應返回 data.room（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/chat/rooms/${roomId}/kick-b`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('room');
      expect(res.body.data.room).toHaveProperty('id');
    });

    it('getJudgmentStatus 成功時應返回 data 含 roomStatus（F07 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .get(`/chat/rooms/${roomId}/judgment-status`)
        .set('x-session-id', sessionId);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('roomStatus');
    });
  });
});
