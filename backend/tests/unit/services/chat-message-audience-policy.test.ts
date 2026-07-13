import {
  ChatHistoryVisibilityMode,
  ChatRoleInRoom,
  ChatVisibilityScope,
} from '@prisma/client';
import {
  buildSharedContextMessageWhere,
  buildVisibleChatMessageWhere,
  filterSharedContextMessages,
  isRoomWideChatMessage,
} from '../../../src/services/chat-message-audience-policy';

describe('chat-message-audience-policy', () => {
  it('roleA 只可讀 room-wide 訊息與自己發出的 legacy private 訊息', () => {
    expect(buildVisibleChatMessageWhere(
      { id: 'participant-a', role_in_room: ChatRoleInRoom.roleA },
      ChatHistoryVisibilityMode.share_full_history,
    )).toEqual({
      OR: [
        {
          visibility_scope: ChatVisibilityScope.all,
          OR: [
            { channel_id: null },
            { channel: { is: { kind: 'shared' } } },
          ],
        },
        {
          sender_participant_id: 'participant-a',
          visibility_scope: {
            in: [ChatVisibilityScope.owner_only, ChatVisibilityScope.summary_only],
          },
          channel_id: null,
        },
        {
          channel: { is: { kind: 'private', owner_participant_id: 'participant-a' } },
        },
      ],
    });
  });

  it('roleB 在非 full-history 房間只可讀加入後 shared 與自己的 private', () => {
    const joinedAt = new Date('2026-07-12T12:00:00.000Z');

    expect(buildVisibleChatMessageWhere(
      { id: 'participant-b', role_in_room: ChatRoleInRoom.roleB, joined_at: joinedAt },
      ChatHistoryVisibilityMode.share_summary_only,
    )).toEqual({
      OR: [
        {
          visibility_scope: ChatVisibilityScope.all,
          created_at: { gte: joinedAt },
          OR: [
            { channel_id: null },
            { channel: { is: { kind: 'shared' } } },
          ],
        },
        {
          sender_participant_id: 'participant-b',
          visibility_scope: {
            in: [ChatVisibilityScope.owner_only, ChatVisibilityScope.summary_only],
          },
          channel_id: null,
        },
        {
          channel: { is: { kind: 'private', owner_participant_id: 'participant-b' } },
        },
      ],
    });
  });

  it('shared AI/formal context 只允許 active sender 的 all 訊息', () => {
    const joinedAt = new Date('2026-07-12T12:00:00.000Z');

    expect(buildSharedContextMessageWhere({
      roomId: 'room-1',
      historyVisibilityMode: ChatHistoryVisibilityMode.share_from_join_time,
      roleBJoinedAt: joinedAt,
    })).toEqual({
      room_id: 'room-1',
      message_type: 'user_text',
      visibility_scope: ChatVisibilityScope.all,
      ai_context_eligible: true,
      OR: [
        { channel_id: null },
        { channel: { is: { kind: 'shared' } } },
      ],
      sender_participant: { is: { is_active: true } },
      created_at: { gte: joinedAt },
    });
  });

  it('只有 all 訊息可做 room-wide event', () => {
    expect(isRoomWideChatMessage(ChatVisibilityScope.all)).toBe(true);
    expect(isRoomWideChatMessage(ChatVisibilityScope.owner_only)).toBe(false);
    expect(isRoomWideChatMessage(ChatVisibilityScope.summary_only)).toBe(false);
  });

  it('defense-in-depth projection 會丟棄 private、inactive、pre-join 與 legacy AI canary', () => {
    const joinedAt = new Date('2026-07-12T12:00:00.000Z');
    const messages = [
      {
        id: 'shared',
        message_type: 'user_text',
        visibility_scope: ChatVisibilityScope.all,
        ai_context_eligible: true,
        created_at: new Date('2026-07-12T12:01:00.000Z'),
        sender_participant: { is_active: true },
      },
      {
        id: 'private-canary',
        message_type: 'user_text',
        visibility_scope: ChatVisibilityScope.owner_only,
        ai_context_eligible: true,
        created_at: new Date('2026-07-12T12:02:00.000Z'),
        sender_participant: { is_active: true },
      },
      {
        id: 'inactive-canary',
        message_type: 'user_text',
        visibility_scope: ChatVisibilityScope.all,
        ai_context_eligible: true,
        created_at: new Date('2026-07-12T12:03:00.000Z'),
        sender_participant: { is_active: false },
      },
      {
        id: 'pre-join-canary',
        message_type: 'user_text',
        visibility_scope: ChatVisibilityScope.all,
        ai_context_eligible: true,
        created_at: new Date('2026-07-12T11:59:00.000Z'),
        sender_participant: { is_active: true },
      },
      {
        id: 'legacy-ai-canary',
        message_type: 'ai_mediation',
        visibility_scope: ChatVisibilityScope.all,
        ai_context_eligible: false,
        created_at: new Date('2026-07-12T12:04:00.000Z'),
        sender_participant: { is_active: true },
      },
      {
        id: 'legacy-display-only-canary',
        message_type: 'user_text',
        visibility_scope: ChatVisibilityScope.all,
        ai_context_eligible: false,
        created_at: new Date('2026-07-12T12:05:00.000Z'),
        sender_participant: { is_active: true },
      },
    ];

    expect(filterSharedContextMessages(messages, {
      roomId: 'room-1',
      historyVisibilityMode: ChatHistoryVisibilityMode.share_summary_only,
      roleBJoinedAt: joinedAt,
    }).map((message) => message.id)).toEqual(['shared']);
  });
});
