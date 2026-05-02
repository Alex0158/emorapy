import { describe, expect, it } from 'vitest';
import type { ChatParticipant, ChatRoom, ChatRoomStatus } from '@/types/chat';
import { deriveChatRoomState } from './useChatRoomDerivedState';

const baseParticipant = (overrides: Partial<ChatParticipant> = {}): ChatParticipant => ({
  id: 'participant-1',
  room_id: 'room-1',
  participant_type: 'user',
  user_id: 'u1',
  role_in_room: 'roleA',
  joined_at: '2026-01-01T00:00:00.000Z',
  is_active: true,
  ...overrides,
});

const baseRoom = (overrides: Partial<ChatRoom> = {}): ChatRoom => ({
  id: 'room-1',
  status: 'solo_active',
  owner_user_id: 'u1',
  session_id: null,
  history_visibility_mode: 'share_summary_only',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  participants: [],
  ...overrides,
});

const derive = (
  room: ChatRoom | null,
  overrides: Partial<Parameters<typeof deriveChatRoomState>[0]> = {}
) =>
  deriveChatRoomState({
    room,
    currentUserId: 'u1',
    sessionId: null,
    sending: false,
    creatingInvite: false,
    judging: false,
    ...overrides,
  });

describe('deriveChatRoomState', () => {
  it('缺少房間時應禁用所有房間動作', () => {
    expect(derive(null)).toMatchObject({
      isOwner: false,
      hasActiveRoleB: false,
      disableSendMessage: true,
      disableCreateInvite: true,
      disableRequestJudgment: true,
      myRole: null,
      canKickB: false,
      canLeaveRoom: false,
    });
  });

  it('登入 owner 可發言、建立邀請與發起判決', () => {
    expect(derive(baseRoom())).toMatchObject({
      isOwner: true,
      myRole: 'roleA',
      disableSendMessage: false,
      disableCreateInvite: false,
      disableRequestJudgment: false,
    });
  });

  it('匿名 owner 的 canonical session_id 匹配時應取得 owner 權限', () => {
    const state = derive(
      baseRoom({
        owner_user_id: null,
        session_id: 'guest_owner_123',
        participants: [baseParticipant({ user_id: null })],
      }),
      { currentUserId: undefined, sessionId: 'guest_owner_123' }
    );

    expect(state).toMatchObject({
      isOwner: true,
      myRole: 'roleA',
      disableCreateInvite: false,
      disableRequestJudgment: false,
    });
  });

  it.each([
    ['session 不匹配', 'guest_other_123'],
    ['缺少 canonical session', null],
  ])('匿名 owner %s 時不應取得 owner 專用動作權限', (_, sessionId) => {
    const state = derive(
      baseRoom({
        owner_user_id: null,
        session_id: 'guest_owner_123',
        participants: [baseParticipant({ user_id: null })],
      }),
      { currentUserId: undefined, sessionId }
    );

    expect(state).toMatchObject({
      isOwner: false,
      myRole: null,
      disableCreateInvite: true,
      disableRequestJudgment: true,
    });
  });

  it('已有 active roleB 時 owner 可發起判決但不能再建立邀請，且可移除 B 方', () => {
    const state = derive(
      baseRoom({
        participants: [
          baseParticipant(),
          baseParticipant({
            id: 'participant-b',
            user_id: 'u2',
            role_in_room: 'roleB',
          }),
        ],
      })
    );

    expect(state).toMatchObject({
      isOwner: true,
      hasActiveRoleB: true,
      disableCreateInvite: true,
      disableRequestJudgment: false,
      canKickB: true,
    });
  });

  it('active roleB 使用者可發言與離開房間，但不能使用 owner 專用動作', () => {
    const state = derive(
      baseRoom({
        participants: [
          baseParticipant(),
          baseParticipant({
            id: 'participant-b',
            user_id: 'u2',
            role_in_room: 'roleB',
          }),
        ],
      }),
      { currentUserId: 'u2' }
    );

    expect(state).toMatchObject({
      isOwner: false,
      myRole: 'roleB',
      disableSendMessage: false,
      disableCreateInvite: true,
      disableRequestJudgment: true,
      canLeaveRoom: true,
    });
  });

  it.each<ChatRoomStatus>(['judgment_requested', 'judgment_completed', 'archived'])(
    '房間狀態為 %s 時應禁用發言、邀請與發起判決',
    (status) => {
      expect(derive(baseRoom({ status }))).toMatchObject({
        disableSendMessage: true,
        disableCreateInvite: true,
        disableRequestJudgment: true,
      });
    }
  );
});
