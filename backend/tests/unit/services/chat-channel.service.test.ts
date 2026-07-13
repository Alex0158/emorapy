import { ChatHistoryVisibilityMode, ChatRoleInRoom } from '@prisma/client';

const prismaMock = {
  chatChannel: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  chatMessage: { findMany: jest.fn() },
};
const mockResolveActiveHumanParticipant = jest.fn();
const mockLockActiveRoleB = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: {
    resolveActiveHumanParticipant: (...args: unknown[]) => (
      mockResolveActiveHumanParticipant(...args)
    ),
    lockActiveRoleB: (...args: unknown[]) => mockLockActiveRoleB(...args),
  },
}));

import { ChatChannelService } from '../../../src/services/chat-channel.service';

describe('ChatChannelService shared history cutoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.chatChannel.findUnique.mockResolvedValue({ room_id: 'room-1' });
    prismaMock.chatChannel.findFirst.mockResolvedValue({
      id: 'shared-1',
      room_id: 'room-1',
      kind: 'shared',
      owner_participant_id: null,
    });
    prismaMock.chatChannel.createMany.mockResolvedValue({ count: 1 });
    prismaMock.chatChannel.findMany.mockResolvedValue([{
      id: 'shared-1',
      room_id: 'room-1',
      kind: 'shared',
      owner_participant_id: null,
    }]);
  });

  it.each([
    ['replacement roleB', ChatRoleInRoom.roleB, ChatHistoryVisibilityMode.share_from_join_time, false],
    ['roleA', ChatRoleInRoom.roleA, ChatHistoryVisibilityMode.share_from_join_time, true],
    ['roleB full history', ChatRoleInRoom.roleB, ChatHistoryVisibilityMode.share_full_history, true],
  ] as const)(
    '%s cannot bypass cutoff through channelized shared rows',
    async (_label, roleInRoom, historyVisibilityMode, shouldRead) => {
      const joinedAt = new Date('2026-07-12T20:00:00.000Z');
      mockResolveActiveHumanParticipant.mockResolvedValue({
        participant: {
          id: roleInRoom === ChatRoleInRoom.roleB ? 'participant-b2' : 'participant-a',
          role_in_room: roleInRoom,
          joined_at: joinedAt,
        },
        room: {
          id: 'room-1',
          history_visibility_mode: historyVisibilityMode,
          participants: [],
        },
      });
      prismaMock.chatMessage.findMany.mockResolvedValue([{
        id: 'message-before-b2',
        room_id: 'room-1',
        channel_id: 'shared-1',
        created_at: new Date('2026-07-12T19:59:59.000Z'),
        sender_participant: { id: 'participant-a' },
        channel: { id: 'shared-1', kind: 'shared' },
      }]);

      const result = await new ChatChannelService().listMessages(
        'shared-1',
        { userId: roleInRoom === ChatRoleInRoom.roleB ? 'user-b2' : 'user-a' },
        { limit: 20 },
      );

      expect(result.messages).toHaveLength(shouldRead ? 1 : 0);
      const channelBranch = prismaMock.chatMessage.findMany.mock.calls[0][0].where.OR[0];
      if (roleInRoom === ChatRoleInRoom.roleB
        && historyVisibilityMode !== ChatHistoryVisibilityMode.share_full_history) {
        expect(channelBranch).toMatchObject({
          channel_id: 'shared-1',
          created_at: { gte: joinedAt },
        });
      } else {
        expect(channelBranch).toEqual({ channel_id: 'shared-1' });
      }
    },
  );

  it.each(['solo_active', 'invite_pending'] as const)(
    'legacy shared write fails closed in %s before provisioning or roleB lock',
    async status => {
      const room = {
        id: 'room-1',
        status,
        participants: [{
          id: 'participant-a',
          participant_type: 'user',
          role_in_room: 'roleA',
          is_active: true,
          left_at: null,
        }],
      };

      await expect(new ChatChannelService().getOrCreateWriteChannelForParticipant(
        room as never,
        'participant-a',
        'all' as never,
      )).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });

      expect(mockLockActiveRoleB).not.toHaveBeenCalled();
      expect(prismaMock.chatChannel.createMany).not.toHaveBeenCalled();
    },
  );

  it('legacy shared write locks active roleB before provisioning the shared channel', async () => {
    const room = {
      id: 'room-1',
      status: 'group_active',
      participants: [
        {
          id: 'participant-a',
          participant_type: 'user',
          role_in_room: 'roleA',
          is_active: true,
          left_at: null,
        },
        {
          id: 'participant-b',
          participant_type: 'user',
          role_in_room: 'roleB',
          is_active: true,
          left_at: null,
        },
      ],
    };

    await expect(new ChatChannelService().getOrCreateWriteChannelForParticipant(
      room as never,
      'participant-a',
      'all' as never,
    )).resolves.toMatchObject({ id: 'shared-1' });

    expect(mockLockActiveRoleB).toHaveBeenCalledWith(prismaMock, 'room-1');
    expect(mockLockActiveRoleB.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.chatChannel.createMany.mock.invocationCallOrder[0],
    );
  });
});
