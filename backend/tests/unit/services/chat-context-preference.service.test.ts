const mockPrisma = {
  chatParticipant: {
    updateMany: jest.fn(),
  },
  chatRoom: { findUniqueOrThrow: jest.fn() },
  contextUseAudit: { create: jest.fn() },
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
import { CHAT_ADAPTATION_POLICY_VERSION } from '../../../src/utils/chat-context-validation';

const NOW = new Date('2026-07-13T19:00:00.000Z');

function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-a',
    participant_type: 'user',
    role_in_room: 'roleA',
    is_active: true,
    left_at: null,
    private_context_use_mode: 'private_only',
    private_context_policy_version: null,
    private_context_preference_updated_at: null,
    shared_adaptation_consent: 'not_set',
    shared_adaptation_policy_version: null,
    shared_adaptation_decided_at: null,
    ...overrides,
  };
}

function room(participants = [participant()]) {
  return { id: 'room-1', participants };
}

describe('ChatContextPreferenceService actor ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async callback => callback(mockPrisma));
    mockLockActiveParticipant.mockResolvedValue(undefined);
    mockPrisma.chatParticipant.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.contextUseAudit.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('只讀取 actor 自己的 preference', async () => {
    const current = participant({
      private_context_use_mode: 'shared_process_controls',
      private_context_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      private_context_preference_updated_at: NOW,
    });
    mockResolveActiveHumanParticipant.mockResolvedValue({
      room: room([current]),
      participant: current,
    });

    const result = await new ChatContextPreferenceService().get('room-1', {
      userId: 'user-a',
    });

    expect(mockResolveActiveHumanParticipant).toHaveBeenCalledWith('room-1', { userId: 'user-a' });
    expect(result).toEqual({
      participant_id: 'participant-a',
      mode: 'shared_process_controls',
      mode_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      mode_updated_at: NOW.toISOString(),
      adaptation_decision: 'not_set',
      adaptation_policy_version: null,
      adaptation_decided_at: null,
      room_adaptation: {
        policy_version: CHAT_ADAPTATION_POLICY_VERSION,
        enabled: false,
        active_participant_count: 1,
        accepted_participant_count: 0,
        owner_opt_in_count: 1,
      },
    });
  });

  it('即使 actor payload 夾帶別人的 participantId，更新目標仍只取 resolver 的本人 id', async () => {
    const before = participant();
    const after = participant({
      private_context_use_mode: 'shared_process_controls',
      private_context_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      private_context_preference_updated_at: NOW,
    });
    mockResolveActiveHumanParticipant.mockResolvedValue({ participant: before });
    mockPrisma.chatRoom.findUniqueOrThrow.mockResolvedValue(room([after]));
    const service = new ChatContextPreferenceService();
    const actorWithInjectedParticipantId = {
      userId: 'user-a',
      participantId: 'participant-b',
    };
    const result = await service.update(
      'room-1',
      actorWithInjectedParticipantId,
      'shared_process_controls',
      CHAT_ADAPTATION_POLICY_VERSION,
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
      data: {
        private_context_use_mode: 'shared_process_controls',
        private_context_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
        private_context_preference_updated_at: expect.any(Date),
      },
    });
    expect(JSON.stringify(mockPrisma.chatParticipant.updateMany.mock.calls)).not.toContain(
      'participant-b'
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(result).toMatchObject({
      participant_id: 'participant-a',
      mode: 'shared_process_controls',
      room_adaptation: { owner_opt_in_count: 1, enabled: false },
    });
    expect(mockPrisma.contextUseAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor_participant_id: 'participant-a',
        purpose: 'shared_mediation_adaptation',
        decision: 'allowed',
        reason_code: 'private_adaptation_authorization_granted',
      }),
    });
  });

  it('participant 在 resolver 後被 kick/leave 時 fail closed 且不更新 preference', async () => {
    mockResolveActiveHumanParticipant.mockResolvedValue({ participant: participant() });
    mockLockActiveParticipant.mockRejectedValue(
      Object.assign(new Error('聊天室參與者權限已失效'), { code: 'FORBIDDEN' }),
    );

    await expect(new ChatContextPreferenceService().update(
      'room-1',
      { userId: 'user-a' },
      'shared_process_controls',
      CHAT_ADAPTATION_POLICY_VERSION,
    )).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockPrisma.chatParticipant.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.chatRoom.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('只有所有 active participants 接受 current policy 才回傳 enabled', async () => {
    const actor = participant({
      private_context_use_mode: 'shared_process_controls',
      private_context_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      private_context_preference_updated_at: NOW,
      shared_adaptation_consent: 'accepted',
      shared_adaptation_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      shared_adaptation_decided_at: NOW,
    });
    const partner = participant({
      id: 'participant-b',
      role_in_room: 'roleB',
      shared_adaptation_consent: 'accepted',
      shared_adaptation_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      shared_adaptation_decided_at: NOW,
    });
    mockResolveActiveHumanParticipant.mockResolvedValue({ participant: actor });
    mockPrisma.chatRoom.findUniqueOrThrow.mockResolvedValue(room([actor, partner]));

    const result = await new ChatContextPreferenceService().updateAdaptationConsent(
      'room-1',
      { userId: 'user-a' },
      'accepted',
      CHAT_ADAPTATION_POLICY_VERSION,
    );

    expect(result.room_adaptation).toMatchObject({
      enabled: true,
      active_participant_count: 2,
      accepted_participant_count: 2,
      owner_opt_in_count: 1,
    });
    expect(mockPrisma.chatParticipant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        shared_adaptation_consent: 'accepted',
        shared_adaptation_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
      }),
    }));
  });
});
