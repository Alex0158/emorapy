import {
  CaseMode,
  CaseStatus,
  ChatHistoryVisibilityMode,
  ChatRoomStatus,
  ChatVisibilityScope,
  PairingStatus,
  PairingType,
  Prisma,
  type ChatParticipant,
} from '@prisma/client';
import prisma from '../config/database';
import logger from '../config/logger';
import type { BackendLocale } from '../i18n';
import { buildCaseSourceTracking } from '../utils/case-classifier';
import { LOCK_TTL } from '../utils/constants';
import { Errors } from '../utils/errors';
import { lockService } from '../utils/lock';
import { buildActiveNormalPairingWhere } from '../utils/pairing-invariant';
import { getChatJudgmentRequestPolicy } from '../utils/product-safety-policy';
import {
  chatActorAccessService,
  type AccessibleChatRoom,
  type ChatActorContext,
} from './chat-actor-access.service';
import {
  chatAnalysisEvidenceService,
  type SubmittedAnalysisEvidenceBundle,
} from './chat-analysis-evidence.service';
import { chatChannelService } from './chat-channel.service';
import { chatFormalAnalysisClaimService } from './chat-formal-analysis-claim.service';
import { chatMetricsService } from './chat-metrics.service';
import { chatSafetyRouterService } from './chat-safety-router.service';
import {
  buildSharedContextMessageWhere,
} from './chat-message-audience-policy';
import { analyzeMessageLayers, buildChatJudgmentStatement } from './chat-message-analysis';
import { aiService } from './ai.service';
import { judgmentService } from './judgment.service';
import { pairingService } from './pairing.service';
import { safetyAssessmentService } from './safety-assessment.service';
import { safetyRoutingService, type JudgmentRoute } from './safety-routing.service';

export type RequestChatJudgmentOptions = {
  includedMessageIds?: string[];
  analysisRequestId?: string;
  locale?: BackendLocale;
};

export type RequestChatJudgmentResult = {
  roomId: string;
  caseId: string;
  judgmentId?: string;
  linkId?: string;
  status: ChatRoomStatus;
};

type ChatRouteSafetyAssessmentInput = {
  roomId: string;
  route: JudgmentRoute;
  reasons: string[];
  detectedFlags: string[];
  assessedByUserId?: string | null;
  outcome: 'blocked' | 'judgment_completed';
  caseId?: string | null;
  linkId?: string | null;
  judgmentId?: string | null;
  firstMessageId?: string | null;
  lastMessageId?: string | null;
  totalUserMessages: number;
  roleAMessageCount: number;
  roleBMessageCount: number;
  roleBMessagesIncluded: boolean;
  roleBConsentAsserted: boolean;
  roleBParticipantId?: string | null;
  roleBUserId?: string | null;
  informationGaps: string[];
  transformConfidence: string;
};

type RecentChatToCaseLink = Prisma.ChatToCaseLinkGetPayload<{
  include: {
    judgment: { select: { id: true } };
    case: {
      select: {
        id: true;
        status: true;
        judgment: { select: { id: true } };
      };
    };
  };
}>;

type BlockedSafetyContext = {
  assessment: ChatRouteSafetyAssessmentInput;
  aiParticipantId?: string;
  noticeMessage?: string;
  detectedFlags: string[];
};

const DEFAULT_CHAT_CASE_TYPE = '其他衝突';

class PersistedJudgmentFinalizationError extends Error {
  readonly name = 'PersistedJudgmentFinalizationError';

  constructor(
    readonly judgmentId: string,
    readonly finalizationError: unknown,
  ) {
    super('Judgment 已持久化，但 Chat 狀態尚未完成對齊');
  }
}

class PairingUniqueRaceError extends Error {
  readonly name = 'PairingUniqueRaceError';

  constructor(readonly pairingError: unknown) {
    super('Pairing uniqueness race aborted Chat judgment preparation');
  }
}

function buildChatToCaseTitle(locale: BackendLocale | undefined, now: Date): string {
  const date = now.toISOString().slice(0, 10);
  return locale === 'en-US' ? `Chat to Analysis-${date}` : `聊天室轉梳理結果-${date}`;
}

function conversionSnapshotIncludesRoleB(value: Prisma.JsonValue | null): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const roleBMessages = (value as Record<string, unknown>).roleB_messages;
  return typeof roleBMessages === 'number' && roleBMessages > 0;
}

function conversionSnapshotAnalysisRequestId(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const analysisRequest = (value as Record<string, unknown>).analysis_request;
  if (!analysisRequest || typeof analysisRequest !== 'object' || Array.isArray(analysisRequest)) {
    return null;
  }
  const requestId = (analysisRequest as Record<string, unknown>).id;
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : null;
}

/**
 * Coordinates the Chat-to-Analysis handoff. Exact evidence consumption, room
 * transitions, Case/Link persistence and external judgment generation remain
 * centralized here so retry and first-run paths share one lifecycle boundary.
 */
export class ChatJudgmentOrchestrator {
  private inFlightByRoom = new Map<string, Promise<RequestChatJudgmentResult>>();

  private async recordRouteSafetyAssessmentBestEffort(
    input: ChatRouteSafetyAssessmentInput,
  ): Promise<void> {
    try {
      await safetyAssessmentService.recordRouteAssessment(
        { subjectType: 'chat_room', subjectId: input.roomId },
        input.route,
        {
          source: 'chat_judgment_policy',
          reasons: input.reasons,
          assessedByUserId: input.assessedByUserId ?? null,
          updateActiveRiskState: input.route !== 'standard',
          metadata: {
            outcome: input.outcome,
            room_id: input.roomId,
            case_id: input.caseId ?? null,
            link_id: input.linkId ?? null,
            judgment_id: input.judgmentId ?? null,
            detected_flags: input.detectedFlags,
            source_message_range: {
              first_message_id: input.firstMessageId ?? null,
              last_message_id: input.lastMessageId ?? null,
              total_user_messages: input.totalUserMessages,
            },
            participant_consent: {
              role_b_messages_included: input.roleBMessagesIncluded,
              role_b_inclusion_consent_asserted: input.roleBConsentAsserted,
              role_b_consent_required: input.roleBMessagesIncluded,
              role_b_participant_id: input.roleBParticipantId ?? null,
              role_b_user_id: input.roleBUserId ?? null,
            },
            layer_summary: {
              role_a_messages: input.roleAMessageCount,
              role_b_messages: input.roleBMessageCount,
              information_gaps: input.informationGaps,
              transform_confidence: input.transformConfidence,
            },
          },
        },
      );
    } catch (error) {
      logger.warn('Chat route safety assessment persistence failed', {
        roomId: input.roomId,
        route: input.route,
        outcome: input.outcome,
        caseId: input.caseId,
        linkId: input.linkId,
        judgmentId: input.judgmentId,
        error,
      });
    }
  }

  private async createSafetyNoticeBestEffort(input: {
    roomId: string;
    aiParticipantId?: string;
    noticeMessage?: string;
    detectedFlags: string[];
  }): Promise<void> {
    if (!input.aiParticipantId || !input.noticeMessage) return;
    try {
      const sharedChannel = await chatChannelService.getSharedChannel(input.roomId);
      await prisma.chatMessage.create({
        data: {
          room_id: input.roomId,
          channel_id: sharedChannel.id,
          sender_participant_id: input.aiParticipantId,
          message_type: 'safety_notice',
          visibility_scope: ChatVisibilityScope.all,
          ai_context_eligible: true,
          content: input.noticeMessage,
          safety_flag: true,
          safety_detail: input.detectedFlags.join('、'),
        },
      });
    } catch (error) {
      logger.warn('Chat safety notice persistence failed', {
        roomId: input.roomId,
        error,
      });
    }
  }

  private async claimFormalAnalysisProviderUseInTransaction(
    tx: Prisma.TransactionClient,
    roomId: string,
  ): Promise<void> {
    await chatFormalAnalysisClaimService.assertAllowedInTransaction(tx, roomId);
  }

  private async ensurePairingForRoom(
    room: AccessibleChatRoom,
    roleBUserId?: string | null,
    client?: Pick<Prisma.TransactionClient, 'pairing'>,
  ): Promise<string> {
    if (!room.owner_user_id) {
      if (!room.session_id) {
        throw Errors.SESSION_ID_REQUIRED('匿名聊天室缺少 session_id，無法轉梳理結果');
      }
      const existingTempPairing = await pairingService.getPairingBySessionId(room.session_id);
      const tempPairing = existingTempPairing
        || await pairingService.createTempPairing(room.session_id);
      return tempPairing.id;
    }

    if (!client) {
      throw Errors.INTERNAL_ERROR('正式 Chat 配對必須使用同一個 transaction client');
    }

    if (!roleBUserId) {
      const existingLiveOwnerPairing = await client.pairing.findFirst({
        where: buildActiveNormalPairingWhere(room.owner_user_id),
        orderBy: { created_at: 'desc' },
      });
      if (existingLiveOwnerPairing) return existingLiveOwnerPairing.id;

      const created = await client.pairing.create({
        data: {
          user1_id: room.owner_user_id,
          user2_id: null,
          invite_code: null,
          status: PairingStatus.pending,
          pairing_type: PairingType.normal,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          confirmed_at: null,
        },
      });
      return created.id;
    }

    const exactPairWhere: Prisma.PairingWhereInput = {
      pairing_type: PairingType.normal,
      OR: [
        { user1_id: room.owner_user_id, user2_id: roleBUserId },
        { user1_id: roleBUserId, user2_id: room.owner_user_id },
      ],
    };
    const exactLivePairing = await client.pairing.findFirst({
      where: {
        ...exactPairWhere,
        status: { in: [PairingStatus.pending, PairingStatus.active] },
      },
      orderBy: { created_at: 'desc' },
    });
    if (exactLivePairing) return exactLivePairing.id;

    const ownerLivePairing = await client.pairing.findFirst({
      where: buildActiveNormalPairingWhere(room.owner_user_id),
      orderBy: { created_at: 'desc' },
    });
    if (ownerLivePairing) {
      const isChatOwnerOnlyPending = ownerLivePairing.status === PairingStatus.pending
        && ownerLivePairing.invite_code === null
        && (
          (ownerLivePairing.user1_id === room.owner_user_id
            && ownerLivePairing.user2_id === null)
          || (ownerLivePairing.user2_id === room.owner_user_id
            && ownerLivePairing.user1_id === null)
        );
      if (!isChatOwnerOnlyPending) {
        throw Errors.ALREADY_PAIRED('發起方已有其他配對關係');
      }

      const upgraded = await client.pairing.update({
        where: { id: ownerLivePairing.id },
        data: {
          status: PairingStatus.active,
          ...(ownerLivePairing.user1_id === room.owner_user_id
            ? { user2_id: roleBUserId }
            : { user1_id: roleBUserId }),
          confirmed_at: new Date(),
          cancelled_at: null,
          expires_at: null,
        },
      });
      return upgraded.id;
    }

    const roleBLivePairing = await client.pairing.findFirst({
      where: buildActiveNormalPairingWhere(roleBUserId),
      orderBy: { created_at: 'desc' },
    });
    if (roleBLivePairing) {
      throw Errors.ALREADY_PAIRED('回應方已有其他配對關係');
    }

    const historicalPairing = await client.pairing.findFirst({
      where: {
        ...exactPairWhere,
        status: { notIn: [PairingStatus.pending, PairingStatus.active] },
      },
      orderBy: { created_at: 'desc' },
    });
    if (historicalPairing) {
      const reopened = await client.pairing.update({
        where: { id: historicalPairing.id },
        data: {
          status: PairingStatus.active,
          confirmed_at: new Date(),
          cancelled_at: null,
          expires_at: null,
        },
      });
      return reopened.id;
    }

    const created = await client.pairing.create({
      data: {
        user1_id: room.owner_user_id,
        user2_id: roleBUserId,
        invite_code: null,
        status: PairingStatus.active,
        pairing_type: PairingType.normal,
        expires_at: null,
        confirmed_at: new Date(),
      },
    });
    return created.id;
  }

  private async completePersistedJudgmentState(input: {
    roomId: string;
    linkId: string;
    judgmentId: string;
    analysisRequestId: string | null;
  }): Promise<void> {
    await prisma.$transaction(async tx => {
      await tx.chatRoom.update({
        where: { id: input.roomId },
        data: { status: ChatRoomStatus.judgment_completed },
      });
      await tx.chatToCaseLink.update({
        where: { id: input.linkId },
        data: { judgment_id: input.judgmentId },
      });
      if (input.analysisRequestId) {
        await chatAnalysisEvidenceService.markCompleted(input.analysisRequestId, tx);
      }
    });
  }

  private async finalizeJudgment(input: {
    roomId: string;
    caseId: string;
    linkId: string;
    evidence: SubmittedAnalysisEvidenceBundle | null;
    actor: ChatActorContext;
    locale?: BackendLocale;
  }): Promise<string> {
    const judgment = await judgmentService.generateJudgment(input.caseId, {
      userId: input.actor.userId,
      sessionId: input.actor.sessionId,
      locale: input.locale,
      ...(input.evidence
        ? { expectedChatAnalysisRequestId: input.evidence.requestId }
        : {}),
    });
    const judgmentId = (judgment as { id?: string }).id;
    if (!judgmentId) {
      throw Errors.INTERNAL_ERROR('Judgment 已生成但缺少識別碼');
    }

    const finalizationInput = {
      roomId: input.roomId,
      linkId: input.linkId,
      judgmentId,
      analysisRequestId: input.evidence?.requestId ?? null,
    };
    try {
      await this.completePersistedJudgmentState(finalizationInput);
    } catch (firstError) {
      logger.warn('Chat judgment persisted; retrying state finalization', {
        roomId: input.roomId,
        caseId: input.caseId,
        linkId: input.linkId,
        judgmentId,
        error: firstError,
      });
      try {
        await this.completePersistedJudgmentState(finalizationInput);
      } catch (retryError) {
        throw new PersistedJudgmentFinalizationError(judgmentId, retryError);
      }
    }
    return judgmentId;
  }

  private async markJudgmentFailed(
    roomId: string,
    options: { onlyIfRequested?: boolean } = {},
  ): Promise<void> {
    try {
      if (options.onlyIfRequested) {
        await prisma.chatRoom.updateMany({
          where: { id: roomId, status: ChatRoomStatus.judgment_requested },
          data: { status: ChatRoomStatus.judgment_failed },
        });
        return;
      }
      await prisma.chatRoom.update({
        where: { id: roomId },
        data: { status: ChatRoomStatus.judgment_failed },
      });
    } catch {
      // Preserve the original failure; a later status/recovery request remains possible.
    }
  }

  private async retryExistingJudgment(input: {
    room: AccessibleChatRoom;
    link: RecentChatToCaseLink;
    actor: ChatActorContext;
    options?: RequestChatJudgmentOptions;
  }): Promise<RequestChatJudgmentResult> {
    const { room, link, actor, options } = input;
    let evidence: SubmittedAnalysisEvidenceBundle | null;
    try {
      evidence = await prisma.$transaction(async tx => {
        await this.claimFormalAnalysisProviderUseInTransaction(tx, room.id);
        const claimed = await chatAnalysisEvidenceService.claimCaseGenerationInTransaction(
          tx,
          {
            roomId: room.id,
            conversionSnapshot: link.conversion_snapshot,
            hasDefendantMaterial: conversionSnapshotIncludesRoleB(link.conversion_snapshot),
            expectedRequestId: options?.analysisRequestId,
          },
          actor,
        );
        const transition = await tx.chatRoom.updateMany({
          where: {
            id: room.id,
            status: {
              in: [ChatRoomStatus.judgment_failed, ChatRoomStatus.judgment_requested],
            },
          },
          data: { status: ChatRoomStatus.judgment_requested },
        });
        if (transition.count === 0) {
          throw Errors.CONFLICT('聊天室狀態已變更，請重試');
        }
        return claimed;
      }, { isolationLevel: 'ReadCommitted' });
    } catch (error) {
      await this.markJudgmentFailed(room.id, { onlyIfRequested: true });
      throw error;
    }

    try {
      const judgmentId = await this.finalizeJudgment({
        roomId: room.id,
        caseId: link.case_id,
        linkId: link.id,
        evidence,
        actor,
        locale: options?.locale,
      });
      return {
        roomId: room.id,
        caseId: link.case_id,
        judgmentId,
        linkId: link.id,
        status: ChatRoomStatus.judgment_completed,
      };
    } catch (error) {
      logger.warn('Chat judgment retry failed', {
        roomId: room.id,
        retryCaseId: link.case_id,
        retryLinkId: link.id,
        error,
      });
      if (!(error instanceof PersistedJudgmentFinalizationError)) {
        await this.markJudgmentFailed(room.id);
      }
      throw error;
    }
  }

  async requestJudgment(
    roomId: string,
    actor: ChatActorContext,
    options?: RequestChatJudgmentOptions,
  ): Promise<RequestChatJudgmentResult> {
    const resolvedActor = await chatActorAccessService.ensureActor(actor);
    const preCheckRoom = await chatActorAccessService.getAccessibleRoom(roomId, resolvedActor);
    const preCheckParticipant = chatActorAccessService.getCurrentParticipant(
      preCheckRoom,
      resolvedActor,
    );
    if (
      !preCheckParticipant
      || (preCheckParticipant.role_in_room !== 'roleA'
        && preCheckParticipant.role_in_room !== 'roleB')
    ) {
      throw Errors.FORBIDDEN('只有聊天室成員可發起梳理結果');
    }
    if (preCheckParticipant.role_in_room !== 'roleA') {
      throw Errors.FORBIDDEN('目前版本需由 A 方確認後發起梳理結果');
    }

    await chatSafetyRouterService.assertFormalAnalysisAllowed(roomId);

    const inFlight = this.inFlightByRoom.get(roomId);
    if (inFlight) {
      logger.info('Chat judgment in-flight dedupe hit', { roomId });
      return inFlight;
    }

    const task = lockService.withLock(
      `chat:judgment:${roomId}`,
      () => this.executeLocked(
        roomId,
        resolvedActor,
        preCheckRoom,
        preCheckParticipant,
        options,
      ),
      LOCK_TTL.JUDGMENT_GENERATION,
    );
    this.inFlightByRoom.set(roomId, task);
    try {
      return await task;
    } finally {
      if (this.inFlightByRoom.get(roomId) === task) {
        this.inFlightByRoom.delete(roomId);
      }
    }
  }

  private async executeLocked(
    roomId: string,
    resolvedActor: ChatActorContext,
    preCheckRoom: AccessibleChatRoom,
    preCheckParticipant: ChatParticipant,
    options?: RequestChatJudgmentOptions,
  ): Promise<RequestChatJudgmentResult> {
    logger.info('Chat judgment requested', {
      roomId,
      actorUserId: resolvedActor.userId ?? null,
      actorSessionId: resolvedActor.sessionId ?? null,
    });
    const lockedRoomState = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { status: true, history_visibility_mode: true },
    });
    if (!lockedRoomState) throw Errors.NOT_FOUND('聊天室不存在');
    const room: AccessibleChatRoom = {
      ...preCheckRoom,
      status: lockedRoomState.status,
      history_visibility_mode: lockedRoomState.history_visibility_mode,
    };

    const participant = await prisma.chatParticipant.findUnique({
      where: { id: preCheckParticipant.id },
    });
    if (!participant || !participant.is_active) {
      throw Errors.FORBIDDEN('只有聊天室成員可發起梳理結果');
    }
    if (participant.room_id && participant.room_id !== room.id) {
      throw Errors.FORBIDDEN('只有聊天室成員可發起梳理結果');
    }
    if (participant.role_in_room !== 'roleA') {
      throw Errors.FORBIDDEN('目前版本需由 A 方確認後發起梳理結果');
    }

    const participants = await prisma.chatParticipant.findMany({
      where: { room_id: room.id, is_active: true },
    });
    if (participants.length === 0) {
      throw Errors.FORBIDDEN('只有聊天室成員可發起梳理結果');
    }
    if (room.status === ChatRoomStatus.archived) {
      throw Errors.CASE_NOT_EDITABLE('封存聊天室不可再次發起梳理結果');
    }

    const recentLink = await prisma.chatToCaseLink.findFirst({
      where: { room_id: room.id },
      orderBy: { created_at: 'desc' },
      include: {
        judgment: { select: { id: true } },
        case: {
          select: {
            id: true,
            status: true,
            judgment: { select: { id: true } },
          },
        },
      },
    });
    const currentRoleB = room.participants.find(candidate => (
      candidate.role_in_room === 'roleB' && candidate.is_active
    ));
    const hasNewUserMessagesSinceLink = recentLink
      ? (await prisma.chatMessage.count({
          where: {
            AND: [
              buildSharedContextMessageWhere({
                roomId: room.id,
                historyVisibilityMode: room.history_visibility_mode,
                roleBJoinedAt: currentRoleB?.joined_at,
              }),
              {
                message_type: 'user_text',
                created_at: { gt: recentLink.created_at },
              },
            ],
          },
        })) > 0
      : false;

    const persistedJudgmentId = recentLink?.case?.judgment?.id;
    if (recentLink && persistedJudgmentId) {
      await this.completePersistedJudgmentState({
        roomId: room.id,
        linkId: recentLink.id,
        judgmentId: persistedJudgmentId,
        analysisRequestId: conversionSnapshotAnalysisRequestId(
          recentLink.conversion_snapshot,
        ),
      });
      room.status = ChatRoomStatus.judgment_completed;
      if (!hasNewUserMessagesSinceLink) {
        logger.info('Chat judgment recovered from persisted case judgment', {
          roomId: room.id,
          caseId: recentLink.case_id,
          linkId: recentLink.id,
          judgmentId: persistedJudgmentId,
        });
        return {
          roomId: room.id,
          caseId: recentLink.case_id,
          judgmentId: persistedJudgmentId,
          linkId: recentLink.id,
          status: ChatRoomStatus.judgment_completed,
        };
      }
    }

    if (
      recentLink
      && room.status === ChatRoomStatus.judgment_completed
      && !hasNewUserMessagesSinceLink
    ) {
      const ageMs = Date.now() - new Date(recentLink.created_at).getTime();
      logger.info('Chat judgment idempotent hit', {
        roomId: room.id,
        caseId: recentLink.case_id,
        linkId: recentLink.id,
        ageMs,
        hasNewUserMessagesSinceLink,
        withinWindow: ageMs <= 2 * 60 * 1000,
      });
      return {
        roomId: room.id,
        caseId: recentLink.case_id,
        judgmentId: recentLink.judgment?.id,
        linkId: recentLink.id,
        status: ChatRoomStatus.judgment_completed,
      };
    }

    if (options?.analysisRequestId && options.includedMessageIds?.length) {
      throw Errors.VALIDATION_ERROR(
        'analysis_request_id 與 included_message_ids 不可同時提交',
      );
    }
    if (
      recentLink
      && (room.status === ChatRoomStatus.judgment_failed
        || room.status === ChatRoomStatus.judgment_requested)
      && !recentLink.judgment
      && recentLink.case
      && !hasNewUserMessagesSinceLink
      && new Set<CaseStatus>([
        CaseStatus.submitted,
        CaseStatus.in_progress,
        CaseStatus.judgment_failed,
      ]).has(recentLink.case.status)
    ) {
      return this.retryExistingJudgment({ room, link: recentLink, actor: resolvedActor, options });
    }

    return this.createNewJudgment({
      room,
      participant,
      participants,
      actor: resolvedActor,
      options,
    });
  }

  private async createNewJudgment(input: {
    room: AccessibleChatRoom;
    participant: ChatParticipant;
    participants: ChatParticipant[];
    actor: ChatActorContext;
    options?: RequestChatJudgmentOptions;
  }): Promise<RequestChatJudgmentResult> {
    const { room, participants, actor, options } = input;
    const preflightRoleAParticipants = participants.filter(
      candidate => candidate.role_in_room === 'roleA',
    );
    const preflightRoleBParticipants = participants.filter(
      candidate => candidate.role_in_room === 'roleB',
    );
    const preflightAiParticipants = participants.filter(
      candidate => candidate.role_in_room === 'aiMediator',
    );
    if (
      preflightRoleAParticipants.length !== 1
      || preflightRoleBParticipants.length > 1
      || preflightAiParticipants.length > 1
    ) {
      throw Errors.CONFLICT('聊天室參與者狀態異常，請刷新後重試');
    }
    const preflightRoleAParticipant = preflightRoleAParticipants[0];
    const preflightRoleBParticipant = preflightRoleBParticipants[0];
    if (!preflightRoleAParticipant) {
      throw Errors.CASE_NOT_READY('缺少發起方資訊，無法轉梳理結果');
    }

    // Anonymous quick rooms still have participant-scoped durable Safety, but
    // their session/pairing aggregate is not yet transactionally coupled.
    // Preserve that existing lifecycle here; user-owned Chat pairings are
    // created only inside the formal preparation transaction below.
    const quickPairingId = room.owner_user_id
      ? null
      : await this.ensurePairingForRoom(room, preflightRoleBParticipant?.user_id ?? null);
    const title = buildChatToCaseTitle(options?.locale, new Date());
    let caseId = '';
    let linkId = '';
    let analysisEvidence: SubmittedAnalysisEvidenceBundle | null = null;
    const blockedSafetyHolder: { current: BlockedSafetyContext | null } = { current: null };

    try {
      const prepare = () => prisma.$transaction(async tx => {
        await this.claimFormalAnalysisProviderUseInTransaction(tx, room.id);
        const lockedRoom = await chatActorAccessService.getAccessibleRoom(
          room.id,
          actor,
          tx,
        );
        const lockedParticipant = chatActorAccessService.getCurrentParticipant(
          lockedRoom,
          actor,
        );
        if (!lockedParticipant || lockedParticipant.role_in_room !== 'roleA') {
          throw Errors.FORBIDDEN('目前版本需由 A 方確認後發起梳理結果');
        }
        const lockedParticipants = lockedRoom.participants.filter(
          candidate => candidate.is_active && candidate.left_at === null,
        );
        const roleAParticipants = lockedParticipants.filter(
          candidate => candidate.role_in_room === 'roleA',
        );
        const roleBParticipants = lockedParticipants.filter(
          candidate => candidate.role_in_room === 'roleB',
        );
        const aiParticipants = lockedParticipants.filter(
          candidate => candidate.role_in_room === 'aiMediator',
        );
        if (
          roleAParticipants.length !== 1
          || roleBParticipants.length > 1
          || aiParticipants.length > 1
        ) {
          throw Errors.CONFLICT('聊天室參與者狀態異常，請刷新後重試');
        }
        const roleAParticipant = roleAParticipants[0];
        const roleBParticipant = roleBParticipants[0];
        const aiParticipant = aiParticipants[0];
        if (!roleAParticipant) {
          throw Errors.CASE_NOT_READY('缺少發起方資訊，無法轉梳理結果');
        }

        const claimedEvidence = options?.analysisRequestId
          ? await chatAnalysisEvidenceService.claimSubmittedForProcessingInTransaction(
              tx,
              room.id,
              options.analysisRequestId,
              actor,
            )
          : null;
        const visibilityFilteredWhere: Prisma.ChatMessageWhereInput = {
          ...buildSharedContextMessageWhere({
            roomId: lockedRoom.id,
            historyVisibilityMode: lockedRoom.history_visibility_mode,
            roleBJoinedAt: roleBParticipant?.joined_at,
          }),
          message_type: 'user_text',
        };
        let userMessages = await tx.chatMessage.findMany({
          where: visibilityFilteredWhere,
          orderBy: { created_at: 'asc' },
          include: { sender_participant: true },
        });
        const selectedMessageIds = claimedEvidence
          ? claimedEvidence.messages.map(message => message.id)
          : options?.includedMessageIds;
        if (selectedMessageIds && selectedMessageIds.length > 0) {
          const allowedIds = new Set(userMessages.map(message => message.id));
          if (selectedMessageIds.some(id => !allowedIds.has(id))) {
            throw Errors.NOT_FOUND('部分訊息不存在或不可納入梳理結果');
          }
          userMessages = userMessages.filter(message => selectedMessageIds.includes(message.id));
          if (userMessages.length === 0) {
            throw Errors.CASE_NOT_READY('需至少 1 則訊息納入梳理結果');
          }
        }

        const roleAMessages = userMessages
          .filter(message => message.sender_participant.role_in_room === 'roleA')
          .map(message => message.content)
          .concat(
            claimedEvidence?.capsules
              .filter(capsule => capsule.ownerRole === 'roleA')
              .map(capsule => `[已批准分享內容] ${capsule.summary}`) ?? [],
          );
        const roleBMessages = userMessages
          .filter(message => message.sender_participant.role_in_room === 'roleB')
          .map(message => message.content)
          .concat(
            claimedEvidence?.capsules
              .filter(capsule => capsule.ownerRole === 'roleB')
              .map(capsule => `[已批准分享內容] ${capsule.summary}`) ?? [],
          );
        const includesRoleBMessages = roleBMessages.length > 0;
        const roleBConsentAsserted = Boolean(
          includesRoleBMessages
          && claimedEvidence
          && roleBParticipant
          && claimedEvidence.requiredParticipantIds.includes(roleBParticipant.id)
        );
        const firstMessage = userMessages[0];
        const lastMessage = userMessages[userMessages.length - 1];
        if (roleAMessages.length === 0) {
          throw Errors.CASE_NOT_READY('A 方訊息不足，無法轉梳理結果');
        }
        if (includesRoleBMessages && !roleBConsentAsserted) {
          throw Errors.CASE_NOT_READY(
            '納入 B 方內容前，需要 B 本人批准同一份 exact selection',
            { reason_code: 'CHAT_ANALYSIS_APPROVAL_REQUIRED' },
          );
        }

        const plaintiffStatement = buildChatJudgmentStatement(roleAMessages, 30);
        const defendantStatement = roleBMessages.length > 0
          ? buildChatJudgmentStatement(roleBMessages, 10)
          : null;
        const layerAnalysis = analyzeMessageLayers(roleAMessages, roleBMessages);
        const preRouteDecision = safetyRoutingService.decideRoute({
          plaintiffStatement,
          defendantStatement: defendantStatement ?? '',
        });
        const requestPolicy = getChatJudgmentRequestPolicy(
          preRouteDecision.route,
          preRouteDecision.reasons,
          options?.locale,
        );
        const safetyNoticeMessage = requestPolicy.noticeMessage;
        if (!requestPolicy.canRequestChatJudgment) {
          blockedSafetyHolder.current = {
            aiParticipantId: aiParticipant?.id,
            assessment: {
              roomId: lockedRoom.id,
              route: preRouteDecision.route,
              reasons: requestPolicy.reasons,
              detectedFlags: preRouteDecision.detectedFlags,
              assessedByUserId: actor.userId ?? null,
              outcome: 'blocked',
              caseId: null,
              linkId: null,
              judgmentId: null,
              firstMessageId: firstMessage?.id ?? null,
              lastMessageId: lastMessage?.id ?? null,
              totalUserMessages: userMessages.length,
              roleAMessageCount: roleAMessages.length,
              roleBMessageCount: roleBMessages.length,
              roleBMessagesIncluded: includesRoleBMessages,
              roleBConsentAsserted,
              roleBParticipantId: roleBParticipant?.id ?? null,
              roleBUserId: roleBParticipant?.user_id ?? null,
              informationGaps: layerAnalysis.informationGaps,
              transformConfidence: layerAnalysis.confidence,
            },
            noticeMessage: requestPolicy.shouldCreateSafetyNotice
              ? safetyNoticeMessage ?? undefined
              : undefined,
            detectedFlags: preRouteDecision.detectedFlags,
          };
          throw Errors.CASE_NOT_READY(
            requestPolicy.rejectionMessage
              ?? '目前安全路由不允許由聊天室直接轉梳理結果',
          );
        }

        let pairingId = quickPairingId;
        if (!pairingId) {
          try {
            pairingId = await this.ensurePairingForRoom(
              lockedRoom,
              roleBParticipant?.user_id ?? null,
              tx,
            );
          } catch (error) {
            const known = error as Prisma.PrismaClientKnownRequestError | undefined;
            if (known?.code === 'P2002') {
              throw new PairingUniqueRaceError(error);
            }
            throw error;
          }
        }

        const transition = await tx.chatRoom.updateMany({
          where: {
            id: lockedRoom.id,
            status: {
              in: [
                ChatRoomStatus.solo_active,
                ChatRoomStatus.invite_pending,
                ChatRoomStatus.group_active,
                ChatRoomStatus.judgment_failed,
                ChatRoomStatus.judgment_completed,
              ],
            },
          },
          data: { status: ChatRoomStatus.judgment_requested },
        });
        if (transition.count === 0) {
          throw Errors.CONFLICT('聊天室狀態已變更，請重試');
        }

        const mode = lockedRoom.owner_user_id ? CaseMode.collaborative : CaseMode.quick;
        const caseRecord = await tx.case.create({
          data: {
            pairing_id: pairingId,
            title,
            type: DEFAULT_CHAT_CASE_TYPE,
            plaintiff_id: roleAParticipant.user_id ?? null,
            defendant_id: roleBParticipant?.user_id ?? null,
            plaintiff_statement: plaintiffStatement,
            defendant_statement: defendantStatement,
            status: CaseStatus.submitted,
            mode,
            session_id: mode === CaseMode.quick ? lockedRoom.session_id : null,
            ...buildCaseSourceTracking('chat_to_case'),
            submitted_at: new Date(),
          },
        });
        const link = await tx.chatToCaseLink.create({
          data: {
            room_id: lockedRoom.id,
            case_id: caseRecord.id,
            triggered_by_participant_id: lockedParticipant.id,
            conversion_snapshot: {
              source_message_range: {
                first_message_id: firstMessage?.id ?? null,
                first_message_at: firstMessage?.created_at?.toISOString?.() ?? null,
                last_message_id: lastMessage?.id ?? null,
                last_message_at: lastMessage?.created_at?.toISOString?.() ?? null,
                total_user_messages: userMessages.length,
              },
              roleA_messages: roleAMessages.length,
              roleB_messages: roleBMessages.length,
              participant_consent: {
                role_b_messages_included: includesRoleBMessages,
                role_b_inclusion_consent_asserted: roleBConsentAsserted,
                role_b_consent_required: includesRoleBMessages,
                role_b_participant_id: roleBParticipant?.id ?? null,
                role_b_user_id: roleBParticipant?.user_id ?? null,
              },
              analysis_request: claimedEvidence
                ? {
                    id: claimedEvidence.requestId,
                    selection_hash: claimedEvidence.selectionHash,
                    policy_version: claimedEvidence.policyVersion,
                    approval_ids: claimedEvidence.approvalIds,
                    capsule_ids: claimedEvidence.capsules.map(capsule => capsule.id),
                    capsule_content_hashes: claimedEvidence.capsules.map(
                      capsule => capsule.contentHash,
                    ),
                  }
                : null,
              room_status: lockedRoom.status,
              visibility_mode: lockedRoom.history_visibility_mode,
              pre_route: preRouteDecision.route,
              pre_route_reasons: preRouteDecision.reasons,
              pre_route_flags: preRouteDecision.detectedFlags,
              safety_gate: {
                can_request_chat_judgment: requestPolicy.canRequestChatJudgment,
                should_create_safety_notice: requestPolicy.shouldCreateSafetyNotice,
                reasons: requestPolicy.reasons,
              },
              emotion_highlights: layerAnalysis.emotionHighlights,
              fact_highlights: layerAnalysis.factHighlights,
              interaction_hints: layerAnalysis.interactionHints,
              information_gaps: layerAnalysis.informationGaps,
              transform_confidence: layerAnalysis.confidence,
              layer_usability: layerAnalysis.layerUsability,
              gap_details: layerAnalysis.gapDetails,
              signal_stats: layerAnalysis.signalStats,
              included_message_ids: userMessages.map(message => message.id),
              excluded_policy: {
                filtered_visibility: true,
                filtered_before_join:
                  Boolean(roleBParticipant?.joined_at)
                  && (lockedRoom.history_visibility_mode
                    === ChatHistoryVisibilityMode.share_from_join_time
                    || lockedRoom.history_visibility_mode
                      === ChatHistoryVisibilityMode.share_summary_only),
              },
              conversion_version: 'v2-layered-2026-02',
              generated_at: new Date().toISOString(),
            },
          },
        });

        return {
          analysisEvidence: claimedEvidence,
          caseRecord,
          link,
          userMessages,
          roleAMessages,
          roleBMessages,
          includesRoleBMessages,
          roleBConsentAsserted,
          firstMessage,
          lastMessage,
          layerAnalysis,
          preRouteDecision,
          requestPolicy,
          plaintiffStatement,
          defendantStatement,
          safetyNoticeMessage,
          roleBParticipant,
          aiParticipant,
        };
      }, { isolationLevel: 'ReadCommitted' });

      let prepared: Awaited<ReturnType<typeof prepare>>;
      try {
        prepared = await prepare();
      } catch (error) {
        if (!(error instanceof PairingUniqueRaceError)) throw error;
        try {
          prepared = await prepare();
        } catch (retryError) {
          if (retryError instanceof PairingUniqueRaceError) {
            throw Errors.CONFLICT('配對狀態已變更，請重試共同梳理');
          }
          throw retryError;
        }
      }

      analysisEvidence = prepared.analysisEvidence;
      caseId = prepared.caseRecord.id;
      linkId = prepared.link.id;
      if (prepared.requestPolicy.shouldCreateSafetyNotice) {
        await this.createSafetyNoticeBestEffort({
          roomId: room.id,
          aiParticipantId: prepared.aiParticipant?.id,
          noticeMessage: prepared.safetyNoticeMessage ?? undefined,
          detectedFlags: prepared.preRouteDecision.detectedFlags,
        });
      }

      // Evidence consumption and Case/Link creation have committed before the
      // first approved byte reaches external AI. Type enrichment is non-authoritative.
      try {
        const detectedCaseType = await aiService.detectCaseType(
          prepared.plaintiffStatement,
          prepared.defendantStatement ?? '',
        );
        if (detectedCaseType !== DEFAULT_CHAT_CASE_TYPE) {
          await prisma.case.update({
            where: { id: caseId },
            data: { type: detectedCaseType },
          });
        }
      } catch (error) {
        logger.warn('Chat judgment case type detect/update failed, keeping default', {
          roomId: room.id,
          caseId,
          error,
        });
      }

      const judgmentId = await this.finalizeJudgment({
        roomId: room.id,
        caseId,
        linkId,
        evidence: analysisEvidence,
        actor,
        locale: options?.locale,
      });
      chatMetricsService.recordJudgmentSuccess().catch(() => undefined);

      await this.recordRouteSafetyAssessmentBestEffort({
        roomId: room.id,
        route: prepared.preRouteDecision.route,
        reasons: prepared.requestPolicy.reasons,
        detectedFlags: prepared.preRouteDecision.detectedFlags,
        assessedByUserId: actor.userId ?? null,
        outcome: 'judgment_completed',
        caseId,
        linkId,
        judgmentId: judgmentId ?? null,
        firstMessageId: prepared.firstMessage?.id ?? null,
        lastMessageId: prepared.lastMessage?.id ?? null,
        totalUserMessages: prepared.userMessages.length,
        roleAMessageCount: prepared.roleAMessages.length,
        roleBMessageCount: prepared.roleBMessages.length,
        roleBMessagesIncluded: prepared.includesRoleBMessages,
        roleBConsentAsserted: prepared.roleBConsentAsserted,
        roleBParticipantId: prepared.roleBParticipant?.id ?? null,
        roleBUserId: prepared.roleBParticipant?.user_id ?? null,
        informationGaps: prepared.layerAnalysis.informationGaps,
        transformConfidence: prepared.layerAnalysis.confidence,
      });
      return {
        roomId: room.id,
        caseId,
        judgmentId,
        linkId,
        status: ChatRoomStatus.judgment_completed,
      };
    } catch (error) {
      logger.warn('Chat judgment failed', { roomId: room.id, caseId, linkId, error });
      if (!caseId) {
        const blockedSafetyContext = blockedSafetyHolder.current;
        if (blockedSafetyContext) {
          await this.createSafetyNoticeBestEffort({
            roomId: room.id,
            aiParticipantId: blockedSafetyContext.aiParticipantId,
            noticeMessage: blockedSafetyContext.noticeMessage,
            detectedFlags: blockedSafetyContext.detectedFlags,
          });
          await this.recordRouteSafetyAssessmentBestEffort(
            blockedSafetyContext.assessment,
          );
        }
        throw error;
      }
      if (!(error instanceof PersistedJudgmentFinalizationError)) {
        await this.markJudgmentFailed(room.id);
        chatMetricsService.recordJudgmentFailed().catch(() => undefined);
      }
      throw error;
    }
  }
}

export const chatJudgmentOrchestrator = new ChatJudgmentOrchestrator();
