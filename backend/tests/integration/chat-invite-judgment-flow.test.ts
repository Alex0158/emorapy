import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

const chatServiceMock: any = {
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

describe('Chat Invite Judgment Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('應覆蓋 create->invite->accept->message->request-judgment->status 全正向鏈路', async () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';
    chatServiceMock.createRoom.mockResolvedValueOnce({
      id: roomId,
      status: 'solo_active',
      participants: [],
    });
    chatServiceMock.createInvite.mockResolvedValueOnce({
      id: 'inv-1',
      room_id: roomId,
      status: 'pending',
      invite_code: 'FLOW123',
    });
    chatServiceMock.acceptInvite.mockResolvedValueOnce({
      id: roomId,
      status: 'group_active',
      participants: [],
    });
    chatServiceMock.sendMessage.mockResolvedValueOnce({
      id: 'msg-1',
      sender_participant_id: 'p-a',
      message_type: 'user_text',
      visibility_scope: 'all',
      content: '我們想先聊聊',
    });
    chatServiceMock.requestJudgment.mockResolvedValueOnce({
      roomId,
      caseId: 'case-1',
      linkId: 'link-1',
      status: 'judgment_requested',
    });
    chatServiceMock.getJudgmentStatus
      .mockResolvedValueOnce({
        roomStatus: 'judgment_requested',
        latestLink: {
          id: 'link-1',
          case: { id: 'case-1', status: 'in_progress' },
          judgment: null,
        },
      })
      .mockResolvedValueOnce({
        roomStatus: 'judgment_completed',
        latestLink: {
          id: 'link-1',
          case: { id: 'case-1', status: 'completed' },
          judgment: { id: 'judgment-1' },
        },
      });

    const createRoomRes = await request(app)
      .post('/api/v1/chat/rooms')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({ history_visibility_mode: 'share_full_history' });
    expect(createRoomRes.status).toBe(200);

    const createInviteRes = await request(app)
      .post(`/api/v1/chat/rooms/${roomId}/invites`)
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});
    expect(createInviteRes.status).toBe(200);
    expect(createInviteRes.body.data.invite.invite_code).toBe('FLOW123');

    const acceptInviteRes = await request(app)
      .post('/api/v1/chat/invites/FLOW123/accept')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});
    expect(acceptInviteRes.status).toBe(200);
    expect(acceptInviteRes.body.data.room.status).toBe('group_active');

    const sendMessageRes = await request(app)
      .post(`/api/v1/chat/rooms/${roomId}/messages`)
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({ content: '我們想先聊聊', visibility_scope: 'all' });
    expect(sendMessageRes.status).toBe(200);
    expect(sendMessageRes.body.data.message.id).toBe('msg-1');

    const requestJudgmentRes = await request(app)
      .post(`/api/v1/chat/rooms/${roomId}/request-judgment`)
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});
    expect(requestJudgmentRes.status).toBe(200);
    expect(requestJudgmentRes.body.data.status).toBe('judgment_requested');

    const statusRequestedRes = await request(app)
      .get(`/api/v1/chat/rooms/${roomId}/judgment-status`)
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop');
    expect(statusRequestedRes.status).toBe(200);
    expect(statusRequestedRes.body.data.roomStatus).toBe('judgment_requested');

    const statusCompletedRes = await request(app)
      .get(`/api/v1/chat/rooms/${roomId}/judgment-status`)
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop');
    expect(statusCompletedRes.status).toBe(200);
    expect(statusCompletedRes.body.data.roomStatus).toBe('judgment_completed');
    expect(statusCompletedRes.body.data.latestLink.judgment.id).toBe('judgment-1');
  });

  it('應覆蓋 create->invite->decline 成功路徑', async () => {
    const roomId = '660e8400-e29b-41d4-a716-446655440000';
    chatServiceMock.createRoom.mockResolvedValueOnce({
      id: roomId,
      status: 'solo_active',
      participants: [],
    });
    chatServiceMock.createInvite.mockResolvedValueOnce({
      id: 'inv-2',
      room_id: roomId,
      status: 'pending',
      invite_code: 'FLOW456',
    });
    chatServiceMock.declineInvite.mockResolvedValueOnce({
      id: 'inv-2',
      room_id: roomId,
      status: 'declined',
    });

    const createRoomRes = await request(app)
      .post('/api/v1/chat/rooms')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});
    expect(createRoomRes.status).toBe(200);

    const createInviteRes = await request(app)
      .post(`/api/v1/chat/rooms/${roomId}/invites`)
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});
    expect(createInviteRes.status).toBe(200);

    const declineRes = await request(app)
      .post('/api/v1/chat/invites/FLOW456/decline')
      .set('x-session-id', 'guest_1700000000000_abcdefghijklmnop')
      .send({});
    expect(declineRes.status).toBe(200);
    expect(declineRes.body.data.invite.status).toBe('declined');
  });
});
