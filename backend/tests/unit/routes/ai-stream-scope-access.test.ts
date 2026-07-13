import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Errors } from '../../../src/utils/errors';

const mockResolveAccessibleChannel = jest.fn();
const mockGetRoom = jest.fn();
const mockResolveActiveHumanParticipant = jest.fn();
const mockGetInterviewSession = jest.fn();
const mockGetCaseById = jest.fn();
const mockAssertTrackAccess = jest.fn();

jest.mock('../../../src/services/chat-channel.service', () => ({
  chatChannelService: {
    resolveAccessibleChannel: (...args: unknown[]) => mockResolveAccessibleChannel(...args),
  },
}));
jest.mock('../../../src/services/chat.service', () => ({
  chatService: { getRoom: (...args: unknown[]) => mockGetRoom(...args) },
}));
jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: {
    resolveActiveHumanParticipant: (...args: unknown[]) => (
      mockResolveActiveHumanParticipant(...args)
    ),
  },
}));
jest.mock('../../../src/services/interview.service', () => ({
  interviewService: { getSession: (...args: unknown[]) => mockGetInterviewSession(...args) },
}));
jest.mock('../../../src/services/case.service', () => ({
  caseService: { getCaseById: (...args: unknown[]) => mockGetCaseById(...args) },
}));
jest.mock('../../../src/services/execution.service', () => ({
  executionService: { assertTrackAccess: (...args: unknown[]) => mockAssertTrackAccess(...args) },
}));

import {
  assertAIStreamScopeAccess,
  isAIStreamScopeType,
} from '../../../src/routes/ai-stream-scope-access';

describe('ai-stream-scope-access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recognizes chat_channel as an explicit AI stream scope', () => {
    expect(isAIStreamScopeType('chat_channel')).toBe(true);
    expect(isAIStreamScopeType('private_chat')).toBe(false);
  });

  it('delegates chat_channel authorization to the centralized channel service', async () => {
    mockResolveAccessibleChannel.mockResolvedValueOnce({
      channel: { id: 'channel-1', kind: 'private' },
      participant: { id: 'participant-1', role_in_room: 'roleA', joined_at: new Date() },
      room: { history_visibility_mode: 'share_from_join_time' },
    } as never);

    const result = await assertAIStreamScopeAccess('chat_channel', 'channel-1', {
      userId: 'user-1',
      sessionId: undefined,
    });

    expect(mockResolveAccessibleChannel).toHaveBeenCalledWith('channel-1', {
      userId: 'user-1',
      sessionId: undefined,
    });
    expect(mockGetRoom).not.toHaveBeenCalled();
    expect(result).toEqual({
      chatParticipantId: 'participant-1',
      replayNotBefore: undefined,
    });
  });

  it('returns the participant identity used to revoke an open chat_room stream', async () => {
    const joinedAt = new Date('2026-07-12T20:00:00.000Z');
    mockResolveActiveHumanParticipant.mockResolvedValueOnce({
      participant: {
        id: 'participant-room-b',
        role_in_room: 'roleB',
        joined_at: joinedAt,
      },
      room: { history_visibility_mode: 'share_from_join_time' },
    } as never);

    const result = await assertAIStreamScopeAccess('chat_room', 'room-1', {
      userId: 'user-b',
    });

    expect(result).toEqual({
      chatParticipantId: 'participant-room-b',
      replayNotBefore: joinedAt,
    });
    expect(mockResolveActiveHumanParticipant).toHaveBeenCalledWith('room-1', {
      userId: 'user-b',
    });
  });

  it.each([
    ['roleA', 'roleA', 'share_from_join_time'],
    ['roleB full history', 'roleB', 'share_full_history'],
  ] as const)('%s has no chat_room replay cutoff', async (_label, role, mode) => {
    mockResolveActiveHumanParticipant.mockResolvedValueOnce({
      participant: { id: 'participant-1', role_in_room: role, joined_at: new Date() },
      room: { history_visibility_mode: mode },
    } as never);

    await expect(assertAIStreamScopeAccess('chat_room', 'room-1', {
      userId: 'user-1',
    })).resolves.toEqual({
      chatParticipantId: 'participant-1',
      replayNotBefore: undefined,
    });
  });

  it('rejects a departed participant reconnect without falling back to room-level access', async () => {
    mockResolveActiveHumanParticipant.mockRejectedValueOnce(
      Errors.FORBIDDEN('只有聊天室中的有效參與者可執行此操作') as never,
    );

    await expect(assertAIStreamScopeAccess('chat_room', 'room-1', {
      userId: 'departed-user',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockGetRoom).not.toHaveBeenCalled();
  });

  it('propagates private channel denial without falling back to room access', async () => {
    mockResolveAccessibleChannel.mockRejectedValueOnce(
      Errors.FORBIDDEN('你沒有該私人對話空間權限') as never,
    );

    await expect(assertAIStreamScopeAccess('chat_channel', 'channel-b', {
      userId: 'user-a',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockGetRoom).not.toHaveBeenCalled();
  });
});
