import {
  ChatChannelKind,
  ChatMessageType,
  ChatRoleInRoom,
  ChatVisibilityScope,
  ContextAudience,
  ContextPurpose,
  ContextTargetType,
  ContextUseDecision,
  Prisma,
  PrivateContextUseMode,
} from '@prisma/client';
import prisma from '../config/database';
import { getAIPromptVersion } from '../utils/ai-prompt-version';
import { Errors } from '../utils/errors';
import { CHAT_CONTEXT_POLICY_VERSION } from '../utils/chat-context-validation';
import {
  buildSharedContextMessageWhere,
  buildVisibleChatMessageWhere,
  filterSharedContextMessages,
} from './chat-message-audience-policy';
import { mediationStrategyService, type MediationControls } from './mediation-strategy.service';

type ContextMessage = {
  id: string;
  content: string;
  messageType: ChatMessageType;
  role: ChatRoleInRoom;
  audience: 'private_owner' | 'room_participants';
  createdAt: Date;
};

type SharedCapsule = {
  id: string;
  summary: string;
  contentHash: string;
  authorizationIds: string[];
};

export type PrivateSupportContextBundle = {
  audience: 'private_owner';
  purpose: 'private_support';
  policyVersion: string;
  messages: ContextMessage[];
  sourceRefs: string[];
};

export type SharedMediationContextBundle = {
  audience: 'room_participants';
  purpose: 'shared_mediation';
  policyVersion: string;
  messages: ContextMessage[];
  capsules: SharedCapsule[];
  controls: MediationControls | null;
  sourceRefs: string[];
  authorizationRefs: string[];
};

type PrivateSupportInput = {
  roomId: string;
  privateChannelId: string;
  ownerParticipantId: string;
  maxMessages?: number;
};

type SharedMediationInput = {
  roomId: string;
  maxMessages?: number;
  includePrivateControls?: boolean;
};

type RoomWithParticipants = Prisma.ChatRoomGetPayload<{
  include: { participants: true };
}>;

export type ProcessControlBundle = {
  controls: MediationControls | null;
  policyVersion: string;
};

type AuditInput = {
  roomId: string;
  actorParticipantId?: string;
  capsuleId?: string;
  authorizationId?: string;
  purpose: ContextPurpose;
  audience: ContextAudience;
  decision: ContextUseDecision;
  reasonCode: string;
  sourceRefs: string[];
  authorizationRefs?: string[];
  contentHashes?: string[];
  promptVersion?: string;
};

function toContextMessage(message: {
  id: string;
  content: string;
  message_type: ChatMessageType;
  created_at: Date;
  visibility_scope: ChatVisibilityScope;
  sender_participant: { role_in_room: ChatRoleInRoom };
  channel?: { kind: ChatChannelKind } | null;
}): ContextMessage {
  const isPrivate =
    message.channel?.kind === ChatChannelKind.private ||
    (!message.channel && message.visibility_scope !== ChatVisibilityScope.all);
  return {
    id: message.id,
    content: message.content,
    messageType: message.message_type,
    role: message.sender_participant.role_in_room,
    audience: isPrivate ? 'private_owner' : 'room_participants',
    createdAt: message.created_at,
  };
}

export class ChatContextPolicyService {
  private async recordUse(input: AuditInput): Promise<void> {
    await prisma.contextUseAudit.create({
      data: {
        room_id: input.roomId,
        actor_participant_id: input.actorParticipantId ?? null,
        capsule_id: input.capsuleId ?? null,
        authorization_id: input.authorizationId ?? null,
        purpose: input.purpose,
        audience: input.audience,
        target_type: ContextTargetType.chat_room,
        target_id: input.roomId,
        decision: input.decision,
        reason_code: input.reasonCode,
        source_refs: input.sourceRefs as Prisma.InputJsonArray,
        authorization_refs: (input.authorizationRefs ?? []) as Prisma.InputJsonArray,
        content_hashes: input.contentHashes ?? [],
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
        prompt_version: input.promptVersion ?? null,
      },
    });
  }

  private async resolveProcessControls(
    room: RoomWithParticipants,
    purpose: 'shared_mediation' | 'formal_analysis_delivery',
    audience: 'room_participants' | 'analysis_participants',
  ): Promise<MediationControls | null> {
    const optedInParticipants = room.participants.filter(
      participant =>
        participant.participant_type === 'user' &&
        participant.is_active &&
        participant.left_at === null &&
        participant.private_context_use_mode === PrivateContextUseMode.shared_process_controls &&
        (participant.role_in_room === ChatRoleInRoom.roleA ||
          participant.role_in_room === ChatRoleInRoom.roleB)
    );
    const optedInParticipantIds = optedInParticipants.map(participant => participant.id);
    if (optedInParticipantIds.length === 0) return null;

    const candidates = await prisma.chatMessage.findMany({
      where: {
        room_id: room.id,
        message_type: ChatMessageType.user_text,
        ai_context_eligible: true,
        sender_participant_id: { in: optedInParticipantIds },
        OR: [
          {
            channel: {
              is: {
                kind: ChatChannelKind.private,
                owner_participant_id: { in: optedInParticipantIds },
              },
            },
          },
          {
            channel_id: null,
            visibility_scope: {
              in: [ChatVisibilityScope.owner_only, ChatVisibilityScope.summary_only],
            },
          },
        ],
      },
      select: {
        id: true,
        content: true,
        sender_participant_id: true,
        channel: { select: { owner_participant_id: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 40,
    });
    const privateMessages = candidates.filter(message => (
      optedInParticipantIds.includes(message.sender_participant_id)
      && (
        message.channel?.owner_participant_id === message.sender_participant_id
        || message.channel === null
      )
    ));
    if (privateMessages.length === 0) return null;

    // The durable receipt is the fail-closed gate before raw private text may
    // cross the external model boundary. It intentionally contains IDs only.
    await this.recordUse({
      roomId: room.id,
      purpose,
      audience,
      decision: ContextUseDecision.allowed,
      reasonCode: 'private_process_controls_requested',
      sourceRefs: privateMessages.map(message => message.id),
      promptVersion: getAIPromptVersion('chat_mediation_strategy'),
    });
    const extraction = await mediationStrategyService.extractAggregatedControlsWithOutcome(
      room.id,
      optedInParticipants.map(participant => ({
        participantId: participant.id,
        messages: privateMessages
          .filter(message => (
            message.sender_participant_id === participant.id
            && (
              message.channel?.owner_participant_id === participant.id
              || message.channel === null
            )
          ))
          .map(message => message.content)
          .reverse(),
      })),
    );
    await this.recordUse({
      roomId: room.id,
      purpose,
      audience,
      decision: extraction.controls ? ContextUseDecision.allowed : ContextUseDecision.denied,
      reasonCode: `private_process_controls_${extraction.outcome}`,
      sourceRefs: privateMessages.map(message => message.id),
      promptVersion: getAIPromptVersion('chat_mediation_strategy'),
    });
    return extraction.controls;
  }

  async resolveFormalAnalysisDelivery(roomId: string): Promise<ProcessControlBundle> {
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });
    if (!room) throw Errors.NOT_FOUND('聊天室不存在');
    return {
      controls: await this.resolveProcessControls(
        room,
        ContextPurpose.formal_analysis_delivery,
        ContextAudience.analysis_participants,
      ),
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
    };
  }

  async resolvePrivateSupport(input: PrivateSupportInput): Promise<PrivateSupportContextBundle> {
    const owner = await prisma.chatParticipant.findFirst({
      where: {
        id: input.ownerParticipantId,
        room_id: input.roomId,
        participant_type: 'user',
        is_active: true,
        left_at: null,
        owned_channels: {
          some: {
            id: input.privateChannelId,
            kind: ChatChannelKind.private,
          },
        },
      },
      include: { room: true },
    });
    if (!owner) throw Errors.FORBIDDEN('私人上下文的 owner 或 channel 不相符');

    const candidates = await prisma.chatMessage.findMany({
      where: {
        room_id: input.roomId,
        ai_context_eligible: true,
        message_type: {
          in: [
            ChatMessageType.user_text,
            ChatMessageType.ai_reflection,
            ChatMessageType.ai_mediation,
            ChatMessageType.safety_notice,
          ],
        },
        ...buildVisibleChatMessageWhere(owner, owner.room.history_visibility_mode),
      },
      include: { sender_participant: true, channel: { select: { kind: true } } },
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(input.maxMessages ?? 30, 1), 50),
    });
    const messages = candidates.reverse().map(toContextMessage);
    const sourceRefs = messages.map(message => message.id);
    await this.recordUse({
      roomId: input.roomId,
      actorParticipantId: owner.id,
      purpose: ContextPurpose.private_support,
      audience: ContextAudience.private_owner,
      decision: ContextUseDecision.allowed,
      reasonCode: 'owner_private_support_bundle',
      sourceRefs,
      promptVersion: getAIPromptVersion('chat_private_support_response'),
    });

    return {
      audience: 'private_owner',
      purpose: 'private_support',
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
      messages,
      sourceRefs,
    };
  }

  async resolveSharedMediation(input: SharedMediationInput): Promise<SharedMediationContextBundle> {
    const now = new Date();
    const room = await prisma.chatRoom.findUnique({
      where: { id: input.roomId },
      include: { participants: true },
    });
    if (!room) throw Errors.NOT_FOUND('聊天室不存在');

    const roleB = room.participants.find(
      participant =>
        participant.role_in_room === ChatRoleInRoom.roleB &&
        participant.participant_type === 'user' &&
        participant.is_active &&
        participant.left_at === null
    );
    const candidates = await prisma.chatMessage.findMany({
      where: buildSharedContextMessageWhere({
        roomId: room.id,
        historyVisibilityMode: room.history_visibility_mode,
        roleBJoinedAt: roleB?.joined_at,
      }),
      include: { sender_participant: true },
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(input.maxMessages ?? 30, 1), 50),
    });
    const messages = filterSharedContextMessages(candidates, {
      roomId: room.id,
      historyVisibilityMode: room.history_visibility_mode,
      roleBJoinedAt: roleB?.joined_at,
    })
      .reverse()
      .map(toContextMessage);

    const approvedCapsules = await prisma.contextCapsule.findMany({
      where: {
        room_id: room.id,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
        status: 'approved',
        revoked_at: null,
        expires_at: { gt: now },
        owner_participant: {
          is: {
            participant_type: 'user',
            is_active: true,
            left_at: null,
          },
        },
        authorizations: {
          some: {
            purpose: ContextPurpose.shared_mediation,
            audience: ContextAudience.room_participants,
            target_type: ContextTargetType.chat_room,
            target_id: room.id,
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
            target_id: room.id,
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
    const capsules = approvedCapsules.flatMap(capsule => {
      if (
        capsule.status !== 'approved' ||
        capsule.policy_version !== CHAT_CONTEXT_POLICY_VERSION ||
        capsule.revoked_at !== null ||
        !capsule.expires_at ||
        capsule.expires_at.getTime() <= now.getTime()
      ) {
        return [];
      }

      const exactActiveAuthorizations = capsule.authorizations.filter(
        authorization =>
          authorization.subject_participant_id === capsule.owner_participant_id &&
          authorization.purpose === ContextPurpose.shared_mediation &&
          authorization.audience === ContextAudience.room_participants &&
          authorization.target_type === ContextTargetType.chat_room &&
          authorization.target_id === room.id &&
          authorization.capsule_content_hash === capsule.content_hash &&
          authorization.policy_version === capsule.policy_version &&
          authorization.policy_version === CHAT_CONTEXT_POLICY_VERSION &&
          authorization.revoked_at === null &&
          authorization.expires_at !== null &&
          authorization.expires_at.getTime() > now.getTime()
      );
      if (exactActiveAuthorizations.length === 0) return [];

      return [
        {
          id: capsule.id,
          summary: capsule.summary,
          contentHash: capsule.content_hash,
          authorizationIds: exactActiveAuthorizations.map(authorization => authorization.id),
        },
      ];
    });

    const controls = input.includePrivateControls === false
      ? null
      : await this.resolveProcessControls(
          room,
          ContextPurpose.shared_mediation,
          ContextAudience.room_participants,
        );
    await Promise.all(
      capsules.map(capsule =>
        this.recordUse({
          roomId: room.id,
          capsuleId: capsule.id,
          authorizationId: capsule.authorizationIds[0],
          purpose: ContextPurpose.shared_mediation,
          audience: ContextAudience.room_participants,
          decision: ContextUseDecision.allowed,
          reasonCode: 'approved_capsule_exact_authorization',
          sourceRefs: [capsule.id],
          authorizationRefs: capsule.authorizationIds,
          contentHashes: [capsule.contentHash],
          promptVersion: getAIPromptVersion('chat_room_ai_response'),
        })
      )
    );

    return {
      audience: 'room_participants',
      purpose: 'shared_mediation',
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
      messages,
      capsules,
      controls,
      sourceRefs: messages.map(message => message.id),
      authorizationRefs: capsules.flatMap(capsule => capsule.authorizationIds),
    };
  }
}

export const chatContextPolicyService = new ChatContextPolicyService();
