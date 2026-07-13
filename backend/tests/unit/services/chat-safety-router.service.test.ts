import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockPrisma = {
  chatSafetyRouterState: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  contextUseAudit: { create: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};
const mockResolveActiveHumanParticipant = jest.fn();

type SqlToken = {
  strings: TemplateStringsArray;
  values: unknown[];
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: {
    resolveActiveHumanParticipant: (...args: unknown[]) => (
      mockResolveActiveHumanParticipant(...args)
    ),
  },
}));

import {
  CHAT_SAFETY_ROUTER_POLICY_VERSION,
  ChatSafetyRouterService,
  mapJudgmentRouteToSafetyAction,
} from '../../../src/services/chat-safety-router.service';

describe('ChatSafetyRouterService', () => {
  const service = new ChatSafetyRouterService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => (
      (callback as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma)
    ));
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'owner-a' }] as never);
    mockPrisma.chatSafetyRouterState.findUnique.mockResolvedValue(null as never);
    mockPrisma.chatSafetyRouterState.findMany.mockResolvedValue([] as never);
    mockPrisma.chatSafetyRouterState.create.mockImplementation(async (input: unknown) => ({
      id: 'state-1',
      ...(input as { data: Record<string, unknown> }).data,
    }) as never);
    mockPrisma.contextUseAudit.create.mockResolvedValue({ id: 'audit-1' } as never);
    mockResolveActiveHumanParticipant.mockResolvedValue({ participant: { id: 'owner-a' } } as never);
  });

  it('maps existing safety routes deterministically and maps unknown routes fail closed', () => {
    expect(mapJudgmentRouteToSafetyAction('standard')).toBe('continue');
    expect(mapJudgmentRouteToSafetyAction('safety_support')).toBe('block_joint_repair');
    expect(mapJudgmentRouteToSafetyAction('crisis_support')).toBe('crisis_support');
    expect(mapJudgmentRouteToSafetyAction('future_unknown')).toBe('crisis_support');
  });

  it('persists an action-only state and content-free audit', async () => {
    await service.activateForRoute({
      roomId: 'room-1',
      ownerParticipantId: 'owner-a',
      route: 'safety_support',
    });

    expect(mockPrisma.chatSafetyRouterState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        room_id: 'room-1',
        owner_participant_id: 'owner-a',
        action: 'block_joint_repair',
        policy_version: CHAT_SAFETY_ROUTER_POLICY_VERSION,
        state_version: 1,
      }),
    });
    const stateData = mockPrisma.chatSafetyRouterState.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(stateData.data).not.toHaveProperty('content');
    expect(stateData.data).not.toHaveProperty('topic');
    expect(stateData.data).not.toHaveProperty('diagnosis');
    expect(stateData.data).not.toHaveProperty('reason');
    expect(mockPrisma.contextUseAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason_code: 'safety_router_state_activated',
        source_refs: [],
        authorization_refs: [],
        content_hashes: [],
      }),
    });
  });

  it('can linearize private message persistence and safety activation in the caller transaction', async () => {
    const result = await service.activateForRouteWithClient({
      roomId: 'room-1',
      ownerParticipantId: 'owner-a',
      route: 'crisis_support',
    }, mockPrisma as never);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.chatSafetyRouterState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'crisis_support' }),
    });
    expect(mockPrisma.contextUseAudit.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      changed: true,
      sharedStatusChanged: true,
    }));
  });

  it('locks a parameterized active human owner row before reading safety state', async () => {
    await service.activateForRouteWithClient({
      roomId: 'room-1',
      ownerParticipantId: 'owner-a',
      route: 'crisis_support',
    }, mockPrisma as never);

    const token = mockPrisma.$queryRaw.mock.calls[0]?.[0] as SqlToken;
    const sql = token.strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain("participant_type\" = 'user'");
    expect(sql).toContain("role_in_room\" IN ('roleA', 'roleB')");
    expect(sql).toContain('is_active\" = true');
    expect(sql).toContain('left_at\" IS NULL');
    expect(sql).toContain('FOR UPDATE');
    expect(token.values).toEqual(['owner-a', 'room-1']);
    expect(mockPrisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.chatSafetyRouterState.findUnique.mock.invocationCallOrder[0],
    );
  });

  it('fails closed before safety state access when the owner is no longer active', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([] as never);

    await expect(service.activateForRouteWithClient({
      roomId: 'room-1',
      ownerParticipantId: 'owner-a',
      route: 'crisis_support',
    }, mockPrisma as never)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockPrisma.chatSafetyRouterState.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.chatSafetyRouterState.create).not.toHaveBeenCalled();
    expect(mockPrisma.contextUseAudit.create).not.toHaveBeenCalled();
  });

  it('never lets a later standard message automatically clear a stronger state', async () => {
    const existing = {
      id: 'state-1',
      action: 'crisis_support',
      state_version: 2,
    };
    mockPrisma.chatSafetyRouterState.findUnique.mockResolvedValue(existing as never);

    const result = await service.activateForRoute({
      roomId: 'room-1',
      ownerParticipantId: 'owner-a',
      route: 'standard',
    });

    expect(result).toBe(existing);
    expect(mockPrisma.chatSafetyRouterState.update).not.toHaveBeenCalled();
    expect(mockPrisma.contextUseAudit.create).not.toHaveBeenCalled();
  });

  it('never overwrites an unknown stored action with a weaker known action', async () => {
    const existing = {
      id: 'state-corrupt',
      action: 'future_action',
      state_version: 9,
    };
    mockPrisma.chatSafetyRouterState.findUnique.mockResolvedValue(existing as never);

    const result = await service.activateForRoute({
      roomId: 'room-1',
      ownerParticipantId: 'owner-a',
      route: 'standard',
    });

    expect(result).toBe(existing);
    expect(mockPrisma.chatSafetyRouterState.update).not.toHaveBeenCalled();
  });

  it('blocks shared messaging and formal analysis for pause/crisis, and joint repair for block state', async () => {
    mockPrisma.chatSafetyRouterState.findMany.mockResolvedValue([
      { action: 'pause_shared' },
    ] as never);
    await expect(service.assertSharedMessagingAllowed('room-1')).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
    await expect(service.assertFormalAnalysisAllowed('room-1')).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
    });
    await expect(service.assertJointRepairAllowed('room-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    mockPrisma.chatSafetyRouterState.findMany.mockResolvedValue([
      { action: 'block_joint_repair' },
    ] as never);
    await expect(service.assertSharedMessagingAllowed('room-1')).resolves.toBeUndefined();
    await expect(service.assertFormalAnalysisAllowed('room-1')).resolves.toBeUndefined();
    await expect(service.assertJointRepairAllowed('room-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('treats an unknown persisted action as fully blocked', async () => {
    mockPrisma.chatSafetyRouterState.findMany.mockResolvedValue([
      { action: 'unexpected_action' },
    ] as never);

    await expect(service.assertSharedMessagingAllowed('room-1')).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
    await expect(service.assertFormalAnalysisAllowed('room-1')).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
    });
    await expect(service.assertJointRepairAllowed('room-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns only a sanitized shared status after participant access succeeds', async () => {
    mockPrisma.chatSafetyRouterState.findMany.mockResolvedValue([
      { action: 'crisis_support' },
    ] as never);

    const result = await service.getSanitizedSharedStatus('room-1', { userId: 'user-a' });

    expect(mockResolveActiveHumanParticipant).toHaveBeenCalledWith(
      'room-1',
      { userId: 'user-a' },
    );
    expect(result).toEqual({ status: 'paused' });
    expect(Object.keys(result)).toEqual(['status']);
  });

  it('does not convert storage failures into an open state', async () => {
    mockPrisma.chatSafetyRouterState.findMany.mockRejectedValue(new Error('db unavailable') as never);

    await expect(service.assertSharedMessagingAllowed('room-1')).rejects.toThrow('db unavailable');
  });

  it('ignores safety state owned by a participant who is no longer active', async () => {
    await service.assertSharedMessagingAllowed('room-1');

    expect(mockPrisma.chatSafetyRouterState.findMany).toHaveBeenCalledWith({
      where: {
        room_id: 'room-1',
        owner_participant: {
          participant_type: 'user',
          role_in_room: { in: ['roleA', 'roleB'] },
          is_active: true,
          left_at: null,
        },
      },
      select: { action: true },
    });
  });
});
