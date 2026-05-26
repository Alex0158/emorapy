import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHAT_JUDGMENT_REQUEST_TIMEOUT_MS,
  chatInvitePath,
  chatRoomPath,
  createM3ApiClient,
  normalizeListChatMessagesResponse,
} from '../dist/index.js';

function success(data) {
  return { data: { success: true, data } };
}

function fail(code, message) {
  return { data: { success: false, error: { code, message } } };
}

function createHttpMock() {
  const calls = [];
  const queue = [];
  const http = {
    calls,
    enqueue(response) {
      queue.push(response);
    },
    async get(url, config) {
      calls.push({ method: 'get', url, config });
      return queue.shift();
    },
    async post(url, data, config) {
      calls.push({ method: 'post', url, data, config });
      return queue.shift();
    },
    async put(url, data, config) {
      calls.push({ method: 'put', url, data, config });
      return queue.shift();
    },
    async delete(url, config) {
      calls.push({ method: 'delete', url, config });
      return queue.shift();
    },
  };
  return http;
}

describe('M3 Chat API client', () => {
  it('builds encoded chat room and invite paths', () => {
    assert.equal(chatRoomPath('room/a', '/messages'), '/chat/rooms/room%2Fa/messages');
    assert.equal(chatInvitePath('CODE/01', '/accept'), '/chat/invites/CODE%2F01/accept');
  });

  it('creates rooms and invite handoff through chat endpoints', async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(success({ room: { id: 'room-1', history_visibility_mode: 'share_summary_only' } }));
    http.enqueue(success({ invite: { id: 'invite-1', invite_code: 'ABC123', status: 'pending' } }));
    http.enqueue(success({ room: { id: 'room-1', status: 'group_active' } }));
    http.enqueue(success({ invite: { id: 'invite-1', status: 'declined' } }));

    const room = await m3.chat.createRoom();
    const invite = await m3.chat.createInvite(room.id, { expires_in_hours: 12 });
    const acceptedRoom = await m3.chat.acceptInvite('ABC123');
    const declinedInvite = await m3.chat.declineInvite('ABC123');

    assert.equal(room.id, 'room-1');
    assert.equal(invite.invite_code, 'ABC123');
    assert.equal(acceptedRoom.status, 'group_active');
    assert.equal(declinedInvite.status, 'declined');
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['post', '/chat/rooms'],
      ['post', '/chat/rooms/room-1/invites'],
      ['post', '/chat/invites/ABC123/accept'],
      ['post', '/chat/invites/ABC123/decline'],
    ]);
  });

  it('lists, sends, leaves, kicks, and reads judgment status', async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(success({ room: { id: 'room-1', status: 'solo_active' } }));
    http.enqueue(success({ messages: [{ id: 'm1', content: 'hello' }], nextCursor: undefined }));
    http.enqueue(success({ message: { id: 'm2', content: 'reply', visibility_scope: 'all' } }));
    http.enqueue(success({ roomStatus: 'judgment_requested' }));
    http.enqueue(success({ room: { id: 'room-1', status: 'archived' } }));
    http.enqueue(success({ room: { id: 'room-1', status: 'solo_active' } }));

    await m3.chat.getRoom('room-1');
    const list = await m3.chat.listMessages('room-1', { limit: 20 });
    const sent = await m3.chat.sendMessage('room-1', { content: 'reply', visibility_scope: 'all' });
    const status = await m3.chat.getJudgmentStatus('room-1');
    const left = await m3.chat.leaveRoom('room-1');
    const kicked = await m3.chat.kickParticipantB('room-1');

    assert.equal(list.nextCursor, null);
    assert.equal(list.messages.length, 1);
    assert.equal(sent.id, 'm2');
    assert.equal(status.roomStatus, 'judgment_requested');
    assert.equal(left.status, 'archived');
    assert.equal(kicked.status, 'solo_active');
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['get', '/chat/rooms/room-1'],
      ['get', '/chat/rooms/room-1/messages'],
      ['post', '/chat/rooms/room-1/messages'],
      ['get', '/chat/rooms/room-1/judgment-status'],
      ['post', '/chat/rooms/room-1/leave'],
      ['post', '/chat/rooms/room-1/kick-b'],
    ]);
  });

  it('requests judgment with included messages and explicit roleB consent', async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(success({ roomId: 'room-1', caseId: 'case-1', status: 'judgment_requested' }));

    const result = await m3.chat.requestJudgment('room-1', {
      included_message_ids: ['m1', 'm2'],
      participant_consent: { role_b_included_messages: true },
    });

    assert.equal(result.caseId, 'case-1');
    assert.deepEqual(http.calls[0], {
      method: 'post',
      url: '/chat/rooms/room-1/request-judgment',
      data: {
        included_message_ids: ['m1', 'm2'],
        participant_consent: { role_b_included_messages: true },
      },
      config: { timeout: CHAT_JUDGMENT_REQUEST_TIMEOUT_MS },
    });
  });

  it('normalizes malformed list responses and failed envelopes', async () => {
    assert.deepEqual(
      normalizeListChatMessagesResponse({ messages: { items: [] }, nextCursor: undefined }),
      { messages: [], nextCursor: null }
    );

    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(fail('CASE_NOT_READY', '訊息不足'));

    await assert.rejects(
      () => m3.chat.requestJudgment('room-1'),
      (error) => error.code === 'CASE_NOT_READY' && error.message === '訊息不足'
    );
  });
});
