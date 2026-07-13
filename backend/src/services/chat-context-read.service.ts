import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ChatAnalysisRequestListItem,
  ChatAnalysisSourcePreviews,
  ContextAuthorization,
  ContextCapsuleListItem,
  ContextSourceRef,
} from '@emorapy/contracts/chat';
import prisma from '../config/database';
import {
  CHAT_CONTEXT_POLICY_VERSION,
  assertSha256,
  computeAnalysisSelectionHash,
  computeCapsuleContentHash,
  textSha256,
} from '../utils/chat-context-validation';
import { Errors } from '../utils/errors';
import {
  chatActorAccessService,
  type ChatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';
import { parseChatAnalysisSelectionSnapshot } from './chat-analysis-selection.validator';
import {
  buildSharedHistoryCutoffWhere,
  isWithinSharedHistoryCutoff,
} from './chat-message-audience-policy';

type ActorAccessRuntime = Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>;

function nullableIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toOwnerSourceRefs(value: Prisma.JsonValue): ContextSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (
      Object.keys(record).some(key => !['kind', 'id', 'version', 'content_hash'].includes(key)) ||
      record.kind !== 'chat_message' ||
      typeof record.id !== 'string' ||
      typeof record.content_hash !== 'string'
    ) {
      return [];
    }
    return [
      {
        kind: 'chat_message' as const,
        id: record.id,
        content_hash: record.content_hash,
      },
    ];
  });
}

function toAuthorization(authorization: {
  id: string;
  capsule_id: string;
  subject_participant_id: string;
  purpose: ContextAuthorization['purpose'];
  audience: ContextAuthorization['audience'];
  target_type: ContextAuthorization['target_type'];
  target_id: string;
  capsule_content_hash: string;
  policy_version: string;
  granted_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
  revocation_reason_code: string | null;
}): ContextAuthorization {
  return {
    id: authorization.id,
    capsule_id: authorization.capsule_id,
    subject_participant_id: authorization.subject_participant_id,
    purpose: authorization.purpose,
    audience: authorization.audience,
    target_type: authorization.target_type,
    target_id: authorization.target_id,
    capsule_content_hash: authorization.capsule_content_hash,
    policy_version: authorization.policy_version,
    granted_at: authorization.granted_at.toISOString(),
    expires_at: nullableIso(authorization.expires_at),
    revoked_at: nullableIso(authorization.revoked_at),
    revocation_reason_code: authorization.revocation_reason_code,
  };
}

function parseReadEnvelope(request: {
  room_id: string;
  selection_snapshot: Prisma.JsonValue;
  selection_hash: string;
  required_participant_ids: string[];
  policy_version: string;
}) {
  assertSha256(request.selection_hash, 'selection_hash');
  const storedSnapshot = parseChatAnalysisSelectionSnapshot(request.selection_snapshot);
  const requiredParticipantIds = [...new Set(request.required_participant_ids)].sort();
  if (
    requiredParticipantIds.length === 0 ||
    requiredParticipantIds.length !== request.required_participant_ids.length
  ) {
    throw Errors.CONFLICT('Analysis request required participants 無效');
  }
  const canonicalHash = computeAnalysisSelectionHash({
    policyVersion: request.policy_version,
    requiredParticipantIds,
    roomId: request.room_id,
    selectionSnapshot: storedSnapshot,
  });
  if (canonicalHash !== request.selection_hash) {
    throw Errors.CONFLICT('Analysis request canonical hash 驗證失敗');
  }
  return { storedSnapshot, requiredParticipantIds };
}

export class ChatContextReadService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly actorAccess: ActorAccessRuntime = chatActorAccessService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async listOwnCapsules(
    roomId: string,
    actor: ChatActorContext
  ): Promise<ContextCapsuleListItem[]> {
    return this.db.$transaction(
      async tx => {
        const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        const capsules = await tx.contextCapsule.findMany({
          where: { room_id: roomId, owner_participant_id: participant.id },
          include: { authorizations: { orderBy: { granted_at: 'desc' } } },
          orderBy: [{ created_at: 'desc' }, { version: 'desc' }],
        });

        return capsules
          .filter(
            capsule => capsule.room_id === roomId && capsule.owner_participant_id === participant.id
          )
          .map(capsule => ({
            id: capsule.id,
            room_id: capsule.room_id,
            owner_participant_id: capsule.owner_participant_id,
            source_channel_id: capsule.source_channel_id,
            lineage_id: capsule.lineage_id,
            version: capsule.version,
            summary: capsule.summary,
            source_refs: toOwnerSourceRefs(capsule.source_refs),
            content_hash: capsule.content_hash,
            policy_version: capsule.policy_version,
            sensitivity_class: capsule.sensitivity_class,
            status: capsule.status,
            expires_at: nullableIso(capsule.expires_at),
            revoked_at: nullableIso(capsule.revoked_at),
            created_at: capsule.created_at.toISOString(),
            authorizations: capsule.authorizations
              .filter(
                authorization =>
                  authorization.capsule_id === capsule.id &&
                  authorization.subject_participant_id === participant.id
              )
              .map(toAuthorization),
          }));
      },
      { isolationLevel: 'Serializable' }
    );
  }

  async listAnalysisRequests(
    roomId: string,
    actor: ChatActorContext
  ): Promise<ChatAnalysisRequestListItem[]> {
    return this.db.$transaction(
      async tx => {
        const now = this.now();
        const { participant, room } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        const requests = await tx.chatAnalysisRequest.findMany({
          where: {
            room_id: roomId,
            required_participant_ids: { has: participant.id },
          },
          include: { participant_approvals: true },
          orderBy: { created_at: 'desc' },
        });

        const visibleRequests = requests.flatMap(request => {
          if (
            request.room_id !== roomId ||
            !request.required_participant_ids.includes(participant.id)
          ) {
            return [];
          }
          const envelope = parseReadEnvelope(request);
          if (!envelope.requiredParticipantIds.includes(participant.id)) return [];
          return [{ request, ...envelope }];
        });
        const messageIds = [
          ...new Set(
            visibleRequests.flatMap(item => item.storedSnapshot.message_refs.map(ref => ref.id))
          ),
        ];
        const capsuleIds = [
          ...new Set(
            visibleRequests.flatMap(item => item.storedSnapshot.capsule_refs.map(ref => ref.id))
          ),
        ];

        const messages =
          messageIds.length === 0
            ? []
            : await tx.chatMessage.findMany({
                where: {
                  id: { in: messageIds },
                  room_id: roomId,
                  message_type: 'user_text',
                  visibility_scope: 'all',
                  ai_context_eligible: true,
                  safety_flag: false,
                  channel: { is: { room_id: roomId, kind: 'shared' } },
                  sender_participant: {
                    is: {
                      participant_type: 'user',
                      role_in_room: { in: ['roleA', 'roleB'] },
                      is_active: true,
                      left_at: null,
                    },
                  },
                  ...buildSharedHistoryCutoffWhere(
                    participant,
                    room.history_visibility_mode,
                  ),
                },
                select: {
                  id: true,
                  room_id: true,
                  content: true,
                  message_type: true,
                  visibility_scope: true,
                  ai_context_eligible: true,
                  safety_flag: true,
                  sender_participant_id: true,
                  created_at: true,
                  channel: { select: { room_id: true, kind: true } },
                  sender_participant: {
                    select: {
                      participant_type: true,
                      role_in_room: true,
                      is_active: true,
                      left_at: true,
                    },
                  },
                },
              });
        const messageById = new Map(messages.map(message => [message.id, message]));

        const capsules =
          capsuleIds.length === 0
            ? []
            : await tx.contextCapsule.findMany({
                where: {
                  id: { in: capsuleIds },
                  room_id: roomId,
                  policy_version: CHAT_CONTEXT_POLICY_VERSION,
                  status: 'approved',
                  revoked_at: null,
                  expires_at: { gt: now },
                  sensitivity_class: { not: 'safety_restricted' },
                  owner_participant: {
                    is: {
                      participant_type: 'user',
                      role_in_room: { in: ['roleA', 'roleB'] },
                      is_active: true,
                      left_at: null,
                    },
                  },
                  authorizations: {
                    some: {
                      purpose: 'formal_analysis_evidence',
                      audience: 'analysis_participants',
                      target_type: 'chat_room',
                      target_id: roomId,
                      policy_version: CHAT_CONTEXT_POLICY_VERSION,
                      revoked_at: null,
                      expires_at: { gt: now },
                    },
                  },
                },
                include: {
                  owner_participant: {
                    select: {
                      participant_type: true,
                      role_in_room: true,
                      is_active: true,
                      left_at: true,
                    },
                  },
                  authorizations: {
                    where: {
                      purpose: 'formal_analysis_evidence',
                      audience: 'analysis_participants',
                      target_type: 'chat_room',
                      target_id: roomId,
                      policy_version: CHAT_CONTEXT_POLICY_VERSION,
                      revoked_at: null,
                      expires_at: { gt: now },
                    },
                  },
                },
              });
        const capsuleById = new Map(capsules.map(capsule => [capsule.id, capsule]));

        return visibleRequests.map(({ request, storedSnapshot, requiredParticipantIds }) => {
          const requiredSet = new Set(requiredParticipantIds);
          const sourcePreviews: ChatAnalysisSourcePreviews = { messages: [], capsules: [] };
          for (const ref of storedSnapshot.message_refs) {
            const message = messageById.get(ref.id);
            if (
              !message ||
              message.room_id !== roomId ||
              message.message_type !== 'user_text' ||
              message.visibility_scope !== 'all' ||
              message.ai_context_eligible !== true ||
              message.safety_flag !== false ||
              message.channel?.room_id !== roomId ||
              message.channel.kind !== 'shared' ||
              !requiredSet.has(message.sender_participant_id) ||
              message.sender_participant.participant_type !== 'user' ||
              !['roleA', 'roleB'].includes(message.sender_participant.role_in_room) ||
              !message.sender_participant.is_active ||
              message.sender_participant.left_at !== null ||
              !isWithinSharedHistoryCutoff(
                message.created_at,
                participant,
                room.history_visibility_mode,
              ) ||
              ref.content_hash !== textSha256(message.content)
            ) {
              continue;
            }
            sourcePreviews.messages.push({
              kind: 'chat_message',
              id: message.id,
              content: message.content,
              content_hash: ref.content_hash,
              sender_participant_id: message.sender_participant_id,
              sender_role: message.sender_participant.role_in_room as 'roleA' | 'roleB',
              created_at: message.created_at.toISOString(),
            });
          }

          for (const ref of storedSnapshot.capsule_refs) {
            const capsule = capsuleById.get(ref.id);
            if (
              !capsule ||
              capsule.room_id !== roomId ||
              capsule.policy_version !== CHAT_CONTEXT_POLICY_VERSION ||
              capsule.status !== 'approved' ||
              capsule.revoked_at !== null ||
              !capsule.expires_at ||
              capsule.expires_at <= now ||
              capsule.sensitivity_class === 'safety_restricted' ||
              !requiredSet.has(capsule.owner_participant_id) ||
              capsule.owner_participant.participant_type !== 'user' ||
              !['roleA', 'roleB'].includes(capsule.owner_participant.role_in_room) ||
              !capsule.owner_participant.is_active ||
              capsule.owner_participant.left_at !== null ||
              ref.version !== capsule.version ||
              ref.content_hash !== capsule.content_hash
            ) {
              continue;
            }
            const exactActiveGrant = capsule.authorizations.some(
              authorization =>
                authorization.capsule_id === capsule.id &&
                authorization.subject_participant_id === capsule.owner_participant_id &&
                authorization.purpose === 'formal_analysis_evidence' &&
                authorization.audience === 'analysis_participants' &&
                authorization.target_type === 'chat_room' &&
                authorization.target_id === roomId &&
                authorization.capsule_content_hash === capsule.content_hash &&
                authorization.policy_version === capsule.policy_version &&
                authorization.policy_version === CHAT_CONTEXT_POLICY_VERSION &&
                authorization.revoked_at === null &&
                authorization.expires_at !== null &&
                authorization.expires_at > now
            );
            if (!exactActiveGrant) continue;

            try {
              const canonicalHash = computeCapsuleContentHash({
                expiresAt: capsule.expires_at,
                lineageId: capsule.lineage_id,
                ownerParticipantId: capsule.owner_participant_id,
                policyVersion: capsule.policy_version,
                roomId: capsule.room_id,
                sourceChannelId: capsule.source_channel_id,
                sourceRefs: capsule.source_refs,
                summary: capsule.summary,
                version: capsule.version,
              });
              if (canonicalHash !== capsule.content_hash) continue;
            } catch {
              continue;
            }

            sourcePreviews.capsules.push({
              kind: 'context_capsule',
              id: capsule.id,
              version: capsule.version,
              summary: capsule.summary,
              content_hash: capsule.content_hash,
              owner_participant_id: capsule.owner_participant_id,
              owner_role: capsule.owner_participant.role_in_room as 'roleA' | 'roleB',
            });
          }

          return {
            id: request.id,
            room_id: request.room_id,
            requested_by_participant_id: request.requested_by_participant_id,
            status: request.status,
            selection_snapshot: storedSnapshot,
            selection_hash: request.selection_hash,
            required_participant_ids: requiredParticipantIds,
            policy_version: request.policy_version,
            expires_at: request.expires_at.toISOString(),
            submitted_at: nullableIso(request.submitted_at),
            cancelled_at: nullableIso(request.cancelled_at),
            created_at: request.created_at.toISOString(),
            updated_at: request.updated_at.toISOString(),
            participant_approvals: request.participant_approvals
              .filter(
                approval =>
                  approval.analysis_request_id === request.id &&
                  requiredSet.has(approval.participant_id) &&
                  approval.selection_hash === request.selection_hash &&
                  approval.policy_version === request.policy_version
              )
              .map(approval => ({
                id: approval.id,
                analysis_request_id: approval.analysis_request_id,
                participant_id: approval.participant_id,
                decision: approval.decision,
                selection_hash: approval.selection_hash,
                policy_version: approval.policy_version,
                decision_at: approval.decision_at.toISOString(),
                expires_at: approval.expires_at.toISOString(),
                revoked_at: nullableIso(approval.revoked_at),
              })),
            source_previews: sourcePreviews,
          };
        });
      },
      { isolationLevel: 'Serializable' }
    );
  }
}

export const chatContextReadService = new ChatContextReadService();
