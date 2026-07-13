const mockPrisma = {
  chatParticipant: {
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockResolveActiveHumanParticipant = jest.fn();
const mockLockActiveParticipant = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/services/chat-actor-access.service', () => ({
  __esModule: true,
  chatActorAccessService: {
    resolveActiveHumanParticipant: mockResolveActiveHumanParticipant,
    lockActiveParticipant: mockLockActiveParticipant,
  },
}));

import { ChatContextPreferenceService } from '../../../src/services/chat-context-preference.service';

describe('ChatContextPreferenceService actor ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async callback => callback(mockPrisma));
    mockPrisma.chatParticipant.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chatParticipant.findUniqueOrThrow.mockResolvedValue({
      id: 'participant-a',
      private_context_use_mode: 'shared_process_controls',
    });
  });

  it('只讀取 actor 自己的 preference', async () => {
    mockResolveActiveHumanParticipant.mockResolvedValue({
      participant: {
        id: 'participant-a',
        private_context_use_mode: 'shared_process_controls',
      },
    });

    const result = await new ChatContextPreferenceService().get('room-1', {
      userId: 'user-a',
    });

    expect(mockResolveActiveHumanParticipant).toHaveBeenCalledWith('room-1', { userId: 'user-a' });
    expect(result).toEqual({
      participantId: 'participant-a',
      mode: 'shared_process_controls',
    });
  });

  it('即使 actor payload 夾帶別人的 participantId，更新目標仍只取 resolver 的本人 id', async () => {
    mockResolveActiveHumanParticipant.mockResolvedValue({
      participant: {
        id: 'participant-a',
        private_context_use_mode: 'private_only',
      },
    });
    const service = new ChatContextPreferenceService();
    const actorWithInjectedParticipantId = {
      userId: 'user-a',
      participantId: 'participant-b',
    };
    const result = await service.update(
      'room-1',
      actorWithInjectedParticipantId,
      'shared_process_controls'
    );

    expect(mockResolveActiveHumanParticipant).toHaveBeenCalledWith(
      'room-1',
      actorWithInjectedParticipantId,
      mockPrisma,
    );
    expect(mockLockActiveParticipant).toHaveBeenCalledWith(
      mockPrisma,
      'room-1',
      'participant-a',
    );
    expect(mockPrisma.chatParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'participant-a',
        room_id: 'room-1',
        participant_type: 'user',
        is_active: true,
        left_at: null,
      },
      data: { private_context_use_mode: 'shared_process_controls' },
    });
    expect(JSON.stringify(mockPrisma.chatParticipant.updateMany.mock.calls)).not.toContain(
      'participant-b'
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(result).toEqual({
      participantId: 'participant-a',
      mode: 'shared_process_controls',
    });
  });

  it('participant 在 resolver 後被 kick/leave 時 fail closed 且不更新 preference', async () => {
    mockResolveActiveHumanParticipant.mockResolvedValue({
      participant: {
        id: 'participant-a',
        private_context_use_mode: 'private_only',
      },
    });
    mockLockActiveParticipant.mockRejectedValue(
      Object.assign(new Error('聊天室參與者權限已失效'), { code: 'FORBIDDEN' }),
    );

    await expect(new ChatContextPreferenceService().update(
      'room-1',
      { userId: 'user-a' },
      'shared_process_controls',
    )).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockPrisma.chatParticipant.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.chatParticipant.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
