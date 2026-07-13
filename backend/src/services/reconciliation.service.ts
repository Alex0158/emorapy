import prisma from '../config/database';
import { Prisma } from '../types/prisma-client';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { randomUUID } from 'crypto';
import {
  aiService,
  type GenerateReconciliationPlanOptions,
  type ReconciliationPlan as AIReconciliationPlan,
  SAFETY_SIGNAL_REGEX,
  IPV_SIGNAL_REGEX,
  CRISIS_SIGNAL_REGEX,
} from './ai.service';
import { isReconciliationPlanContent, type ReconciliationPlanContent } from '../types/ai.types';
import { notificationService } from './notification.service';
import {
  buildRepairJourneyContext,
  buildRepairStepTitle,
  type RepairJourneyContext,
  type RepairJourneyViewerRole,
} from './repair-journey.service';
import {
  buildRepairAccessContext,
  getRepairEligibilityForCase,
  getRepairJourneyAccessPolicyForJudgment,
  type RepairJourneyAccessPolicy,
} from './repair-eligibility.service';
import {
  chatJointRepairClaimService,
  type ChatLinkedRepairCase,
} from './chat-joint-repair-claim.service';
import { CHAT_SAFETY_ROUTER_POLICY_VERSION } from './chat-safety-router.service';
import type { BackendLocale } from '../i18n';

export type ReconciliationIntent = 'repair' | 'cool_down' | 'graceful_exit' | 'safety_support';
export type PlanStylePreference = 'action' | 'conversation' | 'companionship' | 'distance';
export type PlanPacePreference = 'today' | 'this_week' | 'ease_in';
export type PlanPressurePreference = 'low' | 'medium' | 'high';
export type PlanRespondAction = 'viewed' | 'committed' | 'deferred' | 'declined' | 'paused';
export type RepairReplanMode = 'lower_pressure' | 'slower_pace' | 'solo_first';
export type RepairReplanReason = 'needs_help' | 'farther' | 'high_stress' | 'manual';

type CommitmentStatusValue = 'not_viewed' | 'viewed' | 'deferred' | 'committed' | 'declined' | 'paused';
type RepairTrackStatusValue =
  | 'draft'
  | 'partner_invited'
  | 'solo_active'
  | 'co_active'
  | 'replanning'
  | 'paused'
  | 'completed'
  | 'closed';

const REPAIR_CASE_INCLUDE = {
  chat_to_case_links: { select: { id: true, room_id: true }, take: 1 },
} as const;

function sanitizePlanStrings<T>(obj: T): T {
  if (typeof obj === 'string') {
    return obj
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .slice(0, 10000) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizePlanStrings) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = sanitizePlanStrings(v);
    }
    return result as T;
  }
  return obj;
}

function parseStoredPlanContent(raw: string): ReconciliationPlanContent {
  const parsed = JSON.parse(raw) as unknown;
  if (!isReconciliationPlanContent(parsed)) {
    throw Errors.VALIDATION_ERROR('無效的和好方案格式');
  }
  return parsed;
}

function buildPreferenceSummary(preferences?: PlanPreferences): string | undefined {
  if (!preferences) return undefined;
  const lines: string[] = [];
  if (preferences.pressure_level) {
    lines.push(`壓力承受度：${preferences.pressure_level}`);
  }
  if (preferences.pace) {
    lines.push(`希望節奏：${preferences.pace}`);
  }
  if (preferences.style && preferences.style.length > 0) {
    lines.push(`偏好方式：${preferences.style.join('、')}`);
  }
  if (typeof preferences.invite_partner === 'boolean') {
    lines.push(`是否接受邀請對方加入：${preferences.invite_partner ? '是' : '暫時不要'}`);
  }
  if (preferences.types && preferences.types.length > 0) {
    lines.push(`偏好方案類型：${preferences.types.join('、')}`);
  }
  if (preferences.difficulty) {
    lines.push(`偏好難度：${preferences.difficulty}`);
  }
  return lines.length > 0 ? lines.join('\n') : undefined;
}

function scorePlanForPreferences(
  plan: ReconciliationPlanContent & {
    plan_type: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
    difficulty_level?: 'easy' | 'medium' | 'hard';
    estimated_duration?: number;
  },
  preferences?: PlanPreferences,
): number {
  if (!preferences) return 0;
  let score = 0;
  if (preferences.difficulty && preferences.difficulty === plan.difficulty_level) {
    score += 3;
  }
  if (preferences.types?.includes(plan.plan_type)) {
    score += 3;
  }
  if (preferences.duration && plan.estimated_duration) {
    const diff = Math.abs(preferences.duration - plan.estimated_duration);
    score += Math.max(0, 3 - diff);
  }
  if (preferences.pressure_level === 'low' && plan.emotion_cost <= 2) {
    score += 2;
  }
  if (preferences.pressure_level === 'high' && plan.emotion_cost >= 3) {
    score += 1;
  }
  if (preferences.pace === 'today' && (plan.estimated_duration ?? 7) <= 3) {
    score += 2;
  }
  if (preferences.pace === 'ease_in' && (plan.estimated_duration ?? 7) >= 7) {
    score += 1;
  }
  if (preferences.style?.includes('action') && (plan.plan_type === 'activity' || plan.plan_type === 'service')) {
    score += 2;
  }
  if (preferences.style?.includes('conversation') && plan.plan_type === 'communication') {
    score += 2;
  }
  if (preferences.style?.includes('companionship') && (plan.plan_type === 'activity' || plan.plan_type === 'intimacy')) {
    score += 1;
  }
  if (preferences.style?.includes('distance') && plan.plan_type === 'service') {
    score += 1;
  }
  return score;
}

export interface PlanPreferences {
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: number;
  types?: ('activity' | 'communication' | 'intimacy' | 'gift' | 'service')[];
  pressure_level?: PlanPressurePreference;
  pace?: PlanPacePreference;
  style?: PlanStylePreference[];
  invite_partner?: boolean;
}

export interface GeneratePlansInput {
  intent?: ReconciliationIntent;
  preferences?: PlanPreferences;
  force_regenerate?: boolean;
}

export interface ReconciliationAccessContext {
  judgment_route: RepairJourneyAccessPolicy['judgmentRoute'];
  default_intent: ReconciliationIntent;
  allowed_intents: ReconciliationIntent[];
  can_invite_partner: boolean;
  can_use_co_repair: boolean;
  force_solo_repair: boolean;
  relationship_scope: RepairJourneyAccessPolicy['relationshipScope'];
  reasons: string[];
}

function buildReconciliationAccessContext(
  repairJourneyAccess: RepairJourneyAccessPolicy,
): ReconciliationAccessContext {
  return {
    judgment_route: repairJourneyAccess.judgmentRoute,
    default_intent: repairJourneyAccess.defaultReconciliationIntent,
    allowed_intents: repairJourneyAccess.allowedReconciliationIntents,
    can_invite_partner: repairJourneyAccess.canInvitePartner,
    can_use_co_repair: repairJourneyAccess.canUseCoRepair,
    force_solo_repair: repairJourneyAccess.forceSoloRepair,
    relationship_scope: repairJourneyAccess.relationshipScope,
    reasons: repairJourneyAccess.reasons,
  };
}

interface JourneyEntry {
  status: RepairTrackStatusValue | 'none';
  track_id: string | null;
  active_plan_id: string | null;
  recommended_action:
    | 'generate_bundle'
    | 'commit_plan'
    | 'view_invitation_status'
    | 'resume_daily_step'
    | 'replan_track'
    | 'resume_track'
    | 'review_history';
  last_pulse: {
    closeness: string | null;
    stress: string | null;
    needs_help: boolean | null;
    needs_replan: boolean;
  } | null;
  has_superseded_versions: boolean;
  journey_context?: RepairJourneyContext;
}

interface VersionSummary {
  version_group_id: string | null;
  has_superseded_versions: boolean;
  superseded_versions_count: number;
}

type PlanRecordForHydration = Prisma.ReconciliationPlanGetPayload<{
  include: {
    judgment: {
      include: {
        case: {
          include: typeof REPAIR_CASE_INCLUDE;
        };
      };
    };
    repair_track: {
      include: {
        participant_states: true;
        step_progresses: true;
        checkins: {
          orderBy: { created_at: 'desc' };
          take: 3;
        };
      };
    };
  };
}>;

export class ReconciliationService {
  private getOtherParticipantId(
    caseRecord: { plaintiff_id: string | null; defendant_id: string | null },
    userId: string,
  ) {
    if (caseRecord.plaintiff_id === userId) return caseRecord.defendant_id;
    if (caseRecord.defendant_id === userId) return caseRecord.plaintiff_id;
    return null;
  }

  private getParticipantIds(caseRecord: { plaintiff_id: string | null; defendant_id: string | null }) {
    return [caseRecord.plaintiff_id, caseRecord.defendant_id].filter((id): id is string => !!id);
  }

  private getCurrentCommitmentStatus(
    states: Array<{ user_id: string; commitment_status: CommitmentStatusValue }>,
    userId: string,
  ): CommitmentStatusValue {
    return states.find((state) => state.user_id === userId)?.commitment_status || 'not_viewed';
  }

  private buildCommitmentSummary(
    plan: PlanRecordForHydration,
    userId: string,
  ) {
    const track = plan.repair_track;
    const caseRecord = plan.judgment.case;
    const partnerId = this.getOtherParticipantId(caseRecord, userId);
    const currentState = track?.participant_states.find((state) => state.user_id === userId);
    const partnerState = partnerId
      ? track?.participant_states.find((state) => state.user_id === partnerId)
      : undefined;
    const currentSelected = (caseRecord.plaintiff_id === userId && plan.user1_selected)
      || (caseRecord.defendant_id === userId && plan.user2_selected);
    const partnerSelected = (partnerId === caseRecord.plaintiff_id && plan.user1_selected)
      || (partnerId === caseRecord.defendant_id && plan.user2_selected);
    const currentCommitment = currentState?.commitment_status || (currentSelected ? 'committed' : 'not_viewed');
    const partnerCommitment = partnerState?.commitment_status || (partnerSelected ? 'committed' : 'not_viewed');

    return {
      track_id: track?.id ?? null,
      track_status: track?.status ?? 'draft',
      recommended_mode: track?.recommended_mode ?? ((currentCommitment === 'committed' && partnerCommitment === 'committed') ? 'co' : 'solo'),
      invited_partner_at: track?.partner_invited_at ?? null,
      is_dual_committed: currentCommitment === 'committed' && partnerCommitment === 'committed',
      current_user: {
        user_id: userId,
        commitment_status: currentCommitment,
        viewed_at: currentState?.viewed_at ?? null,
        committed_at: currentState?.committed_at ?? null,
        responded_at: currentState?.responded_at ?? null,
        deferred_until: currentState?.deferred_until ?? null,
        response_reason: currentState?.response_reason ?? null,
      },
      partner: partnerId ? {
        user_id: partnerId,
        commitment_status: partnerCommitment,
        viewed_at: partnerState?.viewed_at ?? null,
        committed_at: partnerState?.committed_at ?? null,
        responded_at: partnerState?.responded_at ?? null,
        deferred_until: partnerState?.deferred_until ?? null,
        response_reason: partnerState?.response_reason ?? null,
      } : null,
    };
  }

  private hydratePlan(
    plan: PlanRecordForHydration,
    userId: string,
    options?: { recommendedPlanId?: string },
  ) {
    const content = parseStoredPlanContent(plan.plan_content);
    return {
      ...plan,
      content,
      fit_reason: content.fit_reason,
      first_step: content.first_step,
      fallback_step: content.fallback_step,
      pause_rule: content.pause_rule,
      do_not_use_when: content.do_not_use_when,
      risk_note: content.risk_note ?? null,
      commitment: this.buildCommitmentSummary(plan, userId),
      is_recommended: options?.recommendedPlanId === plan.id,
    };
  }

  private getViewerRole(plan: PlanRecordForHydration, userId: string): RepairJourneyViewerRole {
    const track = plan.repair_track;
    const hasPartner = !!this.getOtherParticipantId(plan.judgment.case, userId);
    if (!hasPartner) return 'solo';
    if (!track) return 'initiator';
    const currentState = track.participant_states.find((state) => state.user_id === userId);
    const committedStates = track.participant_states.filter((state) => state.commitment_status === 'committed');
    if (currentState?.invited_at && !['committed', 'paused'].includes(currentState.commitment_status)) {
      return 'invitee';
    }
    if (committedStates.some((state) => state.user_id === userId)) {
      return 'initiator';
    }
    return 'initiator';
  }

  private async buildJourneyContext(
    plan: PlanRecordForHydration,
    userId: string,
    locale: BackendLocale = 'zh-TW',
  ) {
    const commitment = this.buildCommitmentSummary(plan, userId);
    const repairEligibility = getRepairEligibilityForCase(plan.judgment.case);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(plan.judgment, repairEligibility);
    const trackStatus = (plan.repair_track?.status as RepairTrackStatusValue | undefined) ?? 'draft';
    const effectiveTrackStatus = repairJourneyAccess.forceSoloRepair && trackStatus === 'co_active'
      ? 'solo_active'
      : trackStatus;
    return buildRepairJourneyContext({
      judgmentId: plan.judgment_id,
      planId: plan.id,
      viewerRole: this.getViewerRole(plan, userId),
      trackStatus: effectiveTrackStatus,
      currentCommitment: commitment.current_user.commitment_status as CommitmentStatusValue,
      partnerCommitment: (commitment.partner?.commitment_status as CommitmentStatusValue | undefined) ?? null,
      canInvite: repairJourneyAccess.canInvitePartner
        && !!this.getOtherParticipantId(plan.judgment.case, userId),
      hasPartner: !!commitment.partner,
      isDualCommitted: !repairJourneyAccess.forceSoloRepair && commitment.is_dual_committed,
      statusReason: plan.repair_track?.status_reason ?? null,
      recommendedMode: repairJourneyAccess.forceSoloRepair ? 'solo' : commitment.recommended_mode,
      repairAccess: buildRepairAccessContext(repairJourneyAccess),
      locale,
    });
  }

  private async buildPlanCtaState(
    plan: PlanRecordForHydration,
    userId: string,
    locale: BackendLocale = 'zh-TW',
  ) {
    const journeyContext = await this.buildJourneyContext(plan, userId, locale);
    if (journeyContext.secondary_cta) {
      return {
        primary_action: journeyContext.primary_cta.action,
        secondary_action: journeyContext.secondary_cta.action,
      };
    }
    return {
      primary_action: journeyContext.primary_cta.action,
      secondary_action: null,
    };
  }

  private buildTrackHistorySummary(
    plan: PlanRecordForHydration,
    versionSummary?: VersionSummary,
  ) {
    return {
      current_track_id: plan.repair_track?.id ?? null,
      current_version_group_id: plan.version_group_id ?? versionSummary?.version_group_id ?? null,
      has_superseded_versions: versionSummary?.has_superseded_versions ?? false,
      superseded_versions_count: versionSummary?.superseded_versions_count ?? 0,
      current_plan_superseded_at: plan.superseded_at ?? null,
    };
  }

  private async createTrackEvent(
    repairTrackId: string,
    eventType: string,
    userId?: string | null,
    payload?: Prisma.InputJsonValue,
    db: Prisma.TransactionClient = prisma,
  ) {
    await db.repairTrackEvent.create({
      data: {
        repair_track_id: repairTrackId,
        user_id: userId ?? null,
        event_type: eventType,
        payload,
      },
    });
  }

  private async ensureRepairTrack(
    plan: PlanRecordForHydration,
    db: Prisma.TransactionClient = prisma,
  ) {
    if (plan.repair_track) {
      const current = await db.repairTrack.findUnique({
        where: { id: plan.repair_track.id },
        include: {
          participant_states: true,
          step_progresses: true,
          checkins: {
            orderBy: { created_at: 'desc' },
            take: 3,
          },
        },
      });
      if (!current) {
        throw Errors.NOT_FOUND('修復旅程不存在');
      }
      return current;
    }

    const participantIds = this.getParticipantIds(plan.judgment.case);
    return db.repairTrack.create({
      data: {
        plan_id: plan.id,
        intent: plan.intent,
        recommended_mode: 'solo',
        participant_states: {
          create: participantIds.map((participantId) => ({
            user_id: participantId,
            commitment_status: 'not_viewed',
          })),
        },
      },
      include: {
        participant_states: true,
        step_progresses: true,
        checkins: {
          orderBy: { created_at: 'desc' },
          take: 3,
        },
      },
    });
  }

  private getJourneyStatusPriority(status: string | null | undefined): number {
    switch (status) {
      case 'replanning':
        return 70;
      case 'paused':
        return 60;
      case 'co_active':
        return 50;
      case 'solo_active':
        return 45;
      case 'partner_invited':
        return 40;
      case 'draft':
        return 30;
      case 'completed':
        return 20;
      case 'closed':
        return 10;
      default:
        return 0;
    }
  }

  private async buildJourneyEntry(
    plans: PlanRecordForHydration[],
    userId: string,
    versionSummary?: VersionSummary,
    locale: BackendLocale = 'zh-TW',
  ): Promise<JourneyEntry> {
    if (plans.length === 0) {
      return {
        status: 'none',
        track_id: null,
        active_plan_id: null,
        recommended_action: 'generate_bundle',
        last_pulse: null,
        has_superseded_versions: versionSummary?.has_superseded_versions ?? false,
        journey_context: undefined,
      };
    }

    const sorted = [...plans].sort((a, b) => {
      const statusDelta = this.getJourneyStatusPriority(b.repair_track?.status) - this.getJourneyStatusPriority(a.repair_track?.status);
      if (statusDelta !== 0) return statusDelta;
      return b.created_at.getTime() - a.created_at.getTime();
    });
    const current = sorted[0];
    const track = current.repair_track;
    const status = (track?.status as RepairTrackStatusValue | undefined) ?? 'draft';

    let recommendedAction: JourneyEntry['recommended_action'] = 'commit_plan';
    if (status === 'partner_invited') {
      recommendedAction = 'view_invitation_status';
    } else if (status === 'solo_active' || status === 'co_active') {
      recommendedAction = 'resume_daily_step';
    } else if (status === 'replanning') {
      recommendedAction = 'replan_track';
    } else if (status === 'paused') {
      recommendedAction = 'resume_track';
    } else if (status === 'completed' || status === 'closed') {
      recommendedAction = 'review_history';
    }

    return {
      status,
      track_id: track?.id ?? null,
      active_plan_id: current.id,
      recommended_action: recommendedAction,
      last_pulse: track ? {
        closeness: track.last_closeness ?? null,
        stress: track.last_stress ?? null,
        needs_help: track.last_needs_help ?? null,
        needs_replan: track.needs_replan,
      } : null,
      has_superseded_versions: versionSummary?.has_superseded_versions ?? false,
      journey_context: await this.buildJourneyContext(current, userId, locale),
    };
  }

  private async syncTrackCommitment(
    trackId: string,
    invitedAt?: Date | null,
    forceSoloOverride = false,
    db: Prisma.TransactionClient = prisma,
  ) {
    const track = await db.repairTrack.findUnique({
      where: { id: trackId },
      include: { participant_states: true },
    });
    if (!track) {
      throw Errors.NOT_FOUND('修復旅程不存在');
    }

    const committedCount = track.participant_states.filter((state) => state.commitment_status === 'committed').length;
    const declinedCount = track.participant_states.filter((state) => state.commitment_status === 'declined').length;
    const deferredCount = track.participant_states.filter((state) => state.commitment_status === 'deferred').length;
    const pausedCount = track.participant_states.filter((state) => state.commitment_status === 'paused').length;
    const forceSoloRepair = forceSoloOverride || track.intent === 'safety_support';
    const nextRecommendedMode = forceSoloRepair ? 'solo' : committedCount >= 2 ? 'co' : 'solo';
    const shouldKeepRuntimeState = ['solo_active', 'co_active', 'paused', 'completed', 'closed', 'replanning'].includes(track.status);
    const keptRuntimeStatus = forceSoloRepair && track.status === 'co_active' ? 'solo_active' : track.status;
    const nextStatus: RepairTrackStatusValue = shouldKeepRuntimeState
      ? keptRuntimeStatus as RepairTrackStatusValue
      : forceSoloRepair
        ? 'draft'
        : committedCount >= 2
        ? 'draft'
        : invitedAt || track.partner_invited_at
          ? 'partner_invited'
          : 'draft';
    const statusReason = pausedCount > 0
      ? 'participant_paused'
      : declinedCount > 0
        ? 'partner_declined'
        : deferredCount > 0
          ? 'partner_deferred'
        : forceSoloRepair
          ? 'solo_policy'
          : committedCount >= 2
          ? 'dual_committed'
          : invitedAt || track.partner_invited_at
            ? 'partner_invited'
            : 'awaiting_commitment';

    return db.repairTrack.update({
      where: { id: track.id },
      data: {
        recommended_mode: nextRecommendedMode,
        status: nextStatus,
        status_reason: statusReason,
        partner_invited_at: invitedAt === undefined ? track.partner_invited_at : invitedAt,
      },
      include: {
        participant_states: true,
        step_progresses: true,
        checkins: {
          orderBy: { created_at: 'desc' },
          take: 3,
        },
      },
    });
  }

  private async loadPlanForAction(planId: string, userId: string) {
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: planId },
      include: {
        judgment: {
          include: {
            case: { include: REPAIR_CASE_INCLUDE },
          },
        },
        repair_track: {
          include: {
            participant_states: true,
            step_progresses: true,
            checkins: {
              orderBy: { created_at: 'desc' },
              take: 3,
            },
          },
        },
      },
    });

    if (!plan) {
      throw Errors.NOT_FOUND('和好方案不存在');
    }

    const caseRecord = plan.judgment.case;
    if (caseRecord.plaintiff_id !== userId && caseRecord.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限操作此方案');
    }

    return plan;
  }

  private assertPlanIntentAllowed(
    intent: string,
    repairJourneyAccess: RepairJourneyAccessPolicy,
  ) {
    if (!repairJourneyAccess.allowedReconciliationIntents.includes(intent as ReconciliationIntent)) {
      throw Errors.FORBIDDEN('目前安全狀態不允許使用此調整方案，請返回梳理結果選擇安全支持方向');
    }
  }

  private async claimChatJointRepairInTransaction(
    tx: Prisma.TransactionClient,
    caseRecord: ChatLinkedRepairCase,
  ): Promise<void> {
    await chatJointRepairClaimService.assertAllowed(tx, caseRecord);
  }

  private async observeChatJointRepairForNotificationInTransaction(
    tx: Prisma.TransactionClient,
    caseRecord: ChatLinkedRepairCase,
  ): Promise<boolean> {
    return chatJointRepairClaimService.observeAllowed(tx, caseRecord);
  }

  private async withChatJointRepairClaim<T>(
    caseRecord: ChatLinkedRepairCase,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async tx => {
      await this.claimChatJointRepairInTransaction(tx, caseRecord);
      return operation(tx);
    }, { isolationLevel: 'ReadCommitted' });
  }

  private async claimChatJointRepairProviderUse(
    caseRecord: ChatLinkedRepairCase,
    caseId: string,
  ): Promise<void> {
    const roomId = chatJointRepairClaimService.getRoomId(caseRecord);
    if (!roomId) return;

    await prisma.$transaction(async tx => {
      await chatJointRepairClaimService.assertAllowed(tx, caseRecord);
      await tx.contextUseAudit.create({
        data: {
          room_id: roomId,
          purpose: 'joint_repair',
          audience: 'room_participants',
          target_type: 'case',
          target_id: caseId,
          decision: 'allowed',
          reason_code: 'joint_repair_provider_claimed',
          source_refs: [],
          authorization_refs: [],
          content_hashes: [],
          policy_version: CHAT_SAFETY_ROUTER_POLICY_VERSION,
        },
      });
    }, { isolationLevel: 'ReadCommitted' });
  }

  private async getVersionSummary(
    judgmentId: string,
    intent: ReconciliationIntent,
    activePlans: Array<{ version_group_id?: string | null }>,
  ): Promise<VersionSummary> {
    const versionGroupId = activePlans.find((plan) => plan.version_group_id)?.version_group_id ?? null;
    const supersededVersionsCount = await prisma.reconciliationPlan.count({
      where: {
        judgment_id: judgmentId,
        intent,
        superseded_at: { not: null },
      },
    });

    return {
      version_group_id: versionGroupId,
      has_superseded_versions: supersededVersionsCount > 0,
      superseded_versions_count: supersededVersionsCount,
    };
  }

  private async buildPlansPayload(
    plans: PlanRecordForHydration[],
    userId: string,
    intent: ReconciliationIntent,
    repairAccess: ReconciliationAccessContext,
    preferences?: PlanPreferences,
    versionSummary?: VersionSummary,
    locale: BackendLocale = 'zh-TW',
  ) {
    const scoredPlans = plans.map((plan) => {
      const content = parseStoredPlanContent(plan.plan_content);
      return {
        plan,
        score: scorePlanForPreferences(content, preferences),
      };
    });
    scoredPlans.sort((a, b) => b.score - a.score || a.plan.time_cost - b.plan.time_cost || a.plan.created_at.getTime() - b.plan.created_at.getTime());
    const recommendedPlanId = scoredPlans[0]?.plan.id ?? null;

    return {
      plans: plans.map((plan) => this.hydratePlan(plan, userId, { recommendedPlanId: recommendedPlanId ?? undefined })),
      recommended_plan_id: recommendedPlanId,
      intent,
      repair_access: repairAccess,
      applied_preferences: preferences ?? null,
      journey_entry: await this.buildJourneyEntry(plans, userId, versionSummary, locale),
      version_summary: versionSummary ?? {
        version_group_id: null,
        has_superseded_versions: false,
        superseded_versions_count: 0,
      },
    };
  }

  /**
   * 生成和好方案
   */
  async generatePlans(
    judgmentId: string,
    input?: GeneratePlansInput,
    userId?: string,
    locale: BackendLocale = 'zh-TW',
  ) {
    const preferences = input?.preferences;
    const forceRegenerate = input?.force_regenerate ?? false;

    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: {
        case: {
          include: {
            pairing: {
              select: {
                user1_id: true,
                user2_id: true,
              },
            },
            chat_to_case_links: { select: { id: true, room_id: true }, take: 1 },
          },
        },
      },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('梳理結果不存在');
    }

    if (userId && judgment.case.plaintiff_id !== userId && judgment.case.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限生成和好方案');
    }

    const repairEligibility = getRepairEligibilityForCase(judgment.case);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(judgment, repairEligibility);
    if (!repairJourneyAccess.canEnterRepairJourney) {
      throw Errors.FORBIDDEN('此案件尚未綁定已登入當事人，不能生成修復旅程');
    }
    const intent = input?.intent ?? repairJourneyAccess.defaultReconciliationIntent;
    if (!repairJourneyAccess.allowedReconciliationIntents.includes(intent)) {
      throw Errors.VALIDATION_ERROR('此梳理結果路由不允許生成一般共同修復方案，請改用安全支持或低壓退出方向');
    }
    if (repairJourneyAccess.forceSoloRepair && preferences?.invite_partner) {
      throw Errors.VALIDATION_ERROR('此梳理結果路由只允許 solo 修復，不允許邀請伴侶加入修復旅程');
    }
    const requestsJointRepair = intent === 'repair' && preferences?.invite_partner === true;

    const existingPlans = await prisma.reconciliationPlan.findMany({
      where: { judgment_id: judgmentId, intent, superseded_at: null },
      include: {
        judgment: { include: { case: { include: REPAIR_CASE_INCLUDE } } },
        repair_track: {
          include: {
            participant_states: true,
            step_progresses: true,
            checkins: {
              orderBy: { created_at: 'desc' },
              take: 3,
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    if (!forceRegenerate && existingPlans.length > 0) {
      const versionSummary = await this.getVersionSummary(judgmentId, intent, existingPlans);
      return this.buildPlansPayload(
        existingPlans as PlanRecordForHydration[],
        userId || judgment.case.plaintiff_id || judgment.case.defendant_id || '',
        intent,
        buildReconciliationAccessContext(repairJourneyAccess),
        preferences,
        versionSummary,
        locale,
      );
    }

    let safetyContext: string | undefined;
    if (repairJourneyAccess.judgmentRoute === 'crisis_support') {
      safetyContext = '本案件已標記為危機支持路由。禁止共同修復、責任施壓與伴侶召回，請優先提供個人安全與危機支持方案。';
    } else if (repairJourneyAccess.judgmentRoute === 'safety_support') {
      safetyContext = '本案件已標記為安全支持路由。禁止共同修復、責任對稱化與伴侶召回，請優先提供個人安全規劃。';
    }
    if (repairJourneyAccess.forceSoloRepair) {
      const eligibilityContext = repairJourneyAccess.reasons.join('；');
      safetyContext = safetyContext
        ? `${safetyContext}\n${eligibilityContext}`
        : eligibilityContext;
    }
    if (judgment.judgment_content) {
      const content = judgment.judgment_content;
      const hasIPV = IPV_SIGNAL_REGEX.test(content);
      const hasCrisis = CRISIS_SIGNAL_REGEX.test(content);

      if (hasIPV && hasCrisis) {
        safetyContext = '本案件同時偵測到親密暴力信號和自傷/自殺風險信號。請先以安全與危機支持為主。';
      } else if (hasCrisis) {
        safetyContext = '本案件偵測到自傷/自殺風險信號。請優先給出危機支持與低壓方案。';
      } else if (hasIPV) {
        safetyContext = '本案件偵測到親密暴力相關信號。請避免共同修復方案，優先設計個人安全規劃。';
      } else if (SAFETY_SIGNAL_REGEX.test(content)) {
        safetyContext = '本案件提及安全相關議題，請格外留意安全優先原則。';
      }
    }

    if (requestsJointRepair) {
      await this.claimChatJointRepairProviderUse(
        judgment.case,
        judgment.case.id,
      );
    }

    let generatedPlans: AIReconciliationPlan[];
    try {
      const options: GenerateReconciliationPlanOptions = {
        intent,
        preferenceSummary: buildPreferenceSummary(preferences),
        locale,
      };
      generatedPlans = await aiService.generateReconciliationPlans(
        judgment.case.type,
        {
          plaintiff: judgment.plaintiff_ratio ?? 0,
          defendant: judgment.defendant_ratio ?? 0,
        },
        judgment.summary || '',
        undefined,
        safetyContext,
        undefined,
        options,
      );
    } catch (error) {
      logger.error('Failed to generate reconciliation plans', { judgmentId, error, intent });
      throw Errors.AI_SERVICE_ERROR('和好方案生成失敗');
    }

    let filteredPlans = generatedPlans;
    if (preferences) {
      if (preferences.difficulty) {
        filteredPlans = filteredPlans.filter((plan) => plan.difficulty_level === preferences.difficulty);
      }
      if (preferences.types && preferences.types.length > 0) {
        filteredPlans = filteredPlans.filter((plan) => preferences.types!.includes(plan.plan_type));
      }
    }

    if (filteredPlans.length === 0) {
      filteredPlans = generatedPlans;
    }

    const savedPlans = await prisma.$transaction(async (tx) => {
      if (requestsJointRepair) {
        await this.claimChatJointRepairInTransaction(tx, judgment.case);
      }
      const versionGroupId = existingPlans.find((plan) => plan.version_group_id)?.version_group_id ?? randomUUID();
      if (forceRegenerate && existingPlans.length > 0) {
        const supersededAt = new Date();
        await tx.reconciliationPlan.updateMany({
          where: {
            id: {
              in: existingPlans.map((plan) => plan.id),
            },
          },
          data: {
            version_group_id: versionGroupId,
            superseded_at: supersededAt,
          },
        });
        await tx.repairTrack.updateMany({
          where: {
            plan_id: {
              in: existingPlans.map((plan) => plan.id),
            },
            status: {
              notIn: ['completed', 'closed'],
            },
          },
          data: {
            status: 'closed',
            status_reason: 'superseded_by_regenerate',
            closed_reason: 'superseded_by_regenerate',
            closed_at: supersededAt,
          },
        });
      }

      const results: PlanRecordForHydration[] = [];
      for (const rawPlan of filteredPlans) {
        if (!isReconciliationPlanContent(rawPlan)) {
          throw Errors.VALIDATION_ERROR('無效的和好方案格式');
        }

        const safePlan = sanitizePlanStrings(rawPlan);
        const saved = await tx.reconciliationPlan.create({
          data: {
            judgment_id: judgmentId,
            intent,
            version_group_id: versionGroupId,
            plan_content: JSON.stringify(safePlan),
            plan_type: safePlan.plan_type,
            difficulty_level: safePlan.difficulty_level || 'medium',
            estimated_duration: safePlan.estimated_duration || 7,
            time_cost: safePlan.time_cost,
            money_cost: safePlan.money_cost,
            emotion_cost: safePlan.emotion_cost,
            skill_requirement: safePlan.skill_requirement,
          },
          include: {
            judgment: { include: { case: { include: REPAIR_CASE_INCLUDE } } },
            repair_track: {
              include: {
                participant_states: true,
                step_progresses: true,
                checkins: {
                  orderBy: { created_at: 'desc' },
                  take: 3,
                },
              },
            },
          },
        });
        results.push(saved as PlanRecordForHydration);
      }
      return results;
    }, { isolationLevel: 'ReadCommitted' });

    logger.info('Reconciliation plans generated', { judgmentId, count: savedPlans.length, intent });
    const versionSummary = await this.getVersionSummary(judgmentId, intent, savedPlans);

    return this.buildPlansPayload(
      savedPlans,
      userId || judgment.case.plaintiff_id || judgment.case.defendant_id || '',
      intent,
      buildReconciliationAccessContext(repairJourneyAccess),
      preferences,
      versionSummary,
      locale,
    );
  }

  /**
   * 獲取和好方案列表（含權限校驗）
   */
  async getPlansByJudgmentId(
    judgmentId: string,
    userId: string,
    filters?: {
      difficulty?: 'easy' | 'medium' | 'hard';
      type?: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
      intent?: ReconciliationIntent;
    },
    locale: BackendLocale = 'zh-TW',
  ) {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: { case: { include: REPAIR_CASE_INCLUDE } },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('梳理結果不存在');
    }

    const caseRecord = judgment.case;
    if (caseRecord.plaintiff_id !== userId && caseRecord.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限查看此梳理結果的和好方案');
    }

    const repairEligibility = getRepairEligibilityForCase(caseRecord);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(judgment, repairEligibility);
    if (!repairJourneyAccess.canEnterRepairJourney) {
      throw Errors.FORBIDDEN('此案件尚未綁定已登入當事人，不能查看修復旅程');
    }
    const requestedIntent = filters?.intent;
    const intent = requestedIntent && repairJourneyAccess.allowedReconciliationIntents.includes(requestedIntent)
      ? requestedIntent
      : repairJourneyAccess.defaultReconciliationIntent;

    const where: Prisma.ReconciliationPlanWhereInput = { judgment_id: judgmentId, intent, superseded_at: null };
    if (filters?.difficulty) where.difficulty_level = filters.difficulty;
    if (filters?.type) where.plan_type = filters.type;

    const plans = await prisma.reconciliationPlan.findMany({
      where,
      include: {
        judgment: { include: { case: { include: REPAIR_CASE_INCLUDE } } },
        repair_track: {
          include: {
            participant_states: true,
            step_progresses: true,
            checkins: {
              orderBy: { created_at: 'desc' },
              take: 3,
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const versionSummary = await this.getVersionSummary(judgmentId, intent, plans);
    return this.buildPlansPayload(
      plans as PlanRecordForHydration[],
      userId,
      intent,
      buildReconciliationAccessContext(repairJourneyAccess),
      undefined,
      versionSummary,
      locale,
    );
  }

  /**
   * 獲取和好方案詳情（包含 judgment / case / commitment）
   */
  async getPlanById(planId: string, userId: string, locale: BackendLocale = 'zh-TW') {
    const plan = await this.loadPlanForAction(planId, userId);
    const repairEligibility = getRepairEligibilityForCase(plan.judgment.case);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(plan.judgment, repairEligibility);
    this.assertPlanIntentAllowed(plan.intent, repairJourneyAccess);
    const { emotional_analysis: _ea, ...safeJudgment } = plan.judgment;
    const versionSummary = await this.getVersionSummary(plan.judgment_id, plan.intent, [plan]);
    const journeyContext = await this.buildJourneyContext(plan, userId, locale);
    const ctaState = await this.buildPlanCtaState(plan, userId, locale);
    return {
      ...this.hydratePlan(plan, userId),
      judgment: safeJudgment,
      viewer_role: this.getViewerRole(plan, userId),
      journey_context: journeyContext,
      invite_context: {
        partner_invited_at: plan.repair_track?.partner_invited_at ?? null,
        partner_status: this.buildCommitmentSummary(plan, userId).partner?.commitment_status ?? 'not_viewed',
        can_invite: repairJourneyAccess.canInvitePartner
          && !!this.getOtherParticipantId(plan.judgment.case, userId),
      },
      cta_state: ctaState,
      track_history_summary: this.buildTrackHistorySummary(plan, versionSummary),
    };
  }

  /**
   * 當前用戶承諾此方案
   */
  async selectPlan(planId: string, userId: string, locale: BackendLocale = 'zh-TW') {
    return this.respondPlan(planId, userId, 'committed', { locale });
  }

  async respondPlan(
    planId: string,
    userId: string,
    action: PlanRespondAction,
    options?: { reason?: string | null; remindInHours?: number | null; locale?: BackendLocale },
  ) {
    const locale = options?.locale ?? 'zh-TW';
    const plan = await this.loadPlanForAction(planId, userId);
    const caseRecord = plan.judgment.case;
    const isUser1 = caseRecord.plaintiff_id === userId;
    const partnerId = this.getOtherParticipantId(caseRecord, userId);
    const repairEligibility = getRepairEligibilityForCase(caseRecord);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(plan.judgment, repairEligibility);
    if (action === 'committed') {
      this.assertPlanIntentAllowed(plan.intent, repairJourneyAccess);
    }
    const mutation = await prisma.$transaction(async tx => {
      const track = await this.ensureRepairTrack(plan, tx);
      const partnerAlreadyCommitted = action === 'committed' && track.participant_states.some(
        state => state.user_id !== userId && state.commitment_status === 'committed',
      );
      let chatJointRepairAllowed = partnerAlreadyCommitted;
      if (partnerAlreadyCommitted) {
        await this.claimChatJointRepairInTransaction(tx, caseRecord);
      } else if (
        partnerId
        && action !== 'paused'
        && repairJourneyAccess.canNotifyPartner
      ) {
        // The personal response remains allowed while joint repair is blocked.
        // Its commit is the durable ordering point for a permitted notification.
        chatJointRepairAllowed = await this
          .observeChatJointRepairForNotificationInTransaction(tx, caseRecord);
      }

      if (action === 'committed') {
        await tx.reconciliationPlan.update({
          where: { id: planId },
          data: isUser1 ? { user1_selected: true } : { user2_selected: true },
        });
      }

      const existingState = track.participant_states.find((state) => state.user_id === userId);
      const now = new Date();
      const deferredUntil = action === 'deferred' && options?.remindInHours
        ? new Date(now.getTime() + options.remindInHours * 60 * 60 * 1000)
        : null;
      const nextCommitmentStatus: CommitmentStatusValue = action === 'viewed'
        ? existingState?.commitment_status === 'committed'
          ? 'committed'
          : existingState?.commitment_status === 'paused'
            ? 'paused'
            : existingState?.commitment_status === 'deferred'
              ? 'deferred'
            : existingState?.commitment_status === 'declined'
              ? 'declined'
              : 'viewed'
        : action;

      await tx.repairParticipantState.upsert({
        where: {
          repair_track_id_user_id: {
            repair_track_id: track.id,
            user_id: userId,
          },
        },
        create: {
          repair_track_id: track.id,
          user_id: userId,
          commitment_status: nextCommitmentStatus,
          viewed_at: action === 'viewed' || action === 'committed' ? now : null,
          committed_at: action === 'committed' ? now : null,
          response_reason: options?.reason ?? null,
          responded_at: action === 'viewed' ? existingState?.responded_at ?? null : now,
          deferred_until: action === 'deferred' ? deferredUntil : null,
          paused_at: action === 'paused' ? now : null,
          declined_at: action === 'declined' ? now : null,
        },
        update: {
          commitment_status: nextCommitmentStatus,
          viewed_at: action === 'viewed' || action === 'committed' ? now : existingState?.viewed_at ?? null,
          committed_at: action === 'committed' ? now : existingState?.committed_at ?? null,
          response_reason: options?.reason ?? existingState?.response_reason ?? null,
          responded_at: action === 'viewed' ? existingState?.responded_at ?? null : now,
          deferred_until: action === 'deferred' ? deferredUntil : null,
          paused_at: action === 'paused' ? now : null,
          declined_at: action === 'declined' ? now : null,
        },
      });
      await this.createTrackEvent(track.id, `participant_${action}`, userId, {
        plan_id: planId,
        reason: options?.reason ?? null,
        remind_in_hours: options?.remindInHours ?? null,
      }, tx);
      await this.syncTrackCommitment(
        track.id,
        undefined,
        repairJourneyAccess.forceSoloRepair
          || (action !== 'paused' && !chatJointRepairAllowed),
        tx,
      );
      return { trackId: track.id, now, chatJointRepairAllowed };
    }, { isolationLevel: 'ReadCommitted' });
    const refreshedPlan = await this.loadPlanForAction(planId, userId);

    if (
      partnerId
      && action !== 'paused'
      && repairJourneyAccess.canNotifyPartner
      && mutation.chatJointRepairAllowed
    ) {
      const templateCodeMap: Record<Exclude<PlanRespondAction, 'paused'>, string> = {
        viewed: 'repair_journey_partner_viewed',
        committed: 'repair_journey_partner_committed',
        deferred: 'repair_journey_partner_deferred',
        declined: 'repair_journey_partner_declined',
      };
      const actionKeyMap: Record<Exclude<PlanRespondAction, 'paused'>, string> = {
        viewed: 'view_invitation_status',
        committed: 'continue_today_step',
        deferred: 'view_invitation_status',
        declined: 'review_invitation',
      };
      const journeyContext = await this.buildJourneyContext(refreshedPlan, partnerId, locale);
      await notificationService.createIfEnabled(partnerId, {
        channel: 'email',
        template_code: templateCodeMap[action as Exclude<PlanRespondAction, 'paused'>],
        action_key: actionKeyMap[action as Exclude<PlanRespondAction, 'paused'>],
        dedup_key: `repair_journey_${action}_${mutation.trackId}_${partnerId}_${mutation.now.toISOString()}`,
        priority: action === 'committed' ? 'now' : action === 'deferred' ? 'soon' : 'later',
        group_key: `repair_track_${mutation.trackId}`,
        payload: {
          plan_id: planId,
          judgment_id: plan.judgment_id,
          repair_track_id: mutation.trackId,
          journey_status: action === 'committed'
            ? 'co_active'
            : refreshedPlan.repair_track?.status ?? 'draft',
          entity_type: 'repair_track',
          entity_id: mutation.trackId,
          path: action === 'committed'
            ? `/execution/${planId}/checkin`
            : `/reconciliation/${plan.judgment_id}/${planId}`,
          partner_state: action,
          reason_code: options?.reason ?? null,
          journey_context: journeyContext as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return this.hydratePlan(refreshedPlan, userId);
  }

  async getCommitment(planId: string, userId: string) {
    const plan = await this.loadPlanForAction(planId, userId);
    return this.buildCommitmentSummary(plan, userId);
  }

  async invitePartner(planId: string, userId: string, locale: BackendLocale = 'zh-TW') {
    const plan = await this.loadPlanForAction(planId, userId);
    const repairEligibility = getRepairEligibilityForCase(plan.judgment.case);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(plan.judgment, repairEligibility);
    this.assertPlanIntentAllowed(plan.intent, repairJourneyAccess);
    if (!repairJourneyAccess.canInvitePartner) {
      throw Errors.FORBIDDEN('此梳理結果路由不允許邀請伴侶加入修復旅程');
    }
    const partnerId = this.getOtherParticipantId(plan.judgment.case, userId);
    const invitedAt = new Date();
    const { trackId, syncedTrack } = await this.withChatJointRepairClaim(
      plan.judgment.case,
      async tx => {
        const track = await this.ensureRepairTrack(plan, tx);
        if (partnerId) {
          await tx.repairParticipantState.upsert({
            where: {
              repair_track_id_user_id: {
                repair_track_id: track.id,
                user_id: partnerId,
              },
            },
            create: {
              repair_track_id: track.id,
              user_id: partnerId,
              commitment_status: 'not_viewed',
              invited_at: invitedAt,
              last_notified_at: invitedAt,
            },
            update: {
              invited_at: invitedAt,
              last_notified_at: invitedAt,
            },
          });
        }

        const synced = await this.syncTrackCommitment(
          track.id,
          invitedAt,
          repairJourneyAccess.forceSoloRepair,
          tx,
        );
        await this.createTrackEvent(track.id, 'partner_invited', userId, {
          partner_id: partnerId,
          plan_id: planId,
        }, tx);
        return { trackId: track.id, syncedTrack: synced };
      },
    );
    if (partnerId) {
      const partnerPlan = await this.loadPlanForAction(planId, partnerId);
      const journeyContext = await this.buildJourneyContext(partnerPlan, partnerId, locale);
      await notificationService.createIfEnabled(partnerId, {
        channel: 'email',
        template_code: 'repair_journey_partner_invited',
        action_key: 'review_invitation',
        dedup_key: `repair_journey_partner_invited_${trackId}_${partnerId}_${invitedAt.toISOString()}`,
        priority: 'now',
        group_key: `repair_track_${trackId}`,
        payload: {
          plan_id: planId,
          judgment_id: plan.judgment_id,
          repair_track_id: trackId,
          path: `/reconciliation/${plan.judgment_id}/${planId}`,
          intent: plan.intent,
          journey_status: syncedTrack.status,
          entity_type: 'repair_track',
          entity_id: trackId,
          cta_label: journeyContext.primary_cta.label,
          partner_state: 'invited',
          journey_context: journeyContext as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return {
      track_id: syncedTrack.id,
      partner_id: partnerId,
      invited_at: invitedAt,
      status: syncedTrack.status,
    };
  }

  async startPlan(planId: string, userId: string, locale: BackendLocale = 'zh-TW') {
    const plan = await this.loadPlanForAction(planId, userId);
    const caseRecord = plan.judgment.case;
    const repairEligibility = getRepairEligibilityForCase(caseRecord);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(plan.judgment, repairEligibility);
    this.assertPlanIntentAllowed(plan.intent, repairJourneyAccess);
    const currentSelected = (caseRecord.plaintiff_id === userId && plan.user1_selected)
      || (caseRecord.defendant_id === userId && plan.user2_selected);
    if (!currentSelected) {
      throw Errors.FORBIDDEN('請先承諾此方案，再開始今天的第一步');
    }

    await prisma.$transaction(async tx => {
      let track = await this.ensureRepairTrack(plan, tx);
      const partnerAlreadyCommitted = track.participant_states.some(
        state => state.user_id !== userId && state.commitment_status === 'committed',
      );
      let jointClaimed = false;
      if (partnerAlreadyCommitted) {
        await this.claimChatJointRepairInTransaction(tx, caseRecord);
        jointClaimed = true;
      }
      if (this.getCurrentCommitmentStatus(track.participant_states, userId) !== 'committed') {
        const now = new Date();
        await tx.repairParticipantState.upsert({
          where: {
            repair_track_id_user_id: {
              repair_track_id: track.id,
              user_id: userId,
            },
          },
          create: {
            repair_track_id: track.id,
            user_id: userId,
            commitment_status: 'committed',
            viewed_at: now,
            committed_at: now,
          },
          update: {
            commitment_status: 'committed',
            viewed_at: now,
            committed_at: now,
          },
        });
        track = await this.syncTrackCommitment(
          track.id,
          undefined,
          repairJourneyAccess.forceSoloRepair,
          tx,
        );
      }

      const content = parseStoredPlanContent(plan.plan_content);
      const allSteps = content.steps.length > 0 ? content.steps : [content.first_step];
      if (track.step_progresses.length === 0) {
        await tx.repairStepProgress.createMany({
          data: allSteps.map((step, index) => ({
            repair_track_id: track.id,
            step_index: index,
            step_title: buildRepairStepTitle(index, locale, 'initial'),
            step_content: step,
            fallback_content: index === 0 ? content.fallback_step : null,
            pause_rule: content.pause_rule,
            status: index === 0 ? 'active' : 'pending',
          })),
        });
      } else {
        await tx.repairStepProgress.updateMany({
          where: { repair_track_id: track.id, step_index: track.current_step_index },
          data: { status: 'active' },
        });
      }

      const refreshedTrack = await tx.repairTrack.findUnique({
        where: { id: track.id },
        include: {
          participant_states: true,
          step_progresses: true,
          checkins: {
            orderBy: { created_at: 'desc' },
            take: 3,
          },
        },
      });

      const dualCommitted = !repairJourneyAccess.forceSoloRepair
        && refreshedTrack?.participant_states.filter(
          state => state.commitment_status === 'committed',
        ).length === 2;
      if (dualCommitted && !jointClaimed) {
        await this.claimChatJointRepairInTransaction(tx, caseRecord);
      }
      const status: RepairTrackStatusValue = dualCommitted ? 'co_active' : 'solo_active';

      await tx.repairTrack.update({
        where: { id: track.id },
        data: {
          status,
          recommended_mode: dualCommitted ? 'co' : 'solo',
          status_reason: dualCommitted ? 'dual_committed_started' : 'solo_started',
          started_at: new Date(),
          paused_at: null,
        },
      });
      await this.createTrackEvent(track.id, 'track_started', userId, {
        plan_id: planId,
        status,
      }, tx);
    }, { isolationLevel: 'ReadCommitted' });

    return this.loadPlanForAction(planId, userId).then((freshPlan) => this.hydratePlan(freshPlan, userId));
  }

  async pausePlan(planId: string, userId: string, locale: BackendLocale = 'zh-TW') {
    const plan = await this.loadPlanForAction(planId, userId);
    const track = await this.ensureRepairTrack(plan);
    await this.respondPlan(planId, userId, 'paused', { locale });
    await prisma.repairTrack.update({
      where: { id: track.id },
      data: {
        status: 'paused',
        status_reason: 'participant_paused',
        paused_at: new Date(),
      },
    });
    await this.createTrackEvent(track.id, 'participant_paused', userId, {
      plan_id: planId,
    });
    return this.getCommitment(planId, userId);
  }

  async resumeTrack(trackId: string, userId: string) {
    const track = await prisma.repairTrack.findUnique({
      where: { id: trackId },
      include: {
        plan: {
          include: {
            judgment: {
              include: { case: { include: REPAIR_CASE_INCLUDE } },
            },
          },
        },
        participant_states: true,
        step_progresses: true,
        checkins: {
          orderBy: { created_at: 'desc' },
          take: 3,
        },
      },
    });

    if (!track) {
      throw Errors.NOT_FOUND('修復旅程不存在');
    }

    const caseRecord = track.plan.judgment.case;
    if (caseRecord.plaintiff_id !== userId && caseRecord.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限恢復此修復旅程');
    }

    const repairEligibility = getRepairEligibilityForCase(caseRecord);
    const repairJourneyAccess = await getRepairJourneyAccessPolicyForJudgment(
      track.plan.judgment,
      repairEligibility,
    );
    this.assertPlanIntentAllowed(track.plan.intent, repairJourneyAccess);

    return prisma.$transaction(async tx => {
      const currentTrack = await tx.repairTrack.findUnique({
        where: { id: track.id },
        include: { participant_states: true },
      });
      if (!currentTrack) {
        throw Errors.NOT_FOUND('修復旅程不存在');
      }
      const partnerAlreadyCommitted = currentTrack.participant_states.some(
        state => state.user_id !== userId && state.commitment_status === 'committed',
      );
      let jointClaimed = false;
      if (partnerAlreadyCommitted) {
        await this.claimChatJointRepairInTransaction(tx, caseRecord);
        jointClaimed = true;
      }

      const existingState = currentTrack.participant_states.find(
        state => state.user_id === userId,
      );
      const now = new Date();
      await tx.repairParticipantState.upsert({
        where: {
          repair_track_id_user_id: {
            repair_track_id: currentTrack.id,
            user_id: userId,
          },
        },
        create: {
          repair_track_id: currentTrack.id,
          user_id: userId,
          commitment_status: 'committed',
          viewed_at: now,
          committed_at: existingState?.committed_at ?? now,
        },
        update: {
          commitment_status: 'committed',
          paused_at: null,
          committed_at: existingState?.committed_at ?? now,
        },
      });

      const refreshedTrack = await tx.repairTrack.findUnique({
        where: { id: currentTrack.id },
        include: { participant_states: true },
      });
      const committedCount = refreshedTrack?.participant_states.filter(
        state => state.commitment_status === 'committed',
      ).length ?? 1;
      const nextStatus: RepairTrackStatusValue = repairJourneyAccess.forceSoloRepair
        ? 'solo_active'
        : committedCount >= 2 ? 'co_active' : 'solo_active';
      if (nextStatus === 'co_active' && !jointClaimed) {
        await this.claimChatJointRepairInTransaction(tx, caseRecord);
      }

      const updatedTrack = await tx.repairTrack.update({
        where: { id: currentTrack.id },
        data: {
          status: nextStatus,
          status_reason: 'manual_resume',
          paused_at: null,
        },
      });
      await this.createTrackEvent(currentTrack.id, 'track_resumed', userId, {
        plan_id: currentTrack.plan_id,
        status: nextStatus,
      }, tx);

      return {
        track_id: updatedTrack.id,
        plan_id: updatedTrack.plan_id,
        status: updatedTrack.status,
      };
    }, { isolationLevel: 'ReadCommitted' });
  }
}

export const reconciliationService = new ReconciliationService();
