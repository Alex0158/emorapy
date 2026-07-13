import { createHash } from 'node:crypto';

export const CHAT_CHANNEL_BACKFILL_POLICY_VERSION = 'chat-channel-backfill@v1';

export type LegacyVisibilityScope = 'all' | 'owner_only' | 'summary_only' | string;
export type LegacyHistoryVisibilityMode =
  | 'share_full_history'
  | 'share_summary_only'
  | 'share_from_join_time'
  | string;

export type LegacyMessageBackfillInput = {
  messageId: string;
  roomId: string;
  roomExists: boolean;
  historyVisibilityMode: LegacyHistoryVisibilityMode | null;
  visibilityScope: LegacyVisibilityScope;
  messageType: string;
  createdAt: Date;
  senderParticipantId: string | null;
  senderParticipantRoomId: string | null;
  senderParticipantType: string | null;
  senderRoleInRoom: string | null;
  roleBJoinedAt: Date | null;
  activeRoleBCandidateCount: number;
  roleAPrivateOwnerParticipantId: string | null;
  roleAPrivateOwnerCandidateCount: number;
};

export type BackfillCapsuleAction = 'none' | 'legacy_review_required_no_create';
export type BackfillTarget = 'shared' | 'private' | 'quarantine';

export type ChatChannelBackfillDecision = {
  messageId: string;
  roomId: string;
  target: BackfillTarget;
  privateOwnerParticipantId: string | null;
  reasonCode:
    | 'shared_post_join'
    | 'shared_full_history'
    | 'private_sender_owner_only'
    | 'private_sender_summary_only'
    | 'private_prejoin_minimum_disclosure'
    | 'private_prejoin_safety_notice'
    | 'orphan_room'
    | 'orphan_sender'
    | 'orphan_sender_room_mismatch'
    | 'unknown_history_visibility_mode'
    | 'unknown_visibility_scope'
    | 'active_role_b_unresolved'
    | 'active_role_b_uniqueness_drift'
    | 'private_owner_unresolved';
  legacyReviewRequired: boolean;
  capsuleAction: BackfillCapsuleAction;
  historicalDisplayEligible: boolean;
  futureContextEligible: boolean;
  legacyAiSharedDisplayOnly: boolean;
};

const HUMAN_PRIVATE_ROLES = new Set(['roleA', 'roleB']);
const KNOWN_HISTORY_MODES = new Set([
  'share_full_history',
  'share_summary_only',
  'share_from_join_time',
]);

function quarantine(
  input: LegacyMessageBackfillInput,
  reasonCode: Extract<ChatChannelBackfillDecision['reasonCode'],
    | 'orphan_room'
    | 'orphan_sender'
    | 'orphan_sender_room_mismatch'
    | 'unknown_history_visibility_mode'
    | 'unknown_visibility_scope'
    | 'active_role_b_unresolved'
    | 'active_role_b_uniqueness_drift'
    | 'private_owner_unresolved'>,
  legacyReviewRequired = false,
): ChatChannelBackfillDecision {
  return {
    messageId: input.messageId,
    roomId: input.roomId,
    target: 'quarantine',
    privateOwnerParticipantId: null,
    reasonCode,
    legacyReviewRequired,
    capsuleAction: legacyReviewRequired ? 'legacy_review_required_no_create' : 'none',
    historicalDisplayEligible: false,
    futureContextEligible: false,
    legacyAiSharedDisplayOnly: false,
  };
}

function privateDecision(
  input: LegacyMessageBackfillInput,
  ownerParticipantId: string,
  reasonCode: Extract<ChatChannelBackfillDecision['reasonCode'],
    | 'private_sender_owner_only'
    | 'private_sender_summary_only'
    | 'private_prejoin_minimum_disclosure'
    | 'private_prejoin_safety_notice'>,
  legacyReviewRequired = false,
): ChatChannelBackfillDecision {
  return {
    messageId: input.messageId,
    roomId: input.roomId,
    target: 'private',
    privateOwnerParticipantId: ownerParticipantId,
    reasonCode,
    legacyReviewRequired,
    capsuleAction: legacyReviewRequired ? 'legacy_review_required_no_create' : 'none',
    historicalDisplayEligible: true,
    // A legacy private transcript never becomes reusable memory merely because it was backfilled.
    futureContextEligible: false,
    legacyAiSharedDisplayOnly: false,
  };
}

function sharedDecision(
  input: LegacyMessageBackfillInput,
  reasonCode: Extract<ChatChannelBackfillDecision['reasonCode'],
    | 'shared_post_join'
    | 'shared_full_history'>,
): ChatChannelBackfillDecision {
  const isHumanUserText = input.senderParticipantType === 'user'
    && HUMAN_PRIVATE_ROLES.has(input.senderRoleInRoom ?? '')
    && input.messageType === 'user_text';
  const isLegacyAi = input.senderParticipantType === 'ai'
    || input.senderRoleInRoom === 'aiMediator'
    || input.messageType.startsWith('ai_');

  return {
    messageId: input.messageId,
    roomId: input.roomId,
    target: 'shared',
    privateOwnerParticipantId: null,
    reasonCode,
    legacyReviewRequired: false,
    capsuleAction: 'none',
    historicalDisplayEligible: true,
    // Legacy AI/system output remains displayable but is never future-context evidence.
    futureContextEligible: isHumanUserText,
    legacyAiSharedDisplayOnly: isLegacyAi,
  };
}

function resolveSenderPrivateOwner(input: LegacyMessageBackfillInput): string | null {
  if (
    input.senderParticipantType !== 'user'
    || !HUMAN_PRIVATE_ROLES.has(input.senderRoleInRoom ?? '')
  ) {
    return null;
  }
  return input.senderParticipantId;
}

function resolvePrejoinPrivateOwner(input: LegacyMessageBackfillInput): string | null {
  if (
    input.senderParticipantType === 'user'
    && input.senderRoleInRoom === 'roleA'
    && input.senderParticipantId
  ) {
    return input.senderParticipantId;
  }

  if (
    input.roleAPrivateOwnerCandidateCount === 1
    && input.roleAPrivateOwnerParticipantId
  ) {
    return input.roleAPrivateOwnerParticipantId;
  }
  return null;
}

/**
 * Classifies one legacy `channel_id IS NULL` message without reading its content.
 * Any ambiguous private owner fails closed into quarantine and is never written.
 */
export function classifyLegacyChatMessage(
  input: LegacyMessageBackfillInput,
): ChatChannelBackfillDecision {
  if (!input.roomExists) return quarantine(input, 'orphan_room');
  if (!input.senderParticipantId) return quarantine(input, 'orphan_sender');
  if (input.senderParticipantRoomId !== input.roomId) {
    return quarantine(input, 'orphan_sender_room_mismatch');
  }
  if (!input.historyVisibilityMode || !KNOWN_HISTORY_MODES.has(input.historyVisibilityMode)) {
    return quarantine(input, 'unknown_history_visibility_mode');
  }

  if (input.visibilityScope === 'owner_only' || input.visibilityScope === 'summary_only') {
    const senderOwner = resolveSenderPrivateOwner(input);
    const legacyReviewRequired = input.visibilityScope === 'summary_only';
    if (!senderOwner) return quarantine(input, 'private_owner_unresolved', legacyReviewRequired);
    return privateDecision(
      input,
      senderOwner,
      legacyReviewRequired ? 'private_sender_summary_only' : 'private_sender_owner_only',
      legacyReviewRequired,
    );
  }

  if (input.visibilityScope !== 'all') {
    return quarantine(input, 'unknown_visibility_scope');
  }

  if (input.activeRoleBCandidateCount > 1) {
    return quarantine(input, 'active_role_b_uniqueness_drift');
  }
  if (input.activeRoleBCandidateCount === 1 && !input.roleBJoinedAt) {
    return quarantine(input, 'active_role_b_unresolved');
  }

  const isPrejoin = !input.roleBJoinedAt || input.createdAt < input.roleBJoinedAt;

  if (isPrejoin && input.messageType === 'safety_notice') {
    const owner = resolvePrejoinPrivateOwner(input);
    return owner
      ? privateDecision(input, owner, 'private_prejoin_safety_notice')
      : quarantine(input, 'private_owner_unresolved');
  }

  if (!isPrejoin) return sharedDecision(input, 'shared_post_join');
  if (input.historyVisibilityMode === 'share_full_history') {
    return sharedDecision(input, 'shared_full_history');
  }

  const owner = resolvePrejoinPrivateOwner(input);
  return owner
    ? privateDecision(input, owner, 'private_prejoin_minimum_disclosure')
    : quarantine(input, 'private_owner_unresolved');
}

export type ChatChannelBackfillDecisionSummary = {
  scanned: number;
  shared: number;
  private: number;
  quarantine: number;
  legacyReviewRequired: number;
  capsulesCreated: 0;
  legacyAiSharedDisplayOnly: number;
  futureContextEligible: number;
  quarantineByReason: Record<string, number>;
  orphanByReason: Record<string, number>;
};

export function summarizeChatChannelBackfillDecisions(
  decisions: ChatChannelBackfillDecision[],
): ChatChannelBackfillDecisionSummary {
  const quarantineByReason: Record<string, number> = {};
  const orphanByReason: Record<string, number> = {};

  for (const decision of decisions) {
    if (decision.target !== 'quarantine') continue;
    quarantineByReason[decision.reasonCode] = (quarantineByReason[decision.reasonCode] ?? 0) + 1;
    if (decision.reasonCode.startsWith('orphan_')) {
      orphanByReason[decision.reasonCode] = (orphanByReason[decision.reasonCode] ?? 0) + 1;
    }
  }

  return {
    scanned: decisions.length,
    shared: decisions.filter((decision) => decision.target === 'shared').length,
    private: decisions.filter((decision) => decision.target === 'private').length,
    quarantine: decisions.filter((decision) => decision.target === 'quarantine').length,
    legacyReviewRequired: decisions.filter((decision) => decision.legacyReviewRequired).length,
    // Legacy summary_only raw text must be regenerated and approved by its owner.
    capsulesCreated: 0,
    legacyAiSharedDisplayOnly: decisions.filter((decision) => (
      decision.target === 'shared'
      && decision.historicalDisplayEligible
      && decision.legacyAiSharedDisplayOnly
    )).length,
    futureContextEligible: decisions.filter((decision) => decision.futureContextEligible).length,
    quarantineByReason,
    orphanByReason,
  };
}

/** Builds deterministic non-content evidence for one batch. Raw IDs are hashed, never emitted. */
export function buildBackfillEvidenceHash(
  decisions: ChatChannelBackfillDecision[],
): string {
  const evidence = decisions
    .map((decision) => [
      decision.messageId,
      decision.roomId,
      decision.target,
      decision.privateOwnerParticipantId ?? '',
      decision.reasonCode,
      decision.capsuleAction,
      decision.historicalDisplayEligible ? 'display' : 'hidden',
      decision.futureContextEligible ? 'future-context' : 'no-future-context',
      decision.legacyAiSharedDisplayOnly ? 'legacy-ai-display-only' : '',
    ].join('\u001f'))
    .sort()
    .join('\u001e');

  return createHash('sha256').update(evidence).digest('hex');
}
