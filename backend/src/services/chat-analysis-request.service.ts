import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CreateChatAnalysisRequestInput,
  DecideChatAnalysisRequestInput,
} from '@emorapy/contracts/chat';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import {
  CHAT_CONTEXT_POLICY_VERSION,
  assertCurrentPolicyVersion,
  assertSha256,
  computeAnalysisSelectionHash,
  isTransactionWriteConflict,
  isUniqueConstraintError,
  normalizeOptionalIds,
} from '../utils/chat-context-validation';
import {
  ChatActorAccessService,
  chatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';
import {
  ChatAnalysisSelectionValidator,
  chatAnalysisSelectionValidator,
} from './chat-analysis-selection.validator';
import { writeContextUseAudit } from './chat-context-audit.repository';

type Clock = () => Date;
type ActorAccess = Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>;
type SelectionValidator = Pick<
  ChatAnalysisSelectionValidator,
  'loadEligibleSelection' | 'verifyRequestEnvelope' | 'verifyRequestSources'
>;

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class ChatAnalysisRequestService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly actorAccess: ActorAccess = chatActorAccessService,
    private readonly clock: Clock = () => new Date(),
    private readonly selectionValidator: SelectionValidator = chatAnalysisSelectionValidator
  ) {}

  private async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        throw Errors.CONFLICT('Analysis consent 狀態正被另一請求更新，請重新載入');
      }
      throw error;
    }
  }

  async cancelActiveForParticipantDeparture(
    tx: Prisma.TransactionClient,
    roomId: string,
    participantId: string,
    now: Date,
  ): Promise<number> {
    const result = await tx.chatAnalysisRequest.updateMany({
      where: {
        room_id: roomId,
        required_participant_ids: { has: participantId },
        status: { in: ['pending_approval', 'approved', 'submitted'] },
      },
      data: { status: 'cancelled', cancelled_at: now },
    });
    return result.count;
  }

  async createRequest(
    roomId: string,
    actor: ChatActorContext,
    input: CreateChatAnalysisRequestInput
  ) {
    const messageIds = normalizeOptionalIds(input.selected_message_ids, 'selected_message_ids');
    const capsuleIds = normalizeOptionalIds(input.selected_capsule_ids, 'selected_capsule_ids', 50);
    if (messageIds.length + capsuleIds.length === 0) {
      throw Errors.VALIDATION_ERROR('Analysis request 至少需要一項 source');
    }
    const now = this.clock();
    try {
      return await this.transaction(async tx => {
        const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        if (participant.role_in_room !== 'roleA') {
          throw Errors.FORBIDDEN('目前版本只允許 A 方建立 Analysis request');
        }
        await tx.chatAnalysisRequest.updateMany({
          where: {
            room_id: roomId,
            status: { in: ['pending_approval', 'approved', 'submitted'] },
            expires_at: { lte: now },
          },
          data: { status: 'expired' },
        });
        const eligible = await this.selectionValidator.loadEligibleSelection(
          tx,
          roomId,
          messageIds,
          capsuleIds,
          now
        );
        if (!eligible.requiredParticipantIds.includes(participant.id)) {
          throw Errors.FORBIDDEN('你不是此 Analysis request 的 required participant');
        }
        const selectionHash = computeAnalysisSelectionHash({
          policyVersion: CHAT_CONTEXT_POLICY_VERSION,
          requiredParticipantIds: eligible.requiredParticipantIds,
          roomId,
          selectionSnapshot: eligible.snapshot,
        });
        const request = await tx.chatAnalysisRequest.create({
          data: {
            room_id: roomId,
            requested_by_participant_id: participant.id,
            status: 'pending_approval',
            selection_snapshot: toInputJson(eligible.snapshot),
            selection_hash: selectionHash,
            required_participant_ids: eligible.requiredParticipantIds,
            policy_version: CHAT_CONTEXT_POLICY_VERSION,
            expires_at: eligible.validUntil,
          },
        });
        await writeContextUseAudit(tx, {
          roomId,
          actorParticipantId: participant.id,
          analysisRequestId: request.id,
          purpose: 'formal_analysis_evidence',
          audience: 'analysis_participants',
          targetType: 'analysis_request',
          targetId: request.id,
          decision: 'allowed',
          reasonCode: 'analysis_request_created',
          sourceRefs: [...eligible.snapshot.message_refs, ...eligible.snapshot.capsule_refs],
          authorizationRefs: eligible.authorizationRefs,
          contentHashes: eligible.contentHashes,
        });
        return request;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw Errors.CONFLICT('此共同空間已有進行中的 Analysis request');
      }
      throw error;
    }
  }

  async decideRequest(
    roomId: string,
    requestId: string,
    actor: ChatActorContext,
    input: DecideChatAnalysisRequestInput
  ) {
    assertSha256(input.selection_hash, 'selection_hash');
    assertCurrentPolicyVersion(input.policy_version);
    if (!['approved', 'declined'].includes(input.decision)) {
      throw Errors.VALIDATION_ERROR('不支援的 Analysis approval decision');
    }
    const now = this.clock();
    try {
      return await this.transaction(async tx => {
        const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        const request = await tx.chatAnalysisRequest.findFirst({
          where: { id: requestId, room_id: roomId },
          include: { participant_approvals: true },
        });
        if (!request) {
          throw Errors.FORBIDDEN('你不能操作此 Analysis request');
        }
        if (!['pending_approval', 'approved'].includes(request.status)) {
          throw Errors.CONFLICT('Analysis request 狀態不允許批准');
        }
        if (
          request.selection_hash !== input.selection_hash ||
          request.policy_version !== input.policy_version
        ) {
          throw Errors.CONFLICT('Analysis request hash 或 policy version 已變更');
        }
        const envelope = this.selectionValidator.verifyRequestEnvelope(request, now, true);
        if (!envelope.requiredParticipantIds.includes(participant.id)) {
          throw Errors.FORBIDDEN('你不是此 request 的 required participant');
        }
        const verified =
          input.decision === 'approved'
            ? await this.selectionValidator.verifyRequestSources(tx, request, now)
            : undefined;
        const existing = request.participant_approvals.find(
          approval => approval.participant_id === participant.id
        );
        if (existing) {
          if (
            existing.decision === input.decision &&
            existing.selection_hash === input.selection_hash &&
            !existing.revoked_at
          ) {
            return existing;
          }
          throw Errors.CONFLICT('你已對此 exact selection 作出決定');
        }

        const approval = await tx.chatAnalysisParticipantApproval.create({
          data: {
            analysis_request_id: request.id,
            participant_id: participant.id,
            decision: input.decision,
            selection_hash: request.selection_hash,
            policy_version: request.policy_version,
            expires_at: request.expires_at,
          },
        });
        if (input.decision === 'declined') {
          await tx.chatAnalysisRequest.updateMany({
            where: { id: request.id, status: { in: ['pending_approval', 'approved'] } },
            data: { status: 'cancelled', cancelled_at: now },
          });
        } else {
          const approvalCount = await tx.chatAnalysisParticipantApproval.count({
            where: {
              analysis_request_id: request.id,
              participant_id: { in: envelope.requiredParticipantIds },
              decision: 'approved',
              selection_hash: request.selection_hash,
              policy_version: request.policy_version,
              expires_at: { gt: now },
              revoked_at: null,
            },
          });
          if (approvalCount === envelope.requiredParticipantIds.length) {
            await tx.chatAnalysisRequest.updateMany({
              where: { id: request.id, status: 'pending_approval' },
              data: { status: 'approved' },
            });
          }
        }

        const sourceRefs = verified
          ? [...verified.snapshot.message_refs, ...verified.snapshot.capsule_refs]
          : [...envelope.storedSnapshot.message_refs, ...envelope.storedSnapshot.capsule_refs];
        await writeContextUseAudit(tx, {
          roomId,
          actorParticipantId: participant.id,
          analysisRequestId: request.id,
          purpose: 'formal_analysis_evidence',
          audience: 'analysis_participants',
          targetType: 'analysis_request',
          targetId: request.id,
          decision: input.decision === 'approved' ? 'allowed' : 'denied',
          reasonCode:
            input.decision === 'approved'
              ? 'analysis_participant_approved'
              : 'analysis_participant_declined',
          sourceRefs,
          authorizationRefs: verified?.authorizationRefs ?? [],
          contentHashes: sourceRefs.map(ref => {
            if (!ref.content_hash) {
              throw Errors.CONFLICT('Analysis source hash 遺失');
            }
            return ref.content_hash;
          }),
        });
        return approval;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw Errors.CONFLICT('你已對此 Analysis request 作出決定');
      }
      throw error;
    }
  }

  async revokeApproval(
    roomId: string,
    requestId: string,
    actor: ChatActorContext,
    input: { selection_hash: string; policy_version: string }
  ) {
    assertSha256(input.selection_hash, 'selection_hash');
    assertCurrentPolicyVersion(input.policy_version);
    const now = this.clock();
    return this.transaction(async tx => {
      const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
        roomId,
        actor,
        tx
      );
      const request = await tx.chatAnalysisRequest.findFirst({
        where: { id: requestId, room_id: roomId },
        include: { participant_approvals: true },
      });
      if (!request) {
        throw Errors.FORBIDDEN('你不能操作此 Analysis request');
      }
      if (['processing', 'completed'].includes(request.status)) {
        throw Errors.CONFLICT('Analysis 已開始處理，不能撤回既有使用');
      }
      if (
        request.selection_hash !== input.selection_hash ||
        request.policy_version !== input.policy_version
      ) {
        throw Errors.CONFLICT('Analysis request hash 或 policy version 已變更');
      }
      const envelope = this.selectionValidator.verifyRequestEnvelope(request, now, false);
      if (!envelope.requiredParticipantIds.includes(participant.id)) {
        throw Errors.FORBIDDEN('你不是此 request 的 required participant');
      }
      const approval = request.participant_approvals.find(
        candidate =>
          candidate.participant_id === participant.id &&
          candidate.decision === 'approved' &&
          candidate.selection_hash === request.selection_hash &&
          candidate.policy_version === request.policy_version
      );
      if (!approval) {
        throw Errors.NOT_FOUND('找不到你的有效 approval');
      }
      if (approval.revoked_at) {
        return approval;
      }
      const revoked = await tx.chatAnalysisParticipantApproval.updateMany({
        where: { id: approval.id, participant_id: participant.id, revoked_at: null },
        data: { revoked_at: now },
      });
      if (revoked.count !== 1) {
        throw Errors.CONFLICT('Approval 狀態已變更');
      }
      await tx.chatAnalysisRequest.updateMany({
        where: {
          id: request.id,
          status: { in: ['pending_approval', 'approved', 'submitted'] },
        },
        data: { status: 'cancelled', cancelled_at: now },
      });
      await writeContextUseAudit(tx, {
        roomId,
        actorParticipantId: participant.id,
        analysisRequestId: request.id,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        targetType: 'analysis_request',
        targetId: request.id,
        decision: 'denied',
        reasonCode: 'analysis_approval_revoked',
        sourceRefs: [
          ...envelope.storedSnapshot.message_refs,
          ...envelope.storedSnapshot.capsule_refs,
        ],
        authorizationRefs: [],
        contentHashes: [request.selection_hash],
      });
      return tx.chatAnalysisParticipantApproval.findUniqueOrThrow({ where: { id: approval.id } });
    });
  }

  async submitRequest(roomId: string, requestId: string, actor: ChatActorContext) {
    const now = this.clock();
    return this.transaction(async tx => {
      const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
        roomId,
        actor,
        tx
      );
      const request = await tx.chatAnalysisRequest.findFirst({
        where: { id: requestId, room_id: roomId },
        include: { participant_approvals: true },
      });
      if (!request) {
        throw Errors.FORBIDDEN('你不能提交此 Analysis request');
      }
      if (request.requested_by_participant_id !== participant.id) {
        throw Errors.FORBIDDEN('只有 request 發起者可以提交');
      }
      if (!['pending_approval', 'approved'].includes(request.status)) {
        throw Errors.CONFLICT('Analysis request 狀態不允許提交');
      }
      const verified = await this.selectionValidator.verifyRequestSources(tx, request, now);
      for (const requiredParticipantId of verified.requiredParticipantIds) {
        const approval = request.participant_approvals.find(
          candidate =>
            candidate.participant_id === requiredParticipantId &&
            candidate.decision === 'approved' &&
            candidate.selection_hash === request.selection_hash &&
            candidate.policy_version === request.policy_version &&
            candidate.revoked_at === null &&
            candidate.expires_at > now
        );
        if (!approval) {
          throw Errors.FORBIDDEN('所有 required participants 必須批准同一 exact selection');
        }
      }

      const submitted = await tx.chatAnalysisRequest.updateMany({
        where: {
          id: request.id,
          selection_hash: request.selection_hash,
          policy_version: request.policy_version,
          expires_at: { gt: now },
          status: { in: ['pending_approval', 'approved'] },
        },
        data: { status: 'submitted', submitted_at: now },
      });
      if (submitted.count !== 1) {
        throw Errors.CONFLICT('Analysis request 在提交前已變更');
      }
      await writeContextUseAudit(tx, {
        roomId,
        actorParticipantId: participant.id,
        analysisRequestId: request.id,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        targetType: 'analysis_request',
        targetId: request.id,
        decision: 'allowed',
        reasonCode: 'analysis_request_submitted',
        sourceRefs: [...verified.snapshot.message_refs, ...verified.snapshot.capsule_refs],
        authorizationRefs: verified.authorizationRefs,
        contentHashes: [...verified.contentHashes, request.selection_hash],
      });
      return tx.chatAnalysisRequest.findUniqueOrThrow({ where: { id: request.id } });
    });
  }
}

export const chatAnalysisRequestService = new ChatAnalysisRequestService();
