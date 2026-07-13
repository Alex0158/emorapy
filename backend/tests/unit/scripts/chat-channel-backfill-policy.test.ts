import {
  buildBackfillEvidenceHash,
  classifyLegacyChatMessage,
  type LegacyMessageBackfillInput,
  summarizeChatChannelBackfillDecisions,
} from '../../../scripts/chat-channel-backfill-policy';

const JOINED_AT = new Date('2026-07-12T12:00:00.000Z');

function legacyMessage(
  overrides: Partial<LegacyMessageBackfillInput> = {},
): LegacyMessageBackfillInput {
  return {
    messageId: 'message-1',
    roomId: 'room-1',
    roomExists: true,
    historyVisibilityMode: 'share_from_join_time',
    visibilityScope: 'all',
    messageType: 'user_text',
    createdAt: new Date('2026-07-12T11:00:00.000Z'),
    senderParticipantId: 'participant-a',
    senderParticipantRoomId: 'room-1',
    senderParticipantType: 'user',
    senderRoleInRoom: 'roleA',
    roleBJoinedAt: JOINED_AT,
    activeRoleBCandidateCount: 1,
    roleAPrivateOwnerParticipantId: 'participant-a',
    roleAPrivateOwnerCandidateCount: 1,
    ...overrides,
  };
}

describe('chat-channel-backfill-policy', () => {
  it('owner_only always follows the human sender into that sender private channel', () => {
    const decision = classifyLegacyChatMessage(legacyMessage({
      visibilityScope: 'owner_only',
      senderParticipantId: 'participant-b',
      senderRoleInRoom: 'roleB',
    }));

    expect(decision).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-b',
      reasonCode: 'private_sender_owner_only',
      futureContextEligible: false,
    });
  });

  it('summary_only remains private and becomes a review candidate without auto-creating a capsule', () => {
    const decision = classifyLegacyChatMessage(legacyMessage({
      visibilityScope: 'summary_only',
    }));
    const summary = summarizeChatChannelBackfillDecisions([decision]);

    expect(decision).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_sender_summary_only',
      legacyReviewRequired: true,
      capsuleAction: 'legacy_review_required_no_create',
    });
    expect(summary).toMatchObject({
      legacyReviewRequired: 1,
      capsulesCreated: 0,
    });
  });

  it('pre-join shared history uses minimum disclosure unless full history had been selected', () => {
    const minimumDisclosure = classifyLegacyChatMessage(legacyMessage());
    const fullHistory = classifyLegacyChatMessage(legacyMessage({
      historyVisibilityMode: 'share_full_history',
    }));

    expect(minimumDisclosure).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_prejoin_minimum_disclosure',
    });
    expect(fullHistory).toMatchObject({
      target: 'shared',
      reasonCode: 'shared_full_history',
      futureContextEligible: true,
    });
  });

  it('a room that never had roleB keeps legacy human material in the unique roleA private channel', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      roleBJoinedAt: null,
      activeRoleBCandidateCount: 0,
    }))).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_prejoin_minimum_disclosure',
    });
  });

  it('a room that never had roleB keeps legacy AI material private when roleA is unique', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      roleBJoinedAt: null,
      activeRoleBCandidateCount: 0,
      senderParticipantId: 'ai-1',
      senderParticipantType: 'ai',
      senderRoleInRoom: 'aiMediator',
      messageType: 'ai_reflection',
    }))).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_prejoin_minimum_disclosure',
    });
  });

  it('a room without roleB quarantines legacy material when roleA owner is ambiguous', () => {
    const decision = classifyLegacyChatMessage(legacyMessage({
      roleBJoinedAt: null,
      activeRoleBCandidateCount: 0,
      senderParticipantId: 'ai-1',
      senderParticipantType: 'ai',
      senderRoleInRoom: 'aiMediator',
      messageType: 'ai_reflection',
      roleAPrivateOwnerParticipantId: null,
      roleAPrivateOwnerCandidateCount: 2,
    }));
    expect(decision).toMatchObject({
      target: 'quarantine',
      reasonCode: 'private_owner_unresolved',
    });
    expect(summarizeChatChannelBackfillDecisions([decision])).toMatchObject({
      quarantine: 1,
      quarantineByReason: { private_owner_unresolved: 1 },
    });
  });

  it('B1 left and B2 joined uses B2 active joined_at, keeping the between-period row private', () => {
    const b2JoinedAt = new Date('2026-07-12T14:00:00.000Z');
    expect(classifyLegacyChatMessage(legacyMessage({
      createdAt: new Date('2026-07-12T13:00:00.000Z'),
      roleBJoinedAt: b2JoinedAt,
      activeRoleBCandidateCount: 1,
    }))).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_prejoin_minimum_disclosure',
    });
  });

  it('multiple active roleB candidates quarantine instead of choosing MIN(joined_at)', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      activeRoleBCandidateCount: 2,
    }))).toMatchObject({
      target: 'quarantine',
      reasonCode: 'active_role_b_uniqueness_drift',
    });
  });

  it('routes inconsistent pre-join roleB material to the unique roleA owner, never roleB', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      senderParticipantId: 'participant-b',
      senderRoleInRoom: 'roleB',
    }))).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_prejoin_minimum_disclosure',
    });
  });

  it('pre-join safety notices stay private even under share_full_history', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      messageType: 'safety_notice',
      historyVisibilityMode: 'share_full_history',
    }))).toMatchObject({
      target: 'private',
      reasonCode: 'private_prejoin_safety_notice',
      futureContextEligible: false,
    });
  });

  it('post-join human user text enters shared context', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      createdAt: JOINED_AT,
      senderParticipantId: 'participant-b',
      senderRoleInRoom: 'roleB',
    }))).toMatchObject({
      target: 'shared',
      reasonCode: 'shared_post_join',
      futureContextEligible: true,
    });
  });

  it('legacy AI shared output remains displayable but never future-context eligible', () => {
    const decision = classifyLegacyChatMessage(legacyMessage({
      createdAt: new Date('2026-07-12T12:01:00.000Z'),
      senderParticipantId: 'ai-1',
      senderParticipantType: 'ai',
      senderRoleInRoom: 'aiMediator',
      messageType: 'ai_mediation',
    }));

    expect(decision).toMatchObject({
      target: 'shared',
      historicalDisplayEligible: true,
      futureContextEligible: false,
      legacyAiSharedDisplayOnly: true,
    });
    expect(summarizeChatChannelBackfillDecisions([decision]).legacyAiSharedDisplayOnly).toBe(1);
  });

  it('can infer unique roleA for pre-join AI material but quarantines ambiguous private ownership', () => {
    const inferred = classifyLegacyChatMessage(legacyMessage({
      senderParticipantId: 'ai-1',
      senderParticipantType: 'ai',
      senderRoleInRoom: 'aiMediator',
      messageType: 'ai_reflection',
    }));
    const ambiguous = classifyLegacyChatMessage(legacyMessage({
      senderParticipantId: 'ai-1',
      senderParticipantType: 'ai',
      senderRoleInRoom: 'aiMediator',
      messageType: 'ai_reflection',
      roleAPrivateOwnerParticipantId: null,
      roleAPrivateOwnerCandidateCount: 0,
    }));

    expect(inferred).toMatchObject({
      target: 'private',
      privateOwnerParticipantId: 'participant-a',
      reasonCode: 'private_prejoin_minimum_disclosure',
    });
    expect(ambiguous).toMatchObject({
      target: 'quarantine',
      reasonCode: 'private_owner_unresolved',
    });
  });

  it('never guesses an AI sender as owner of owner_only material', () => {
    expect(classifyLegacyChatMessage(legacyMessage({
      visibilityScope: 'owner_only',
      senderParticipantId: 'ai-1',
      senderParticipantType: 'ai',
      senderRoleInRoom: 'aiMediator',
    }))).toMatchObject({
      target: 'quarantine',
      reasonCode: 'private_owner_unresolved',
    });
  });

  it.each([
    [{ roomExists: false }, 'orphan_room'],
    [{ senderParticipantId: null }, 'orphan_sender'],
    [{ senderParticipantRoomId: 'room-other' }, 'orphan_sender_room_mismatch'],
    [{ visibilityScope: 'unknown_scope' }, 'unknown_visibility_scope'],
    [{ historyVisibilityMode: 'unknown_history' }, 'unknown_history_visibility_mode'],
  ] as const)('fails closed for invalid metadata %p', (overrides, reasonCode) => {
    expect(classifyLegacyChatMessage(legacyMessage(overrides))).toMatchObject({
      target: 'quarantine',
      reasonCode,
      historicalDisplayEligible: false,
      futureContextEligible: false,
    });
  });

  it('builds deterministic non-content hash evidence', () => {
    const first = classifyLegacyChatMessage(legacyMessage());
    const second = classifyLegacyChatMessage(legacyMessage({
      messageId: 'message-2',
      visibilityScope: 'summary_only',
    }));

    const digest = buildBackfillEvidenceHash([first, second]);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(buildBackfillEvidenceHash([second, first])).toBe(digest);
    expect(buildBackfillEvidenceHash([first])).not.toBe(digest);
  });
});
