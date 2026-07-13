import type { ChatHistoryVisibilityMode, Prisma } from '@prisma/client';
import type {
  ChatAnalysisSelectionSnapshot,
  ContextAuthorizationRef,
  ContextSourceRef,
} from '@emorapy/contracts/chat';
import { Errors } from '../utils/errors';
import {
  buildSharedHistoryCutoffWhere,
  isWithinSharedHistoryCutoff,
  type HumanParticipantAudience,
} from './chat-message-audience-policy';
import {
  ANALYSIS_REQUEST_TTL_MS,
  CHAT_CONTEXT_POLICY_VERSION,
  assertCurrentPolicyVersion,
  assertSha256,
  canonicalJson,
  computeAnalysisSelectionHash,
  computeCapsuleContentHash,
  textSha256,
} from '../utils/chat-context-validation';

export type RequestWithApprovals = Prisma.ChatAnalysisRequestGetPayload<{
  include: { participant_approvals: true };
}>;

export type EligibleAnalysisSelection = {
  snapshot: ChatAnalysisSelectionSnapshot;
  authorizationRefs: ContextAuthorizationRef[];
  contentHashes: string[];
  requiredParticipantIds: string[];
  validUntil: Date;
  sharedHistoryAudience: {
    participant: HumanParticipantAudience;
    historyVisibilityMode: ChatHistoryVisibilityMode;
  };
};

export type VerifiedAnalysisRequest = EligibleAnalysisSelection & {
  storedSnapshot: ChatAnalysisSelectionSnapshot;
};

function parseSourceRef(
  value: unknown,
  expectedKind: 'chat_message' | 'context_capsule'
): ContextSourceRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Errors.CONFLICT('Analysis selection snapshot 格式無效');
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(['kind', 'id', 'version', 'content_hash']);
  if (
    Object.keys(record).some(key => !allowedKeys.has(key)) ||
    record.kind !== expectedKind ||
    typeof record.id !== 'string' ||
    typeof record.content_hash !== 'string'
  ) {
    throw Errors.CONFLICT('Analysis selection snapshot 包含無效 source ref');
  }
  assertSha256(record.content_hash, 'selection content_hash');
  if (
    expectedKind === 'context_capsule' &&
    (!Number.isInteger(record.version) || (record.version as number) <= 0)
  ) {
    throw Errors.CONFLICT('Capsule selection version 無效');
  }
  return {
    kind: expectedKind,
    id: record.id,
    ...(expectedKind === 'context_capsule' ? { version: record.version as number } : {}),
    content_hash: record.content_hash,
  };
}

function parseSelectionSnapshot(value: Prisma.JsonValue): ChatAnalysisSelectionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Errors.CONFLICT('Analysis selection snapshot 格式無效');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(key => !['message_refs', 'capsule_refs'].includes(key)) ||
    !Array.isArray(record.message_refs) ||
    !Array.isArray(record.capsule_refs)
  ) {
    throw Errors.CONFLICT('Analysis selection snapshot 結構無效');
  }
  const messageRefs = record.message_refs
    .map(ref => parseSourceRef(ref, 'chat_message'))
    .sort((left, right) => left.id.localeCompare(right.id));
  const capsuleRefs = record.capsule_refs
    .map(ref => parseSourceRef(ref, 'context_capsule'))
    .sort((left, right) => left.id.localeCompare(right.id));
  const ids = [...messageRefs, ...capsuleRefs].map(ref => `${ref.kind}:${ref.id}`);
  if (new Set(ids).size !== ids.length || ids.length === 0) {
    throw Errors.CONFLICT('Analysis selection snapshot 為空或包含重複 source');
  }
  return { message_refs: messageRefs, capsule_refs: capsuleRefs };
}

export function parseChatAnalysisSelectionSnapshot(
  value: Prisma.JsonValue
): ChatAnalysisSelectionSnapshot {
  return parseSelectionSnapshot(value);
}

export class ChatAnalysisSelectionValidator {
  private async getActiveHumanParticipants(
    tx: Prisma.TransactionClient,
    roomId: string
  ) {
    const participants = await tx.chatParticipant.findMany({
      where: {
        room_id: roomId,
        participant_type: 'user',
        role_in_room: { in: ['roleA', 'roleB'] },
        is_active: true,
        left_at: null,
      },
      select: { id: true, role_in_room: true, joined_at: true },
      orderBy: { id: 'asc' },
    });
    if (participants.length === 0) {
      throw Errors.CONFLICT('聊天室沒有有效的人類參與者');
    }
    return participants;
  }

  async loadEligibleSelection(
    tx: Prisma.TransactionClient,
    roomId: string,
    messageIds: string[],
    capsuleIds: string[],
    now: Date
  ): Promise<EligibleAnalysisSelection> {
    const participants = await this.getActiveHumanParticipants(tx, roomId);
    const requiredParticipantIds = participants.map(participant => participant.id);
    const requiredParticipantSet = new Set(requiredParticipantIds);
    const room = await tx.chatRoom.findUnique({
      where: { id: roomId },
      select: { history_visibility_mode: true },
    });
    if (!room) throw Errors.CONFLICT('聊天室不存在');
    const cutoffParticipant = (
      participants.find(participant => participant.role_in_room === 'roleB')
      ?? participants[0]
    );
    const sharedHistoryAudience = {
      participant: cutoffParticipant,
      historyVisibilityMode: room.history_visibility_mode,
    };

    const messages =
      messageIds.length > 0
        ? await tx.chatMessage.findMany({
            where: {
              id: { in: messageIds },
              room_id: roomId,
              channel: { room_id: roomId, kind: 'shared' },
              message_type: 'user_text',
              visibility_scope: 'all',
              ai_context_eligible: true,
              safety_flag: false,
              sender_participant: { participant_type: 'user' },
              ...buildSharedHistoryCutoffWhere(
                sharedHistoryAudience.participant,
                sharedHistoryAudience.historyVisibilityMode,
              ),
            },
            select: {
              id: true,
              content: true,
              sender_participant_id: true,
              created_at: true,
            },
          })
        : [];
    if (
      messages.length !== messageIds.length ||
      messages.some(message => (
        !requiredParticipantSet.has(message.sender_participant_id)
        || !isWithinSharedHistoryCutoff(
          message.created_at,
          sharedHistoryAudience.participant,
          sharedHistoryAudience.historyVisibilityMode,
        )
      ))
    ) {
      throw Errors.FORBIDDEN('部分訊息不是可用的 shared human message');
    }
    const messageRefs: ContextSourceRef[] = messages
      .map(message => ({
        kind: 'chat_message' as const,
        id: message.id,
        content_hash: textSha256(message.content),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    const capsules =
      capsuleIds.length > 0
        ? await tx.contextCapsule.findMany({
            where: {
              id: { in: capsuleIds },
              room_id: roomId,
              owner_participant_id: { in: requiredParticipantIds },
              policy_version: CHAT_CONTEXT_POLICY_VERSION,
              status: 'approved',
              revoked_at: null,
              expires_at: { gt: now },
              sensitivity_class: { not: 'safety_restricted' },
            },
            include: {
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
                orderBy: { granted_at: 'desc' },
              },
            },
          })
        : [];
    if (capsules.length !== capsuleIds.length) {
      throw Errors.FORBIDDEN('部分 Capsule 未獲有效的 formal-analysis authorization');
    }

    const capsuleRefs: ContextSourceRef[] = [];
    const authorizationRefs: ContextAuthorizationRef[] = [];
    const validUntilCandidates = [new Date(now.getTime() + ANALYSIS_REQUEST_TTL_MS)];
    for (const capsule of capsules) {
      if (!capsule.expires_at) {
        throw Errors.CONFLICT('Capsule 缺少有效期限');
      }
      const authorization = capsule.authorizations.find(
        candidate =>
          candidate.subject_participant_id === capsule.owner_participant_id &&
          candidate.capsule_content_hash === capsule.content_hash
      );
      if (!authorization?.expires_at) {
        throw Errors.FORBIDDEN('Capsule authorization 已失效');
      }
      const recalculatedHash = computeCapsuleContentHash({
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
      if (recalculatedHash !== capsule.content_hash) {
        throw Errors.CONFLICT('Capsule canonical hash 驗證失敗');
      }
      capsuleRefs.push({
        kind: 'context_capsule',
        id: capsule.id,
        version: capsule.version,
        content_hash: capsule.content_hash,
      });
      authorizationRefs.push({
        id: authorization.id,
        capsule_id: capsule.id,
        capsule_content_hash: capsule.content_hash,
      });
      validUntilCandidates.push(capsule.expires_at, authorization.expires_at);
    }
    capsuleRefs.sort((left, right) => left.id.localeCompare(right.id));
    authorizationRefs.sort((left, right) => left.id.localeCompare(right.id));

    const refs = [...messageRefs, ...capsuleRefs];
    const contentHashes = refs.map(ref => {
      if (!ref.content_hash) {
        throw Errors.CONFLICT('Analysis source hash 遺失');
      }
      return ref.content_hash;
    });
    return {
      snapshot: { message_refs: messageRefs, capsule_refs: capsuleRefs },
      authorizationRefs,
      contentHashes,
      requiredParticipantIds,
      validUntil: new Date(Math.min(...validUntilCandidates.map(date => date.getTime()))),
      sharedHistoryAudience,
    };
  }

  verifyRequestEnvelope(
    request: RequestWithApprovals,
    now: Date,
    requireUnexpired: boolean
  ): { storedSnapshot: ChatAnalysisSelectionSnapshot; requiredParticipantIds: string[] } {
    assertCurrentPolicyVersion(request.policy_version);
    assertSha256(request.selection_hash, 'selection_hash');
    if (requireUnexpired && request.expires_at <= now) {
      throw Errors.CONFLICT('Analysis request 已過期');
    }
    const storedSnapshot = parseChatAnalysisSelectionSnapshot(request.selection_snapshot);
    const requiredParticipantIds = [...new Set(request.required_participant_ids)].sort();
    if (
      requiredParticipantIds.length === 0 ||
      requiredParticipantIds.length !== request.required_participant_ids.length
    ) {
      throw Errors.CONFLICT('Analysis request required participants 無效');
    }
    const recalculatedHash = computeAnalysisSelectionHash({
      policyVersion: request.policy_version,
      requiredParticipantIds,
      roomId: request.room_id,
      selectionSnapshot: storedSnapshot,
    });
    if (recalculatedHash !== request.selection_hash) {
      throw Errors.CONFLICT('Analysis request canonical hash 驗證失敗');
    }
    return { storedSnapshot, requiredParticipantIds };
  }

  async verifyRequestSources(
    tx: Prisma.TransactionClient,
    request: RequestWithApprovals,
    now: Date
  ): Promise<VerifiedAnalysisRequest> {
    const envelope = this.verifyRequestEnvelope(request, now, true);
    const eligible = await this.loadEligibleSelection(
      tx,
      request.room_id,
      envelope.storedSnapshot.message_refs.map(ref => ref.id),
      envelope.storedSnapshot.capsule_refs.map(ref => ref.id),
      now
    );
    if (
      canonicalJson(eligible.snapshot) !== canonicalJson(envelope.storedSnapshot) ||
      canonicalJson(eligible.requiredParticipantIds) !==
        canonicalJson(envelope.requiredParticipantIds)
    ) {
      throw Errors.CONFLICT('Analysis request 的 source 或 participants 已變更');
    }
    return { ...eligible, storedSnapshot: envelope.storedSnapshot };
  }
}

export const chatAnalysisSelectionValidator = new ChatAnalysisSelectionValidator();
