import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import {
  computeAnalysisSelectionHash,
  computeCapsuleContentHash,
  textSha256,
} from '../utils/chat-context-validation';
import {
  chatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';
import {
  chatAnalysisSelectionValidator,
  parseChatAnalysisSelectionSnapshot,
} from './chat-analysis-selection.validator';
import {
  buildSharedHistoryCutoffWhere,
  isWithinSharedHistoryCutoff,
} from './chat-message-audience-policy';

export type SubmittedAnalysisEvidenceBundle = {
  requestId: string;
  selectionHash: string;
  policyVersion: string;
  requiredParticipantIds: string[];
  approvalIds: string[];
  messages: Array<{
    id: string;
    content: string;
    senderParticipantId: string;
    senderRole: 'roleA' | 'roleB';
    createdAt: Date;
  }>;
  capsules: Array<{
    id: string;
    summary: string;
    ownerParticipantId: string;
    ownerRole: 'roleA' | 'roleB';
    contentHash: string;
  }>;
};

export type ChatCaseGenerationConsentInput = {
  roomId: string;
  conversionSnapshot: Prisma.JsonValue | null;
  hasDefendantMaterial: boolean;
  expectedRequestId?: string;
};

type AnalysisReference = {
  id: string;
  selectionHash: string;
  policyVersion: string;
  approvalIds: string[];
  messageIds: string[];
  capsuleIds: string[];
  capsuleContentHashes: string[];
};

function sortedUniqueStrings(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw Errors.CONFLICT(`Chat conversion ${fieldName} 格式無效`);
  }
  const values = (value as string[]).slice().sort();
  if (new Set(values).size !== values.length) {
    throw Errors.CONFLICT(`Chat conversion ${fieldName} 包含重複值`);
  }
  return values;
}

function parseAnalysisReference(
  value: Prisma.JsonValue | null,
  hasDefendantMaterial: boolean,
): AnalysisReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (hasDefendantMaterial) {
      throw Errors.CASE_NOT_READY('Chat 案件缺少可驗證的 exact approval', {
        reason_code: 'CHAT_ANALYSIS_APPROVAL_REQUIRED',
      });
    }
    return null;
  }
  const snapshot = value as Record<string, unknown>;
  const analysis = snapshot.analysis_request;
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    if (hasDefendantMaterial) {
      throw Errors.CASE_NOT_READY('Chat 案件缺少可驗證的 exact approval', {
        reason_code: 'CHAT_ANALYSIS_APPROVAL_REQUIRED',
      });
    }
    return null;
  }
  const record = analysis as Record<string, unknown>;
  if (
    typeof record.id !== 'string'
    || typeof record.selection_hash !== 'string'
    || typeof record.policy_version !== 'string'
  ) {
    throw Errors.CONFLICT('Chat conversion analysis reference 格式無效');
  }
  return {
    id: record.id,
    selectionHash: record.selection_hash,
    policyVersion: record.policy_version,
    approvalIds: sortedUniqueStrings(record.approval_ids, 'approval_ids'),
    messageIds: sortedUniqueStrings(snapshot.included_message_ids, 'included_message_ids'),
    capsuleIds: sortedUniqueStrings(record.capsule_ids, 'capsule_ids'),
    capsuleContentHashes: sortedUniqueStrings(
      record.capsule_content_hashes,
      'capsule_content_hashes',
    ),
  };
}

function assertExactArray(actual: string[], expected: string[], fieldName: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw Errors.CONFLICT(`Chat conversion ${fieldName} 與 original exact selection 不符`);
  }
}

export class ChatAnalysisEvidenceService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Reload evidence for an already-consumed request. This deliberately does not
   * re-apply current approval expiry, authorization, participant-active, or join
   * cutoff gates: those gates were atomically satisfied when submitted became
   * processing. It still binds recovery to the original canonical envelope and
   * verifies that every raw source remains present and byte-identical.
   */
  private async loadConsumedProcessingEvidence(
    tx: Prisma.TransactionClient,
    roomId: string,
    reference: AnalysisReference,
    actor: ChatActorContext,
  ): Promise<SubmittedAnalysisEvidenceBundle> {
    const { participant } = await chatActorAccessService.resolveActiveHumanParticipant(
      roomId,
      actor,
      tx,
    );
    const request = await tx.chatAnalysisRequest.findFirst({
      where: { id: reference.id, room_id: roomId },
      include: { participant_approvals: true },
    });
    if (!request || request.requested_by_participant_id !== participant.id) {
      throw Errors.FORBIDDEN('只有 Analysis request 發起者可恢復此證據集合');
    }
    if (request.status !== 'processing') {
      throw Errors.CONFLICT('Analysis request 不是可恢復的 processing 狀態');
    }
    if (
      request.selection_hash !== reference.selectionHash
      || request.policy_version !== reference.policyVersion
    ) {
      throw Errors.CONFLICT('Analysis request 與 original conversion reference 不符');
    }

    const snapshot = parseChatAnalysisSelectionSnapshot(request.selection_snapshot);
    const requiredParticipantIds = [...new Set(request.required_participant_ids)].sort();
    if (
      requiredParticipantIds.length === 0
      || requiredParticipantIds.length !== request.required_participant_ids.length
      || computeAnalysisSelectionHash({
        policyVersion: request.policy_version,
        requiredParticipantIds,
        roomId,
        selectionSnapshot: snapshot,
      }) !== request.selection_hash
    ) {
      throw Errors.CONFLICT('Analysis request canonical envelope 已變更');
    }

    const approvedIds = request.participant_approvals
      .filter(approval => (
        approval.decision === 'approved'
        && approval.selection_hash === request.selection_hash
        && approval.policy_version === request.policy_version
        && requiredParticipantIds.includes(approval.participant_id)
      ))
      .map(approval => approval.id)
      .sort();
    assertExactArray(approvedIds, reference.approvalIds, 'approval_ids');
    assertExactArray(
      snapshot.message_refs.map(ref => ref.id).sort(),
      reference.messageIds,
      'included_message_ids',
    );
    assertExactArray(
      snapshot.capsule_refs.map(ref => ref.id).sort(),
      reference.capsuleIds,
      'capsule_ids',
    );
    assertExactArray(
      snapshot.capsule_refs.map(ref => {
        if (!ref.content_hash) {
          throw Errors.CONFLICT('Analysis capsule content hash 遺失');
        }
        return ref.content_hash;
      }).sort(),
      reference.capsuleContentHashes,
      'capsule_content_hashes',
    );

    const messageRefs = snapshot.message_refs;
    const messages = messageRefs.length === 0
      ? []
      : await tx.chatMessage.findMany({
          where: {
            id: { in: messageRefs.map(ref => ref.id) },
            room_id: roomId,
            channel: { is: { room_id: roomId, kind: 'shared' } },
            message_type: 'user_text',
            visibility_scope: 'all',
            ai_context_eligible: true,
            safety_flag: false,
          },
          select: {
            id: true,
            content: true,
            sender_participant_id: true,
            created_at: true,
            sender_participant: { select: { role_in_room: true } },
          },
        });
    const messageRefById = new Map(messageRefs.map(ref => [ref.id, ref]));
    if (
      messages.length !== messageRefs.length
      || messages.some(message => (
        !['roleA', 'roleB'].includes(message.sender_participant.role_in_room)
        || messageRefById.get(message.id)?.content_hash !== textSha256(message.content)
      ))
    ) {
      throw Errors.CONFLICT('Consumed Analysis message source 已變更');
    }

    const capsuleRefs = snapshot.capsule_refs;
    const capsules = capsuleRefs.length === 0
      ? []
      : await tx.contextCapsule.findMany({
          where: { id: { in: capsuleRefs.map(ref => ref.id) }, room_id: roomId },
          select: {
            id: true,
            room_id: true,
            source_channel_id: true,
            owner_participant_id: true,
            lineage_id: true,
            version: true,
            summary: true,
            source_refs: true,
            policy_version: true,
            content_hash: true,
            expires_at: true,
            owner_participant: { select: { role_in_room: true } },
          },
        });
    const capsuleRefById = new Map(capsuleRefs.map(ref => [ref.id, ref]));
    if (
      capsules.length !== capsuleRefs.length
      || capsules.some(capsule => (
        !capsule.expires_at
        || !['roleA', 'roleB'].includes(capsule.owner_participant.role_in_room)
        || capsuleRefById.get(capsule.id)?.content_hash !== capsule.content_hash
        || computeCapsuleContentHash({
          expiresAt: capsule.expires_at,
          lineageId: capsule.lineage_id,
          ownerParticipantId: capsule.owner_participant_id,
          policyVersion: capsule.policy_version,
          roomId: capsule.room_id,
          sourceChannelId: capsule.source_channel_id,
          sourceRefs: capsule.source_refs,
          summary: capsule.summary,
          version: capsule.version,
        }) !== capsule.content_hash
      ))
    ) {
      throw Errors.CONFLICT('Consumed Analysis capsule source 已變更');
    }

    return {
      requestId: request.id,
      selectionHash: request.selection_hash,
      policyVersion: request.policy_version,
      requiredParticipantIds,
      approvalIds: approvedIds,
      messages: messages
        .map(message => ({
          id: message.id,
          content: message.content,
          senderParticipantId: message.sender_participant_id,
          senderRole: message.sender_participant.role_in_room as 'roleA' | 'roleB',
          createdAt: message.created_at,
        }))
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      capsules: capsules
        .map(capsule => ({
          id: capsule.id,
          summary: capsule.summary,
          ownerParticipantId: capsule.owner_participant_id,
          ownerRole: capsule.owner_participant.role_in_room as 'roleA' | 'roleB',
          contentHash: capsule.content_hash,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    };
  }

  private async loadVerifiedEvidence(
    tx: Prisma.TransactionClient,
    roomId: string,
    requestId: string,
    actor: ChatActorContext,
    allowedStatuses: Array<'submitted' | 'processing'>,
    expected?: { selectionHash?: string; policyVersion?: string },
  ): Promise<{ requestStatus: 'submitted' | 'processing'; evidence: SubmittedAnalysisEvidenceBundle }> {
    const now = new Date();
    const { participant } = await chatActorAccessService.resolveActiveHumanParticipant(
      roomId,
      actor,
      tx,
    );
    const request = await tx.chatAnalysisRequest.findFirst({
      where: { id: requestId, room_id: roomId },
      include: { participant_approvals: true },
    });
    if (!request || request.requested_by_participant_id !== participant.id) {
      throw Errors.FORBIDDEN('只有 Analysis request 發起者可使用此證據集合');
    }
    if (!allowedStatuses.includes(request.status as 'submitted' | 'processing')) {
      throw Errors.CONFLICT('Analysis request 尚未完成精確批准，或已被撤回');
    }
    if (
      (expected?.selectionHash && request.selection_hash !== expected.selectionHash)
      || (expected?.policyVersion && request.policy_version !== expected.policyVersion)
    ) {
      throw Errors.CONFLICT('Analysis request 與 original conversion reference 不符');
    }

    const verified = await chatAnalysisSelectionValidator.verifyRequestSources(tx, request, now);
    const approvals = verified.requiredParticipantIds.map((requiredParticipantId) => {
      const approval = request.participant_approvals.find(candidate => (
        candidate.participant_id === requiredParticipantId
        && candidate.decision === 'approved'
        && candidate.selection_hash === request.selection_hash
        && candidate.policy_version === request.policy_version
        && candidate.revoked_at === null
        && candidate.expires_at > now
      ));
      if (!approval) {
        throw Errors.FORBIDDEN('所有參與者必須批准同一 exact selection');
      }
      return approval;
    });

    const messageRefs = verified.snapshot.message_refs;
    const messages = messageRefs.length === 0
      ? []
      : await tx.chatMessage.findMany({
          where: {
            id: { in: messageRefs.map(ref => ref.id) },
            room_id: roomId,
            channel: { is: { room_id: roomId, kind: 'shared' } },
            message_type: 'user_text',
            visibility_scope: 'all',
            ai_context_eligible: true,
            safety_flag: false,
            sender_participant: {
              is: {
                participant_type: 'user',
                role_in_room: { in: ['roleA', 'roleB'] },
                is_active: true,
                left_at: null,
              },
            },
            ...buildSharedHistoryCutoffWhere(
              verified.sharedHistoryAudience.participant,
              verified.sharedHistoryAudience.historyVisibilityMode,
            ),
          },
          select: {
            id: true,
            content: true,
            sender_participant_id: true,
            created_at: true,
            sender_participant: { select: { role_in_room: true } },
          },
        });
    const messageRefById = new Map(messageRefs.map(ref => [ref.id, ref]));
    if (
      messages.length !== messageRefs.length
      || messages.some((message) => (
        !['roleA', 'roleB'].includes(message.sender_participant.role_in_room)
        || !isWithinSharedHistoryCutoff(
          message.created_at,
          verified.sharedHistoryAudience.participant,
          verified.sharedHistoryAudience.historyVisibilityMode,
        )
        || messageRefById.get(message.id)?.content_hash !== textSha256(message.content)
      ))
    ) {
      throw Errors.CONFLICT('Analysis message source 已變更');
    }

    const capsuleRefs = verified.snapshot.capsule_refs;
    const capsules = capsuleRefs.length === 0
      ? []
      : await tx.contextCapsule.findMany({
          where: { id: { in: capsuleRefs.map(ref => ref.id) }, room_id: roomId },
          select: {
            id: true,
            summary: true,
            owner_participant_id: true,
            content_hash: true,
            owner_participant: { select: { role_in_room: true } },
          },
        });
    const capsuleRefById = new Map(capsuleRefs.map(ref => [ref.id, ref]));
    if (
      capsules.length !== capsuleRefs.length
      || capsules.some((capsule) => (
        !['roleA', 'roleB'].includes(capsule.owner_participant.role_in_room)
        || capsuleRefById.get(capsule.id)?.content_hash !== capsule.content_hash
      ))
    ) {
      throw Errors.CONFLICT('Analysis capsule source 已變更');
    }

    return {
      requestStatus: request.status as 'submitted' | 'processing',
      evidence: {
        requestId: request.id,
        selectionHash: request.selection_hash,
        policyVersion: request.policy_version,
        requiredParticipantIds: verified.requiredParticipantIds,
        approvalIds: approvals.map(approval => approval.id).sort(),
        messages: messages
          .map(message => ({
            id: message.id,
            content: message.content,
            senderParticipantId: message.sender_participant_id,
            senderRole: message.sender_participant.role_in_room as 'roleA' | 'roleB',
            createdAt: message.created_at,
          }))
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
        capsules: capsules
          .map(capsule => ({
            id: capsule.id,
            summary: capsule.summary,
            ownerParticipantId: capsule.owner_participant_id,
            ownerRole: capsule.owner_participant.role_in_room as 'roleA' | 'roleB',
            contentHash: capsule.content_hash,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      },
    };
  }

  async resolveSubmitted(
    roomId: string,
    requestId: string,
    actor: ChatActorContext,
  ): Promise<SubmittedAnalysisEvidenceBundle> {
    return this.db.$transaction(async tx => (
      await this.loadVerifiedEvidence(tx, roomId, requestId, actor, ['submitted'])
    ).evidence, { isolationLevel: 'Serializable' });
  }

  async claimSubmittedForProcessing(
    roomId: string,
    requestId: string,
    actor: ChatActorContext,
    expectedSelectionHash: string,
  ): Promise<SubmittedAnalysisEvidenceBundle> {
    return this.db.$transaction(
      tx => this.claimSubmittedForProcessingInTransaction(
        tx,
        roomId,
        requestId,
        actor,
        expectedSelectionHash,
      ),
      { isolationLevel: 'Serializable' },
    );
  }

  async claimSubmittedForProcessingInTransaction(
    tx: Prisma.TransactionClient,
    roomId: string,
    requestId: string,
    actor: ChatActorContext,
    expectedSelectionHash?: string,
  ): Promise<SubmittedAnalysisEvidenceBundle> {
    const verified = await this.loadVerifiedEvidence(
      tx,
      roomId,
      requestId,
      actor,
      ['submitted'],
      expectedSelectionHash ? { selectionHash: expectedSelectionHash } : undefined,
    );
    const updated = await tx.chatAnalysisRequest.updateMany({
      where: {
        id: requestId,
        room_id: roomId,
        selection_hash: verified.evidence.selectionHash,
        policy_version: verified.evidence.policyVersion,
        status: 'submitted',
      },
      data: { status: 'processing' },
    });
    if (updated.count !== 1) throw Errors.CONFLICT('Analysis request 狀態已變更');
    return verified.evidence;
  }

  async claimCaseGeneration(
    input: ChatCaseGenerationConsentInput,
    actor: ChatActorContext,
  ): Promise<SubmittedAnalysisEvidenceBundle | null> {
    return this.db.$transaction(
      tx => this.claimCaseGenerationInTransaction(tx, input, actor),
      { isolationLevel: 'Serializable' },
    );
  }

  async claimCaseGenerationInTransaction(
    tx: Prisma.TransactionClient,
    input: ChatCaseGenerationConsentInput,
    actor: ChatActorContext,
  ): Promise<SubmittedAnalysisEvidenceBundle | null> {
      const reference = parseAnalysisReference(
        input.conversionSnapshot,
        input.hasDefendantMaterial,
      );
      if (!reference) return null;
      if (input.expectedRequestId && input.expectedRequestId !== reference.id) {
        throw Errors.CONFLICT('Retry 必須使用 original analysis request');
      }
      const requestState = await tx.chatAnalysisRequest.findFirst({
        where: { id: reference.id, room_id: input.roomId },
        select: { status: true },
      });
      if (!requestState) throw Errors.FORBIDDEN('找不到 original analysis request');
      const verified = requestState.status === 'submitted'
        ? await this.loadVerifiedEvidence(
            tx,
            input.roomId,
            reference.id,
            actor,
            ['submitted'],
            {
              selectionHash: reference.selectionHash,
              policyVersion: reference.policyVersion,
            },
          )
        : null;
      const evidence = requestState.status === 'processing'
        ? await this.loadConsumedProcessingEvidence(tx, input.roomId, reference, actor)
        : verified?.evidence;
      if (!evidence) {
        throw Errors.CONFLICT('Analysis request 尚未開始或已完成/取消');
      }
      assertExactArray(
        evidence.messages.map(message => message.id).sort(),
        reference.messageIds,
        'included_message_ids',
      );
      assertExactArray(evidence.approvalIds, reference.approvalIds, 'approval_ids');
      assertExactArray(
        evidence.capsules.map(capsule => capsule.id).sort(),
        reference.capsuleIds,
        'capsule_ids',
      );
      assertExactArray(
        evidence.capsules.map(capsule => capsule.contentHash).sort(),
        reference.capsuleContentHashes,
        'capsule_content_hashes',
      );

      if (verified?.requestStatus === 'submitted') {
        const claimed = await tx.chatAnalysisRequest.updateMany({
          where: {
            id: reference.id,
            room_id: input.roomId,
            selection_hash: reference.selectionHash,
            policy_version: reference.policyVersion,
            status: 'submitted',
          },
          data: { status: 'processing' },
        });
        if (claimed.count !== 1) {
          throw Errors.CONFLICT('Analysis request 在 Judgment 開始前已變更');
        }
      }
      return evidence;
  }

  async markCompleted(
    requestId: string,
    db: Pick<Prisma.TransactionClient, 'chatAnalysisRequest'> = this.db,
  ): Promise<void> {
    const transitioned = await db.chatAnalysisRequest.updateMany({
      where: { id: requestId, status: { in: ['submitted', 'processing'] } },
      data: { status: 'completed' },
    });
    if (transitioned.count === 1) return;

    const current = await db.chatAnalysisRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    if (current?.status === 'completed') return;
    throw Errors.CONFLICT('Analysis request 無法完成，狀態已變更');
  }

}

export const chatAnalysisEvidenceService = new ChatAnalysisEvidenceService();
