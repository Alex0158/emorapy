import {
  ChatRoleInRoom,
  ContextAudience,
  ContextPurpose,
  ContextTargetType,
  ContextUseDecision,
  PrivateContextUseMode,
  SharedAdaptationConsentDecision,
  type ChatParticipant,
} from '@prisma/client';
import type {
  PrivateContextPreference,
  RoomAdaptationStatus,
} from '@emorapy/contracts/chat';
import prisma from '../config/database';
import {
  CHAT_ADAPTATION_POLICY_VERSION,
  assertCurrentAdaptationPolicyVersion,
  isTransactionWriteConflict,
} from '../utils/chat-context-validation';
import { Errors } from '../utils/errors';
import {
  chatActorAccessService,
  type AccessibleChatRoom,
  type ChatActorContext,
} from './chat-actor-access.service';

const HUMAN_ROLES = new Set<ChatRoleInRoom>([
  ChatRoleInRoom.roleA,
  ChatRoleInRoom.roleB,
]);

type PreferenceParticipant = Pick<
  ChatParticipant,
  | 'id'
  | 'participant_type'
  | 'role_in_room'
  | 'is_active'
  | 'left_at'
  | 'private_context_use_mode'
  | 'private_context_policy_version'
  | 'private_context_preference_updated_at'
  | 'shared_adaptation_consent'
  | 'shared_adaptation_policy_version'
  | 'shared_adaptation_decided_at'
>;

function isActiveHuman(participant: PreferenceParticipant): boolean {
  return (
    participant.participant_type === 'user'
    && participant.is_active
    && participant.left_at === null
    && HUMAN_ROLES.has(participant.role_in_room)
  );
}

function nullableIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function buildRoomAdaptationStatus(room: AccessibleChatRoom): RoomAdaptationStatus {
  const activeParticipants = room.participants.filter(isActiveHuman);
  const acceptedParticipantCount = activeParticipants.filter(participant => (
    participant.shared_adaptation_consent === SharedAdaptationConsentDecision.accepted
    && participant.shared_adaptation_policy_version === CHAT_ADAPTATION_POLICY_VERSION
    && participant.shared_adaptation_decided_at !== null
  )).length;
  const ownerOptInCount = activeParticipants.filter(participant => (
    participant.private_context_use_mode === PrivateContextUseMode.shared_process_controls
    && participant.private_context_policy_version === CHAT_ADAPTATION_POLICY_VERSION
    && participant.private_context_preference_updated_at !== null
  )).length;

  return {
    policy_version: CHAT_ADAPTATION_POLICY_VERSION,
    enabled: (
      activeParticipants.length >= 2
      && acceptedParticipantCount === activeParticipants.length
      && ownerOptInCount > 0
    ),
    active_participant_count: activeParticipants.length,
    accepted_participant_count: acceptedParticipantCount,
    owner_opt_in_count: ownerOptInCount,
  };
}

function buildPreference(
  room: AccessibleChatRoom,
  participant: PreferenceParticipant,
): PrivateContextPreference {
  return {
    participant_id: participant.id,
    mode: participant.private_context_use_mode,
    mode_policy_version: participant.private_context_policy_version,
    mode_updated_at: nullableIso(participant.private_context_preference_updated_at),
    adaptation_decision: participant.shared_adaptation_consent,
    adaptation_policy_version: participant.shared_adaptation_policy_version,
    adaptation_decided_at: nullableIso(participant.shared_adaptation_decided_at),
    room_adaptation: buildRoomAdaptationStatus(room),
  };
}

export class ChatContextPreferenceService {
  async get(
    roomId: string,
    actor: ChatActorContext,
  ): Promise<PrivateContextPreference> {
    const { room, participant } = await chatActorAccessService.resolveActiveHumanParticipant(
      roomId,
      actor,
    );
    return buildPreference(room, participant);
  }

  async update(
    roomId: string,
    actor: ChatActorContext,
    mode: PrivateContextUseMode,
    policyVersion?: string,
  ): Promise<PrivateContextPreference> {
    if (
      mode === PrivateContextUseMode.shared_process_controls
      || policyVersion !== undefined
    ) {
      assertCurrentAdaptationPolicyVersion(policyVersion ?? '');
    }
    const now = new Date();
    try {
      return await prisma.$transaction(async tx => {
        const { participant } = await chatActorAccessService.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx,
        );
        await chatActorAccessService.lockActiveParticipant(tx, roomId, participant.id);
        const updated = await tx.chatParticipant.updateMany({
          where: {
            id: participant.id,
            room_id: roomId,
            participant_type: 'user',
            is_active: true,
            left_at: null,
          },
          data: {
            private_context_use_mode: mode,
            private_context_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
            private_context_preference_updated_at: now,
          },
        });
        if (updated.count !== 1) {
          throw Errors.FORBIDDEN('聊天室參與者權限已失效');
        }
        await tx.contextUseAudit.create({
          data: {
            room_id: roomId,
            actor_participant_id: participant.id,
            purpose: ContextPurpose.shared_mediation_adaptation,
            audience: ContextAudience.room_participants,
            target_type: ContextTargetType.chat_room,
            target_id: roomId,
            decision: mode === PrivateContextUseMode.shared_process_controls
              ? ContextUseDecision.allowed
              : ContextUseDecision.denied,
            reason_code: mode === PrivateContextUseMode.shared_process_controls
              ? 'private_adaptation_authorization_granted'
              : 'private_adaptation_authorization_revoked',
            source_refs: [],
            authorization_refs: [],
            content_hashes: [],
            policy_version: CHAT_ADAPTATION_POLICY_VERSION,
          },
        });
        const room = await tx.chatRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: { participants: true },
        });
        const persisted = room.participants.find(candidate => candidate.id === participant.id);
        if (!persisted || !isActiveHuman(persisted)) {
          throw Errors.FORBIDDEN('聊天室參與者權限已失效');
        }
        return buildPreference(room, persisted);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        throw Errors.CONFLICT('Context preference 狀態已變更，請重新載入');
      }
      throw error;
    }
  }

  async updateAdaptationConsent(
    roomId: string,
    actor: ChatActorContext,
    decision: Exclude<SharedAdaptationConsentDecision, 'not_set'>,
    policyVersion: string,
  ): Promise<PrivateContextPreference> {
    assertCurrentAdaptationPolicyVersion(policyVersion);
    const now = new Date();
    try {
      return await prisma.$transaction(async tx => {
        const { participant } = await chatActorAccessService.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx,
        );
        await chatActorAccessService.lockActiveParticipant(tx, roomId, participant.id);
        const updated = await tx.chatParticipant.updateMany({
          where: {
            id: participant.id,
            room_id: roomId,
            participant_type: 'user',
            is_active: true,
            left_at: null,
          },
          data: {
            shared_adaptation_consent: decision,
            shared_adaptation_policy_version: CHAT_ADAPTATION_POLICY_VERSION,
            shared_adaptation_decided_at: now,
          },
        });
        if (updated.count !== 1) {
          throw Errors.FORBIDDEN('聊天室參與者權限已失效');
        }
        await tx.contextUseAudit.create({
          data: {
            room_id: roomId,
            actor_participant_id: participant.id,
            purpose: ContextPurpose.shared_mediation_adaptation,
            audience: ContextAudience.room_participants,
            target_type: ContextTargetType.chat_room,
            target_id: roomId,
            decision: decision === SharedAdaptationConsentDecision.accepted
              ? ContextUseDecision.allowed
              : ContextUseDecision.denied,
            reason_code: decision === SharedAdaptationConsentDecision.accepted
              ? 'shared_adaptation_mode_accepted'
              : 'shared_adaptation_mode_declined',
            source_refs: [],
            authorization_refs: [],
            content_hashes: [],
            policy_version: CHAT_ADAPTATION_POLICY_VERSION,
          },
        });
        const room = await tx.chatRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: { participants: true },
        });
        const persisted = room.participants.find(candidate => candidate.id === participant.id);
        if (!persisted || !isActiveHuman(persisted)) {
          throw Errors.FORBIDDEN('聊天室參與者權限已失效');
        }
        return buildPreference(room, persisted);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        throw Errors.CONFLICT('共同對話調整選擇已變更，請重新載入');
      }
      throw error;
    }
  }
}

export const chatContextPreferenceService = new ChatContextPreferenceService();
