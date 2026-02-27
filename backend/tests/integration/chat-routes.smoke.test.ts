import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Errors } from '../../src/utils/errors';
import { chatEventsService } from '../../src/services/chat-events.service';

const chatServiceMock = {
  createRoom: jest.fn(),
  getRoom: jest.fn(),
  createInvite: jest.fn(),
  acceptInvite: jest.fn(),
  declineInvite: jest.fn(),
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  requestJudgment: jest.fn(),
  getJudgmentStatus: jest.fn(),
};

jest.mock('../../src/services/chat.service', () => ({
  __esModule: true,
  chatService: chatServiceMock,
}));

import app from '../../src/app';

describe('Chat Routes Smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/chat/rooms 應能回傳建立結果', async () => {
    (chatServiceMock.createRoom as any).mockResolvedValueOnce({ id: 'room-1' });
    const res = await request(app)
      .post('/api/v1/chat/rooms')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(200);
    expect(chatServiceMock.createRoom).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
    expect(res.body.data.room.id).toBe('room-1');
  });

  it('POST /api/v1/chat/invites/:inviteCode/decline 應能成功', async () => {
    (chatServiceMock.declineInvite as any).mockResolvedValueOnce({
      id: 'inv-1',
      room_id: 'room-1',
      status: 'declined',
    });
    const res = await request(app)
      .post('/api/v1/chat/invites/ABC123/decline')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(200);
    expect(chatServiceMock.declineInvite).toHaveBeenCalled();
    expect(res.body.data.invite.status).toBe('declined');
  });

  it('POST /api/v1/chat/invites/:inviteCode/decline 發生 FORBIDDEN 應回 403', async () => {
    (chatServiceMock.declineInvite as any).mockRejectedValueOnce(Errors.FORBIDDEN('forbidden'));
    const res = await request(app)
      .post('/api/v1/chat/invites/ABC124/decline')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/chat/invites/:inviteCode/decline session 衝突應回 400', async () => {
    const res = await request(app)
      .post('/api/v1/chat/invites/ABC124/decline?session_id=guest_1700000000001_bcdefghijklmnop')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SESSION_ID');
  });

  it('POST /api/v1/chat/invites/:inviteCode/accept 應能成功', async () => {
    (chatServiceMock.acceptInvite as any).mockResolvedValueOnce({
      id: 'room-2',
      status: 'group_active',
    });
    const res = await request(app)
      .post('/api/v1/chat/invites/ABC234/accept')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(200);
    expect(chatServiceMock.acceptInvite).toHaveBeenCalled();
    expect(res.body.data.room.status).toBe('group_active');
  });

  it('GET /api/v1/chat/rooms/:roomId/judgment-status 應能成功返回狀態', async () => {
    (chatServiceMock.getJudgmentStatus as any).mockResolvedValueOnce({
      roomStatus: 'judgment_completed',
      latestLink: {
        id: 'link-1',
        case: { id: 'case-1' },
        judgment: { id: 'judgment-1' },
      },
    });
    const res = await request(app)
      .get('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/judgment-status')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop');

    expect(res.status).toBe(200);
    expect(chatServiceMock.getJudgmentStatus).toHaveBeenCalled();
    expect(res.body.data.roomStatus).toBe('judgment_completed');
    expect(res.body.data.latestLink.judgment.id).toBe('judgment-1');
  });

  it.each([
    { roomStatus: 'judgment_requested', caseStatus: 'in_progress' },
    { roomStatus: 'judgment_failed', caseStatus: 'judgment_failed' },
  ])('GET /api/v1/chat/rooms/:roomId/judgment-status 應涵蓋 $roomStatus 狀態', async ({ roomStatus, caseStatus }) => {
    (chatServiceMock.getJudgmentStatus as any).mockResolvedValueOnce({
      roomStatus,
      latestLink: {
        id: `link-${roomStatus}`,
        case: { id: `case-${roomStatus}`, status: caseStatus },
        judgment: null,
      },
    });
    const res = await request(app)
      .get('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/judgment-status')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop');

    expect(res.status).toBe(200);
    expect(res.body.data.roomStatus).toBe(roomStatus);
    expect(res.body.data.latestLink.case.status).toBe(caseStatus);
  });

  it('GET /api/v1/chat/rooms/:roomId/messages 應返回分頁消息', async () => {
    (chatServiceMock.listMessages as any).mockResolvedValueOnce({
      messages: [{ id: 'm-1', content: 'hello' }],
      nextCursor: '2026-02-25T00:00:00.000Z',
    });
    const res = await request(app)
      .get('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/messages?limit=20')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop');

    expect(res.status).toBe(200);
    expect(chatServiceMock.listMessages).toHaveBeenCalled();
    expect(res.body.data.messages[0].id).toBe('m-1');
    expect(res.body.data.nextCursor).toBeTruthy();
  });

  it('POST /api/v1/chat/rooms/:roomId/messages 應成功發送消息', async () => {
    (chatServiceMock.sendMessage as any).mockResolvedValueOnce({
      id: 'm-2',
      content: 'msg',
      sender_participant_id: 'p-1',
      message_type: 'user_text',
      visibility_scope: 'all',
    });
    const res = await request(app)
      .post('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/messages')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({ content: 'msg' });

    expect(res.status).toBe(200);
    expect(chatServiceMock.sendMessage).toHaveBeenCalled();
    expect(res.body.data.message.id).toBe('m-2');
  });

  it('POST /api/v1/chat/rooms/:roomId/request-judgment 成功時應返回 case/judgment/link', async () => {
    (chatServiceMock.requestJudgment as any).mockResolvedValueOnce({
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      caseId: 'case-success-1',
      judgmentId: 'judgment-success-1',
      linkId: 'link-success-1',
      status: 'judgment_completed',
    });
    const res = await request(app)
      .post('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/request-judgment')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.caseId).toBe('case-success-1');
    expect(res.body.data.judgmentId).toBe('judgment-success-1');
    expect(res.body.data.linkId).toBe('link-success-1');
  });

  it('POST /api/v1/chat/rooms/:roomId/request-judgment 發生 FORBIDDEN 應回 403', async () => {
    (chatServiceMock.requestJudgment as any).mockRejectedValueOnce(Errors.FORBIDDEN('forbidden'));
    const res = await request(app)
      .post('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/request-judgment')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/chat/rooms/:roomId/request-judgment 發生 CONFLICT 應回 409', async () => {
    (chatServiceMock.requestJudgment as any).mockRejectedValueOnce(Errors.CONFLICT('conflict'));
    const res = await request(app)
      .post('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/request-judgment')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/chat/rooms/:roomId/request-judgment session 衝突應回 400', async () => {
    const res = await request(app)
      .post('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/request-judgment?session_id=guest_1700000000001_bcdefghijklmnop')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SESSION_ID');
  });

  it('GET /api/v1/chat/rooms/:roomId/stream 訂閱超限時應回 429', async () => {
    (chatServiceMock.getRoom as any).mockResolvedValueOnce({ id: 'room-stream' });
    const subscribeSpy = jest
      .spyOn(chatEventsService, 'subscribe')
      .mockImplementationOnce(() => {
        throw Errors.RATE_LIMIT_EXCEEDED('聊天室即時連線已達上限，請稍後重試');
      });

    const res = await request(app)
      .get('/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/stream')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop');

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    subscribeSpy.mockRestore();
  });

  it('POST /api/v1/chat/invites/:inviteCode/decline 發生 UNAUTHORIZED 應回 401', async () => {
    (chatServiceMock.declineInvite as any).mockRejectedValueOnce(Errors.UNAUTHORIZED('need login'));
    const res = await request(app)
      .post('/api/v1/chat/invites/ABC555/decline')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
