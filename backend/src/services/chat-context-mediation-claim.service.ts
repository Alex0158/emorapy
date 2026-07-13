import {
  ChatRoleInRoom,
  ContextAudience,
  ContextPurpose,
  ContextTargetType,
  ContextUseDecision,
  PrivateContextUseMode,
  Prisma,
} from '@prisma/client';
import prisma from '../config/database';
import { getAIPromptVersion } from '../utils/ai-prompt-version';
import {
  CHAT_ADAPTATION_POLICY_VERSION,
  CHAT_CONTEXT_POLICY_VERSION,
  canonicalSha256,
} from '../utils/chat-context-validation';
import type { MediationControls } from './mediation-strategy.service';
import { chatSafetyRouterService } from './chat-safety-router.service';

type RoomWithParticipants = Prisma.ChatRoomGetPayload<{
  include: { participants: true };
}>;

export type SharedMediationCapsule = {
  id: string;
  summary: string;
  contentHash: string;
  authorizationIds: string[];
};

export type SharedMediationCapsuleCandidate = {
  id: string;
  room_id: string;
  owner_participant_id: string;
  summary: string;
  content_hash: string;
  policy_version: string;
  status: string;
  expires_at: Date | null;
  revoked_at: Date | null;
  authorizations: Array<{
    id: string;
    subject_participant_id: string;
    purpose: ContextPurpose;
    audience: ContextAudience;
    target_type: ContextTargetType;
    target_id: string;
    capsule_content_hash: string;
    policy_version: string;
    expires_at: Date | null;
    revoked_at: Date | null;
  }>;
};

export type ResolvedAdaptationControls = {
  controls: MediationControls;
  participantSnapshotHash: string;
};

export function activeHumanParticipants(participants: RoomWithParticipants['participants']) {
  return participants.filter(participant => (
    participant.participant_type === 'user'
    && participant.is_active
    && participant.left_at === null
    && (
      participant.role_in_room === ChatRoleInRoom.roleA
      || participant.role_in_room === ChatRoleInRoom.roleB
    )
  ));
}

export function adaptationParticipantSnapshotHash(
  participants: RoomWithParticipants['participants'],
): string {
  return canonicalSha256(activeHumanParticipants(participants)
    .map(participant => ({
      id: participant.id,
      joinedAt: participant.joined_at.toISOString(),
      mode: participant.private_context_use_mode,
      modePolicyVersion: participant.private_context_policy_version,
      modeUpdatedAt: participant.private_context_preference_updated_at?.toISOString() ?? null,
      adaptationDecision: participant.shared_adaptation_consent,
      adaptationPolicyVersion: participant.shared_adaptation_policy_version,
      adaptationDecidedAt: participant.shared_adaptation_decided_at?.toISOString() ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)));
}

export function exactSharedMediationCapsules(
  candidates: SharedMediationCapsuleCandidate[],
  roomId: string,
  now: Date,
): SharedMediationCapsule[] {
  return candidates.flatMap(capsule => {
    if (
      capsule.room_id !== roomId
      || capsule.status !== 'approved'
      || capsule.policy_version !== CHAT_CONTEXT_POLICY_VERSION
      || capsule.revoked_at !== null
      || !capsule.expires_at
      || capsule.expires_at.getTime() <= now.getTime()
    ) return [];

    const exactActiveAuthorizations = capsule.authorizations.filter(
      authorization =>
        authorization.subject_participant_id === capsule.owner_participant_id
        && authorization.purpose === ContextPurpose.shared_mediation
        && authorization.audience === ContextAudience.room_participants
        && authorization.target_type === ContextTargetType.chat_room
        && authorization.target_id === roomId
        && authorization.capsule_content_hash === capsule.content_hash
        && authorization.policy_version === capsule.policy_version
        && authorization.policy_version === CHAT_CONTEXT_POLICY_VERSION
        && authorization.revoked_at === null
        && authorization.expires_at !== null
        && authorization.expires_at.getTime() > now.getTime()
    );
    if (exactActiveAuthorizations.length === 0) return [];

    return [{
      id: capsule.id,
      summary: capsule.summary,
      contentHash: capsule.content_hash,
      authorizationIds: exactActiveAuthorizations.map(authorization => authorization.id),
    }];
  });
}

export class ChatContextMediationClaimService {
  async claimOwnerStrategyCompilation(input: {
    roomId: string;
    ownerParticipantId: string;
    participantSnapshotHash: string;
    sourceRefs: string[];
    contentHashes: string[];
  }): Promise<boolean> {
    return prisma.$transaction(async tx => {
      // This lock gives consent/membership mutations and provider claims one
      // durable order. A mutation that wins leaves the provider invocation at zero.
      await tx.$queryRaw`
        SELECT "id"
        FROM "chat_participants"
        WHERE "room_id" = ${input.roomId}
          AND "participant_type" = 'user'
          AND "role_in_room" IN ('roleA', 'roleB')
        ORDER BY "id"
        FOR UPDATE
      `;
      await chatSafetyRouterService.assertSharedMessagingAllowed(input.roomId, tx);
      const currentRoom = await tx.chatRoom.findUnique({
        where: { id: input.roomId },
        include: { participants: true },
      });
      if (
        !currentRoom
        || adaptationParticipantSnapshotHash(currentRoom.participants)
          !== input.participantSnapshotHash
      ) return false;

      const owner = activeHumanParticipants(currentRoom.participants)
        .find(participant => participant.id === input.ownerParticipantId);
      if (
        !owner
        || owner.private_context_use_mode !== PrivateContextUseMode.shared_process_controls
        || owner.private_context_policy_version !== CHAT_ADAPTATION_POLICY_VERSION
        || owner.private_context_preference_updated_at === null
      ) return false;

      await tx.contextUseAudit.create({
        data: {
          room_id: input.roomId,
          actor_participant_id: owner.id,
          purpose: ContextPurpose.shared_mediation_adaptation,
          audience: ContextAudience.room_participants,
          target_type: ContextTargetType.chat_room,
          target_id: input.roomId,
          decision: ContextUseDecision.allowed,
          reason_code: 'owner_strategy_compilation_requested',
          source_refs: input.sourceRefs,
          authorization_refs: [],
          content_hashes: input.contentHashes,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
          prompt_version: getAIPromptVersion('chat_mediation_strategy'),
        },
      });
      return true;
    }, { isolationLevel: 'ReadCommitted' });
  }

  async claimSharedMediationUses(input: {
    roomId: string;
    adaptation: ResolvedAdaptationControls | null;
    capsules: SharedMediationCapsule[];
  }): Promise<{ controls: MediationControls | null; capsules: SharedMediationCapsule[] }> {
    return prisma.$transaction(async tx => {
      // Safety activation and provider claims use the same participant lock
      // order. A safety transition that commits first blocks this claim; a
      // claim that commits first owns only the already-started provider use.
      await tx.$queryRaw`
        SELECT "id"
        FROM "chat_participants"
        WHERE "room_id" = ${input.roomId}
          AND "participant_type" = 'user'
          AND "role_in_room" IN ('roleA', 'roleB')
        ORDER BY "id"
        FOR UPDATE
      `;
      await chatSafetyRouterService.assertSharedMessagingAllowed(input.roomId, tx);

      if (input.capsules.length > 0) {
        await tx.$queryRaw`
          SELECT "id"
          FROM "context_capsules"
          WHERE "room_id" = ${input.roomId}
          ORDER BY "id"
          FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT authorization."id"
          FROM "context_authorizations" AS authorization
          INNER JOIN "context_capsules" AS capsule
            ON capsule."id" = authorization."capsule_id"
          WHERE capsule."room_id" = ${input.roomId}
          ORDER BY authorization."id"
          FOR UPDATE OF authorization
        `;
      }

      let controls: MediationControls | null = null;
      if (input.adaptation) {
        const currentRoom = await tx.chatRoom.findUnique({
          where: { id: input.roomId },
          include: { participants: true },
        });
        if (
          currentRoom
          && adaptationParticipantSnapshotHash(currentRoom.participants)
            === input.adaptation.participantSnapshotHash
        ) {
          controls = input.adaptation.controls;
          await tx.contextUseAudit.create({
            data: {
              room_id: input.roomId,
              purpose: ContextPurpose.shared_mediation_adaptation,
              audience: ContextAudience.room_participants,
              target_type: ContextTargetType.chat_room,
              target_id: input.roomId,
              decision: ContextUseDecision.allowed,
              reason_code: 'owner_strategy_controls_merged',
              source_refs: [],
              authorization_refs: [],
              content_hashes: [canonicalSha256(controls)],
              policy_version: CHAT_CONTEXT_POLICY_VERSION,
              prompt_version: getAIPromptVersion('chat_room_ai_response'),
            },
          });
        }
      }

      let capsules: SharedMediationCapsule[] = [];
      if (input.capsules.length > 0) {
        const now = new Date();
        const currentCandidates = await tx.contextCapsule.findMany({
          where: {
            id: { in: input.capsules.map(capsule => capsule.id) },
            room_id: input.roomId,
            policy_version: CHAT_CONTEXT_POLICY_VERSION,
            status: 'approved',
            revoked_at: null,
            expires_at: { gt: now },
            owner_participant: {
              is: { participant_type: 'user', is_active: true, left_at: null },
            },
            authorizations: {
              some: {
                purpose: ContextPurpose.shared_mediation,
                audience: ContextAudience.room_participants,
                target_type: ContextTargetType.chat_room,
                target_id: input.roomId,
                policy_version: CHAT_CONTEXT_POLICY_VERSION,
                revoked_at: null,
                expires_at: { gt: now },
              },
            },
          },
          include: {
            authorizations: {
              where: {
                purpose: ContextPurpose.shared_mediation,
                audience: ContextAudience.room_participants,
                target_type: ContextTargetType.chat_room,
                target_id: input.roomId,
                policy_version: CHAT_CONTEXT_POLICY_VERSION,
                revoked_at: null,
                expires_at: { gt: now },
              },
              select: {
                id: true,
                subject_participant_id: true,
                purpose: true,
                audience: true,
                target_type: true,
                target_id: true,
                capsule_content_hash: true,
                policy_version: true,
                expires_at: true,
                revoked_at: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        });
        const currentById = new Map(
          exactSharedMediationCapsules(currentCandidates, input.roomId, now)
            .map(capsule => [capsule.id, capsule]),
        );
        capsules = input.capsules.flatMap(expected => {
          const current = currentById.get(expected.id);
          if (
            !current
            || current.contentHash !== expected.contentHash
            || current.summary !== expected.summary
          ) return [];
          const expectedAuthorizationIds = [...expected.authorizationIds].sort();
          const currentAuthorizationIds = [...current.authorizationIds].sort();
          if (
            expectedAuthorizationIds.length !== currentAuthorizationIds.length
            || expectedAuthorizationIds.some(
              (authorizationId, index) => authorizationId !== currentAuthorizationIds[index]
            )
          ) return [];
          return [current];
        });
        await Promise.all(capsules.map(capsule => tx.contextUseAudit.create({
          data: {
            room_id: input.roomId,
            capsule_id: capsule.id,
            authorization_id: capsule.authorizationIds[0],
            purpose: ContextPurpose.shared_mediation,
            audience: ContextAudience.room_participants,
            target_type: ContextTargetType.chat_room,
            target_id: input.roomId,
            decision: ContextUseDecision.allowed,
            reason_code: 'approved_capsule_exact_authorization',
            source_refs: [capsule.id],
            authorization_refs: capsule.authorizationIds,
            content_hashes: [capsule.contentHash],
            policy_version: CHAT_CONTEXT_POLICY_VERSION,
            prompt_version: getAIPromptVersion('chat_room_ai_response'),
          },
        })));
      }

      return { controls, capsules };
    }, { isolationLevel: 'ReadCommitted' });
  }
}

export const chatContextMediationClaimService = new ChatContextMediationClaimService();
