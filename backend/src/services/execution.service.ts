import prisma from '../config/database';
import { Prisma } from '../types/prisma-client';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { randomUUID } from 'crypto';
import {
  CASE_STATUS,
  EXECUTION_ACTION,
  EXECUTION_STATUS,
  PAGINATION,
  CLEANUP_THRESHOLDS,
} from '../utils/constants';
import { reconciliationService } from './reconciliation.service';
import { aiService } from './ai.service';
import { aiStreamService, type AIStreamHandle } from './ai-stream.service';
import { notificationService } from './notification.service';
import { buildRepairJourneyContext, buildRepairStepTitle } from './repair-journey.service';
import {
  buildRepairAccessContext,
  getRepairEligibilityForCase,
  getRepairJourneyAccessPolicyForJudgment,
} from './repair-eligibility.service';
import { buildRuntimeAILedgerSourceTracking } from '../utils/ai-ledger-source';
import { getAIPromptVersion } from '../utils/ai-prompt-version';
import { buildAIStreamFailurePayload } from './ai-stream-failure-payload-utils';
import type { BackendLocale } from '../i18n';

export interface CheckinDto {
  plan_id: string;
  notes?: string;
  photos?: string[];
  step_result?: 'done' | 'partial' | 'skipped';
  closeness?: 'closer' | 'same' | 'farther';
  stress?: 'low' | 'medium' | 'high';
  needs_help?: boolean;
}

export interface ReplanTrackDto {
  mode: 'lower_pressure' | 'slower_pace' | 'solo_first';
  reason: 'needs_help' | 'farther' | 'high_stress' | 'manual';
}

export interface ReplanTrackAccepted {
  track_id: string;
  status: 'replanning';
  accepted: true;
  stream_scope: 'repair_track';
  scope_id: string;
  stream_id: string;
  request_id: string;
}

interface ExecutionProgressResult {
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
}

interface ExecutionJourneyPlan {
  id: string;
  judgment_id: string;
  user1_selected: boolean;
  user2_selected: boolean;
  judgment: {
    emotional_analysis?: unknown;
    judgment_content?: string | null;
    case: {
      mode: string;
      session_id?: string | null;
      plaintiff_id: string | null;
      defendant_id: string | null;
      chat_to_case_links?: unknown[] | null;
      _count?: {
        chat_to_case_links?: number | null;
      } | null;
    };
  };
  repair_track?: null | {
    status: string;
    recommended_mode: string;
    status_reason?: string | null;
    partner_invited_at?: Date | null;
    participant_states: Array<{
      user_id: string;
      commitment_status: string;
      viewed_at?: Date | null;
      committed_at?: Date | null;
      invited_at?: Date | null;
      responded_at?: Date | null;
      deferred_until?: Date | null;
      response_reason?: string | null;
    }>;
  };
}

const REPAIR_CASE_INCLUDE = {
  chat_to_case_links: { select: { id: true }, take: 1 },
} as const;

function parsePlanContent(planContent: string) {
  try {
    return JSON.parse(planContent) as {
      title?: string;
      description?: string;
      steps?: string[];
      expected_effect?: string;
      fit_reason?: string;
      first_step?: string;
      fallback_step?: string;
      pause_rule?: string;
      do_not_use_when?: string[];
      risk_note?: string | null;
    };
  } catch {
    return {};
  }
}

function buildReplanTemplate(
  content: ReturnType<typeof parsePlanContent>,
  dto: ReplanTrackDto,
  locale: BackendLocale = 'zh-TW',
) {
  if (locale === 'en-US') {
    const currentCore = content.first_step || content.steps?.[0] || content.description || 'do one smaller, steadier action';
    const reasonTextMap: Record<ReplanTrackDto['reason'], string> = {
      needs_help: 'You clearly said this needs lower-pressure support right now.',
      farther: 'Recent interaction felt more distant, which suggests the original pace was too fast or too direct.',
      high_stress: 'This step created too much pressure, so slowing down matters more than pushing through.',
      manual: 'You chose to adjust this round, so the journey should return to a more manageable rhythm.',
    };

    const modeTemplate: Record<ReplanTrackDto['mode'], { suffix: string; firstStep: string; fallback: string; pauseRule: string; steps: string[] }> = {
      lower_pressure: {
        suffix: 'lower-pressure version',
        firstStep: `Break "${currentCore}" into a smaller step and do only the easiest 20%.`,
        fallback: 'If even that feels too hard, do one thing today that helps you steady yourself without asking for a response.',
        pauseRule: 'If pressure keeps rising, pause for 24 hours and keep only goodwill without pushing the issue.',
        steps: [
          'Start with the smallest, least pressured action of connection.',
          'Notice your own pressure and the other person’s response before deciding whether to add a second sentence or action.',
        ],
      },
      slower_pace: {
        suffix: 'slower-paced version',
        firstStep: `Slow this round down and only prepare for "${currentCore}" today.`,
        fallback: 'If you are not ready today, write down one sentence you may want to say later, without sending it yet.',
        pauseRule: 'If you feel urgency to finish everything at once, stop and wait until emotions settle.',
        steps: [
          'Prepare first without trying to finish the key conversation right away.',
          'When pressure settles, return to the next step in a slower way.',
        ],
      },
      solo_first: {
        suffix: 'solo-first version',
        firstStep: 'Do one repair action that you can complete on your own without asking them to join immediately.',
        fallback: 'If no step toward connection is possible today, care for your own emotion and boundary first.',
        pauseRule: 'If their response makes you feel less safe, pause and do not treat their silence as failure.',
        steps: [
          'Start with one kind action that does not require their response.',
          'After you feel steadier, decide whether to invite them back in.',
        ],
      },
    };

    const template = modeTemplate[dto.mode];
    return {
      title: `${content.title || 'Repair plan'} (${template.suffix})`,
      description: `${content.description || 'First, bring the pace back to something you can sustain.'} ${reasonTextMap[dto.reason]}`,
      expected_effect: content.expected_effect || 'This round can become sustainable again before either person drops out under pressure.',
      fit_reason: `${content.fit_reason || 'The original plan still has value.'} Right now, lowering resistance matters more so the repair can continue.`,
      do_not_use_when: Array.isArray(content.do_not_use_when) ? content.do_not_use_when : [],
      first_step: template.firstStep,
      fallback_step: template.fallback,
      pause_rule: template.pauseRule,
      steps: template.steps,
      risk_note: content.risk_note || null,
    };
  }

  const currentCore = content.first_step || content.steps?.[0] || content.description || '先做一個更小更穩的動作';
  const reasonTextMap: Record<ReplanTrackDto['reason'], string> = {
    needs_help: '你已經明確說現在需要更低壓的幫助。',
    farther: '最近的互動讓距離感變遠，表示原來的節奏太快或太直接。',
    high_stress: '這一步帶來了過高壓力，先降速比硬撐更重要。',
    manual: '你主動選擇重新調整，先讓旅程回到更可承受的節奏。',
  };

  const modeTemplate: Record<ReplanTrackDto['mode'], { suffix: string; firstStep: string; fallback: string; pauseRule: string; steps: string[] }> = {
    lower_pressure: {
      suffix: '低壓調整版',
      firstStep: `把原本的「${currentCore}」拆成更小的一步，只先完成最不費力的 20%。`,
      fallback: '如果連這一步都太難，今天只做一件能讓自己穩下來的小事，先不逼對方回應。',
      pauseRule: '如果壓力持續升高，先停 24 小時，只保留善意，不推進議題。',
      steps: [
        '先只做一個最小、最沒有壓力的靠近動作。',
        '觀察對方和自己的壓力感，再決定要不要補第二句話或第二個行動。',
      ],
    },
    slower_pace: {
      suffix: '慢節奏調整版',
      firstStep: `先把這一輪節奏放慢，今天只完成「${currentCore}」之前的準備動作。`,
      fallback: '如果今天還沒有準備好，先記下一句你想說但還不急著說的話。',
      pauseRule: '一旦出現急著把話說完的衝動，先停下來，等情緒回穩再繼續。',
      steps: [
        '先做準備，不急著一次完成關鍵對話。',
        '等壓力回穩後，再用更慢的方式補上下一步。',
      ],
    },
    solo_first: {
      suffix: '單人先行版',
      firstStep: '暫時不要求對方立刻加入，先完成一個只靠你自己就做得到的修復動作。',
      fallback: '如果今天做不到任何靠近，先只照顧自己的情緒和邊界。',
      pauseRule: '若對方的反應讓你更不安，先停下來，不把對方的沉默視為失敗。',
      steps: [
        '先做一個不需要對方回應的善意動作。',
        '等你自己更穩定之後，再決定是否重新邀請對方加入。',
      ],
    },
  };

  const template = modeTemplate[dto.mode];
  return {
    title: `${content.title || '修復方案'}（${template.suffix}）`,
    description: `${content.description || '先把步伐調到更能承受的節奏。'} ${reasonTextMap[dto.reason]}`,
    expected_effect: content.expected_effect || '讓這一輪修復先重新回到可持續的狀態。',
    fit_reason: `${content.fit_reason || '它原本就有幫助。'} 但現在更重要的是先降低阻力，讓你們不因壓力而退出。`,
    do_not_use_when: Array.isArray(content.do_not_use_when) ? content.do_not_use_when : [],
    first_step: template.firstStep,
    fallback_step: template.fallback,
    pause_rule: template.pauseRule,
    steps: template.steps,
    risk_note: content.risk_note || null,
  };
}

export class ExecutionService {
  /**
   * 載入方案並驗證用戶是案件當事人
   */
  private async loadPlanAndAssertParticipant(planId: string, userId: string) {
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: planId },
      include: {
        judgment: { include: { case: { include: REPAIR_CASE_INCLUDE } } },
        repair_track: {
          include: {
            participant_states: true,
            step_progresses: {
              orderBy: { step_index: 'asc' },
            },
            checkins: {
              where: { user_id: userId },
              orderBy: { created_at: 'desc' },
              take: 20,
            },
          },
        },
      },
    });
    if (!plan) throw Errors.NOT_FOUND('和好方案不存在');

    const caseRecord = plan.judgment.case;
    if (caseRecord.plaintiff_id !== userId && caseRecord.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限執行此方案');
    }
    return { plan, caseRecord };
  }

  /**
   * 檢查用戶是否已選擇此方案
   */
  private assertPlanSelected(
    plan: { user1_selected: boolean; user2_selected: boolean },
    caseRecord: { plaintiff_id: string | null; defendant_id: string | null },
    userId: string,
    errorMsg: string,
  ) {
    const isUser1 = caseRecord.plaintiff_id === userId;
    const isUser2 = caseRecord.defendant_id === userId;
    const selected = (isUser1 && plan.user1_selected) || (isUser2 && plan.user2_selected);
    if (!selected) throw Errors.FORBIDDEN(errorMsg);
  }

  private sanitizeNotes(notes?: string) {
    return notes
      ? notes
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
          .slice(0, 500)
      : undefined;
  }

  private sanitizePhotos(photos?: string[]) {
    return (photos || [])
      .filter((url) => /^https?:\/\//i.test(url))
      .slice(0, 20);
  }

  private extractPlanSummary(plan: {
    plan_content: string;
    plan_type: string;
    difficulty_level: string;
    estimated_duration: number | null;
  }) {
    const content = parsePlanContent(plan.plan_content);
    return {
      title: content.title || '',
      plan_type: plan.plan_type,
      difficulty_level: plan.difficulty_level,
      estimated_duration: plan.estimated_duration ?? undefined,
      fit_reason: content.fit_reason || '',
      first_step: content.first_step || '',
      pause_rule: content.pause_rule || '',
    };
  }

  private calculateLegacyProgress(
    plan: { estimated_duration: number | null },
    records: Array<{ action: string }>,
  ): ExecutionProgressResult {
    if (records.length === 0) {
      return { status: EXECUTION_STATUS.PENDING as ExecutionProgressResult['status'], progress: 0 };
    }

    const estimatedDuration = plan.estimated_duration || CLEANUP_THRESHOLDS.DEFAULT_ESTIMATED_DURATION_DAYS;
    const checkinCount = records.filter((record) => record.action === EXECUTION_ACTION.CHECKIN).length;
    const progress = Math.min(100, Math.round((checkinCount / estimatedDuration) * 100));

    let status: ExecutionProgressResult['status'] = EXECUTION_STATUS.IN_PROGRESS as ExecutionProgressResult['status'];
    if (progress >= 100) {
      status = EXECUTION_STATUS.COMPLETED as ExecutionProgressResult['status'];
    }

    return { status, progress };
  }

  private buildTrackProgress(track: {
    status: string;
    current_step_index: number;
    step_progresses: Array<{ status: string }>;
  }): ExecutionProgressResult {
    const totalSteps = Math.max(track.step_progresses.length, 1);
    const completedSteps = track.step_progresses.filter((step) => step.status === 'done').length;
    const progress = Math.min(100, Math.round((completedSteps / totalSteps) * 100));
    if (track.status === 'completed') {
      return { status: EXECUTION_STATUS.COMPLETED as ExecutionProgressResult['status'], progress: 100 };
    }
    if (completedSteps === 0 && track.current_step_index === 0) {
      return { status: EXECUTION_STATUS.PENDING as ExecutionProgressResult['status'], progress: 0 };
    }
    return { status: EXECUTION_STATUS.IN_PROGRESS as ExecutionProgressResult['status'], progress };
  }

  private buildJourneyActions(track: {
    id: string;
    plan_id: string;
    status: string;
    status_reason?: string | null;
    partner_invited_at?: Date | null;
    paused_at?: Date | null;
    completed_at?: Date | null;
    updated_at?: Date;
    last_replan_at?: Date | null;
  }) {
    const primaryCtaMap: Record<string, string> = {
      draft: 'commit_plan',
      partner_invited: 'view_invitation_status',
      solo_active: 'continue_today_step',
      co_active: 'continue_today_step',
      replanning: 'replan_track',
      paused: 'resume_track',
      completed: 'review_completed_journey',
      closed: 'review_history',
    };
    const secondaryCtaMap: Record<string, string | null> = {
      draft: 'review_direction',
      partner_invited: 'continue_solo',
      solo_active: 'pause_track',
      co_active: 'pause_track',
      replanning: 'pause_track',
      paused: 'review_direction',
      completed: 'restart_new_round',
      closed: 'restart_new_round',
    };

    return {
      primary_cta: primaryCtaMap[track.status] || 'continue_today_step',
      secondary_cta: secondaryCtaMap[track.status] || null,
      last_activity_at: track.completed_at || track.last_replan_at || track.paused_at || track.partner_invited_at || track.updated_at || null,
      status_reason: track.status_reason || null,
      replan_recommendation: track.status === 'replanning'
        ? 'lower_pressure'
        : null,
    };
  }

  private buildCommitmentSummary(
    plan: {
      user1_selected: boolean;
      user2_selected: boolean;
      judgment: {
        emotional_analysis?: unknown;
        judgment_content?: string | null;
        case: {
          mode: string;
          session_id?: string | null;
          plaintiff_id: string | null;
          defendant_id: string | null;
        };
      };
      repair_track?: null | {
        status: string;
        recommended_mode: string;
        partner_invited_at?: Date | null;
        participant_states: Array<{
          user_id: string;
          commitment_status: string;
          viewed_at?: Date | null;
          committed_at?: Date | null;
          responded_at?: Date | null;
          deferred_until?: Date | null;
          response_reason?: string | null;
        }>;
      };
    },
    userId: string,
  ) {
    const caseRecord = plan.judgment.case;
    const partnerId = caseRecord.plaintiff_id === userId ? caseRecord.defendant_id : caseRecord.plaintiff_id;
    const track = plan.repair_track;
    const currentState = track?.participant_states.find((state) => state.user_id === userId);
    const partnerState = partnerId
      ? track?.participant_states.find((state) => state.user_id === partnerId)
      : undefined;
    const currentSelected = (caseRecord.plaintiff_id === userId && plan.user1_selected)
      || (caseRecord.defendant_id === userId && plan.user2_selected);
    const partnerSelected = (partnerId === caseRecord.plaintiff_id && plan.user1_selected)
      || (partnerId === caseRecord.defendant_id && plan.user2_selected);

    return {
      track_status: track?.status || 'draft',
      recommended_mode: track?.recommended_mode || ((currentSelected && partnerSelected) ? 'co' : 'solo'),
      invited_partner_at: track?.partner_invited_at || null,
      is_dual_committed: (currentState?.commitment_status || (currentSelected ? 'committed' : 'not_viewed')) === 'committed'
        && (partnerState?.commitment_status || (partnerSelected ? 'committed' : 'not_viewed')) === 'committed',
      current_user: {
        user_id: userId,
        commitment_status: currentState?.commitment_status || (currentSelected ? 'committed' : 'not_viewed'),
        viewed_at: currentState?.viewed_at || null,
        committed_at: currentState?.committed_at || null,
        responded_at: currentState?.responded_at || null,
        deferred_until: currentState?.deferred_until || null,
        response_reason: currentState?.response_reason || null,
      },
      partner: partnerId ? {
        user_id: partnerId,
        commitment_status: partnerState?.commitment_status || (partnerSelected ? 'committed' : 'not_viewed'),
        viewed_at: partnerState?.viewed_at || null,
        committed_at: partnerState?.committed_at || null,
        responded_at: partnerState?.responded_at || null,
        deferred_until: partnerState?.deferred_until || null,
        response_reason: partnerState?.response_reason || null,
      } : null,
    };
  }

  private buildViewerRole(
    caseRecord: { plaintiff_id: string | null; defendant_id: string | null },
    track: {
      participant_states?: Array<{
        user_id: string;
        commitment_status: string;
        invited_at?: Date | null;
      }>;
    } | null | undefined,
    userId: string,
  ): 'initiator' | 'invitee' | 'solo' {
    const partnerId = caseRecord.plaintiff_id === userId ? caseRecord.defendant_id : caseRecord.plaintiff_id;
    if (!partnerId) return 'solo';
    const currentState = track?.participant_states?.find((state) => state.user_id === userId);
    if (currentState?.invited_at && !['committed', 'paused'].includes(currentState.commitment_status)) {
      return 'invitee';
    }
    return 'initiator';
  }

  private async getRepairJourneyAccessForExecution(plan: ExecutionJourneyPlan) {
    const repairEligibility = getRepairEligibilityForCase(plan.judgment.case);
    return getRepairJourneyAccessPolicyForJudgment(plan.judgment, repairEligibility);
  }

  private assertReplanIntentAllowed(
    intent: string,
    repairJourneyAccess: Awaited<ReturnType<typeof getRepairJourneyAccessPolicyForJudgment>>,
  ) {
    if (!repairJourneyAccess.allowedReconciliationIntents.includes(
      intent as (typeof repairJourneyAccess.allowedReconciliationIntents)[number],
    )) {
      throw Errors.FORBIDDEN('目前安全狀態不允許重新調整此方案，請返回梳理結果選擇安全支持方向');
    }
  }

  private async getEffectiveRelationshipModeForExecution(plan: ExecutionJourneyPlan): Promise<'solo' | 'co'> {
    const repairJourneyAccess = await this.getRepairJourneyAccessForExecution(plan);
    if (repairJourneyAccess.forceSoloRepair) return 'solo';
    return plan.repair_track?.recommended_mode === 'co' ? 'co' : 'solo';
  }

  private async buildJourneyContextForExecution(
    plan: ExecutionJourneyPlan,
    userId: string,
    locale: BackendLocale = 'zh-TW',
  ) {
    const commitment = this.buildCommitmentSummary(plan, userId);
    const repairJourneyAccess = await this.getRepairJourneyAccessForExecution(plan);
    const recommendedMode = repairJourneyAccess.forceSoloRepair
      ? 'solo'
      : (commitment.recommended_mode as 'solo' | 'co');
    const trackStatus = (plan.repair_track?.status as Parameters<typeof buildRepairJourneyContext>[0]['trackStatus']) ?? 'draft';
    const effectiveTrackStatus = repairJourneyAccess.forceSoloRepair && trackStatus === 'co_active'
      ? 'solo_active'
      : trackStatus;
    return buildRepairJourneyContext({
      judgmentId: plan.judgment_id,
      planId: plan.id,
      viewerRole: this.buildViewerRole(plan.judgment.case, plan.repair_track, userId),
      trackStatus: effectiveTrackStatus,
      currentCommitment: commitment.current_user.commitment_status as Parameters<typeof buildRepairJourneyContext>[0]['currentCommitment'],
      partnerCommitment: (commitment.partner?.commitment_status as Parameters<typeof buildRepairJourneyContext>[0]['partnerCommitment']) ?? null,
      canInvite: repairJourneyAccess.canInvitePartner && !!commitment.partner,
      hasPartner: !!commitment.partner,
      isDualCommitted: !repairJourneyAccess.forceSoloRepair && commitment.is_dual_committed,
      statusReason: plan.repair_track?.status_reason ?? null,
      recommendedMode,
      repairAccess: buildRepairAccessContext(repairJourneyAccess),
      locale,
    });
  }

  private buildLegacyJourneyActions(journeyContext: ReturnType<typeof buildRepairJourneyContext>) {
    return {
      primary_cta: journeyContext.primary_cta.action,
      secondary_cta: journeyContext.secondary_cta?.action ?? null,
      presentation_bucket: journeyContext.presentation_bucket,
      journey_context: journeyContext,
    };
  }

  private async ensureLegacyCompletionRecord(planId: string, userId: string) {
    const existingCompleted = await prisma.executionRecord.findFirst({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: EXECUTION_ACTION.COMPLETE,
      },
    });
    if (existingCompleted) return;

    await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: EXECUTION_ACTION.COMPLETE,
        status: EXECUTION_STATUS.COMPLETED,
        notes: '自動標記完成',
      },
    });
  }

  private async createTrackEvent(
    repairTrackId: string,
    eventType: string,
    userId?: string,
    payload?: Prisma.InputJsonValue,
  ) {
    await prisma.repairTrackEvent.create({
      data: {
        repair_track_id: repairTrackId,
        user_id: userId ?? null,
        event_type: eventType,
        ...(payload !== undefined ? { payload } : {}),
      },
    });
  }

  async assertTrackAccess(trackId: string, userId: string) {
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
      },
    });

    if (!track) {
      throw Errors.NOT_FOUND('修復旅程不存在');
    }

    const caseRecord = track.plan.judgment.case;
    if (caseRecord.plaintiff_id !== userId && caseRecord.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限查看此修復旅程');
    }

    return track;
  }

  private async getLatestRepairTrackSnapshot(trackId: string) {
    const snapshots = await aiStreamService.getSnapshots('repair_track', trackId);
    return [...snapshots]
      .sort((a, b) => b.lastSeq - a.lastSeq)
      .find((snapshot) => snapshot.metadata?.task_type === 'repair_replan') ?? null;
  }

  private async runReplanTask(
    trackId: string,
    requestedBy: string,
    dto: ReplanTrackDto,
    handle: AIStreamHandle,
    fallback: {
      status: 'solo_active' | 'co_active';
      planId: string;
      judgmentId: string;
      versionGroupId: string;
    },
    locale?: BackendLocale,
  ) {
    let safeFallbackStatus = fallback.status;

    try {
      await aiStreamService.start(handle, {
        actorRole: 'aiMediator',
        phase: 'collecting_context',
        metadata: {
          task_type: 'repair_replan',
          mode: dto.mode,
          reason: dto.reason,
          previous_plan_id: fallback.planId,
          judgment_id: fallback.judgmentId,
          track_id: trackId,
        },
      });
      await this.createTrackEvent(trackId, 'replan_started', requestedBy, {
        mode: dto.mode,
        reason: dto.reason,
        stream_id: handle.streamId,
      });

      const track = await prisma.repairTrack.findUnique({
        where: { id: trackId },
        include: {
          participant_states: true,
          step_progresses: { orderBy: { step_index: 'asc' } },
          checkins: { orderBy: { created_at: 'desc' }, take: 5 },
          plan: {
            include: {
              judgment: {
                include: { case: { include: REPAIR_CASE_INCLUDE } },
              },
            },
          },
        },
      });

      if (!track) {
        throw Errors.NOT_FOUND('修復旅程不存在');
      }

      let repairJourneyAccess = await this.getRepairJourneyAccessForExecution(track.plan);
      if (
        repairJourneyAccess.forceSoloRepair
        || !repairJourneyAccess.allowedReconciliationIntents.includes(
          track.intent as (typeof repairJourneyAccess.allowedReconciliationIntents)[number],
        )
      ) {
        safeFallbackStatus = 'solo_active';
      }
      this.assertReplanIntentAllowed(track.intent, repairJourneyAccess);

      const content = parsePlanContent(track.plan.plan_content);
      const originalPlan = {
        title: content.title || '修復方案',
        description: content.description || '',
        steps: Array.isArray(content.steps) ? content.steps : [],
        expected_effect: content.expected_effect || '',
        fit_reason: content.fit_reason || '',
        do_not_use_when: Array.isArray(content.do_not_use_when) ? content.do_not_use_when : [],
        first_step: content.first_step || '',
        fallback_step: content.fallback_step || '',
        pause_rule: content.pause_rule || '',
        risk_note: content.risk_note || undefined,
        time_cost: track.plan.time_cost,
        money_cost: track.plan.money_cost,
        emotion_cost: track.plan.emotion_cost,
        skill_requirement: track.plan.skill_requirement,
        plan_type: track.plan.plan_type,
        estimated_duration: track.plan.estimated_duration || undefined,
        difficulty_level: track.plan.difficulty_level,
      } as const;

      await aiStreamService.phase(handle, 'analyzing_recent_pulse', {
        actorRole: 'aiMediator',
        metadata: {
          task_type: 'repair_replan',
        },
      });

      const latestCheckin = track.checkins[0];
      await aiStreamService.phase(handle, 'drafting_adjustment', {
        actorRole: 'aiMediator',
        metadata: {
          task_type: 'repair_replan',
          latest_closeness: latestCheckin?.closeness ?? track.last_closeness ?? null,
          latest_stress: latestCheckin?.stress ?? track.last_stress ?? null,
        },
      });

      const replanned = await aiService.generateReplannedRepairPlan({
        originalPlan,
        intent: track.intent,
        mode: dto.mode,
        reason: dto.reason,
        relationshipMode: repairJourneyAccess.forceSoloRepair ? 'solo' : track.recommended_mode,
        locale,
        latestPulse: {
          closeness: latestCheckin?.closeness ?? track.last_closeness ?? undefined,
          stress: latestCheckin?.stress ?? track.last_stress ?? undefined,
          needs_help: latestCheckin?.needs_help ?? track.last_needs_help ?? undefined,
        },
        recentCheckins: track.checkins.map((checkin) => ({
          result: checkin.result,
          closeness: checkin.closeness,
          stress: checkin.stress,
          needs_help: checkin.needs_help,
          notes: checkin.notes,
        })),
        judgmentSummary: track.plan.judgment.summary || undefined,
        ledger: {
          streamId: handle.streamId,
          scopeType: handle.scopeType,
          scopeId: handle.scopeId,
          requestKind: 'repair_replan_generation',
          promptVersion: getAIPromptVersion('repair_replan_generation'),
          ...buildRuntimeAILedgerSourceTracking('repair_journey'),
          metadata: {
            parent_request_id: handle.requestId,
            track_id: track.id,
            plan_id: track.plan_id,
            judgment_id: track.plan.judgment_id,
            replan_mode: dto.mode,
            replan_reason: dto.reason,
          },
        },
      });

      await aiStreamService.phase(handle, 'finalizing_plan', {
        actorRole: 'aiMediator',
        metadata: {
          task_type: 'repair_replan',
        },
      });

      // The safety state can escalate while the AI request is in flight. Recheck
      // immediately before persisting a new plan so a queued standard repair
      // cannot cross the safety boundary after acceptance.
      repairJourneyAccess = await this.getRepairJourneyAccessForExecution(track.plan);
      if (
        repairJourneyAccess.forceSoloRepair
        || !repairJourneyAccess.allowedReconciliationIntents.includes(
          track.intent as (typeof repairJourneyAccess.allowedReconciliationIntents)[number],
        )
      ) {
        safeFallbackStatus = 'solo_active';
      }
      this.assertReplanIntentAllowed(track.intent, repairJourneyAccess);

      const supersededAt = new Date();
      const dualCommitted = track.participant_states.filter((state) => state.commitment_status === 'committed').length >= 2;
      const nextMode = repairJourneyAccess.forceSoloRepair || dto.mode === 'solo_first'
        ? 'solo'
        : dualCommitted ? 'co' : 'solo';
      const nextStatus = nextMode === 'co' ? 'co_active' : 'solo_active';
      const requesterIsPlaintiff = track.plan.judgment.case.plaintiff_id === requestedBy;
      const requesterIsDefendant = track.plan.judgment.case.defendant_id === requestedBy;

      const result = await prisma.$transaction(async (tx) => {
        const newPlan = await tx.reconciliationPlan.create({
          data: {
            judgment_id: track.plan.judgment_id,
            intent: track.intent,
            version_group_id: fallback.versionGroupId,
            plan_content: JSON.stringify(replanned),
            plan_type: replanned.plan_type,
            difficulty_level: replanned.difficulty_level || track.plan.difficulty_level,
            estimated_duration: replanned.estimated_duration || track.plan.estimated_duration,
            time_cost: replanned.time_cost,
            money_cost: replanned.money_cost,
            emotion_cost: replanned.emotion_cost,
            skill_requirement: replanned.skill_requirement,
            user1_selected: repairJourneyAccess.forceSoloRepair
              ? requesterIsPlaintiff
              : track.plan.user1_selected,
            user2_selected: repairJourneyAccess.forceSoloRepair
              ? requesterIsDefendant
              : track.plan.user2_selected,
          },
        });

        await tx.reconciliationPlan.update({
          where: { id: track.plan_id },
          data: {
            version_group_id: fallback.versionGroupId,
            superseded_at: supersededAt,
            superseded_by_plan_id: newPlan.id,
          },
        });

        await tx.repairStepProgress.updateMany({
          where: {
            repair_track_id: track.id,
            status: { in: ['pending', 'active', 'partial', 'skipped'] },
          },
          data: {
            status: 'adapted',
          },
        });

        const nextStepIndex = (track.step_progresses.at(-1)?.step_index ?? -1) + 1;
        const steps = replanned.steps.length > 0 ? replanned.steps : [replanned.first_step];
        await tx.repairStepProgress.createMany({
          data: steps.map((step, index) => ({
            repair_track_id: track.id,
            step_index: nextStepIndex + index,
            step_title: buildRepairStepTitle(index, locale ?? 'zh-TW', 'replanned'),
            step_content: step,
            fallback_content: index === 0 ? replanned.fallback_step : null,
            pause_rule: replanned.pause_rule,
            status: index === 0 ? 'active' : 'pending',
          })),
        });

        const updatedTrack = await tx.repairTrack.update({
          where: { id: track.id },
          data: {
            plan_id: newPlan.id,
            current_step_index: nextStepIndex,
            recommended_mode: nextMode,
            status: nextStatus,
            status_reason: 'replan_ready',
            needs_replan: false,
            last_replan_at: supersededAt,
            paused_at: null,
          },
        });

        await tx.repairTrackEvent.create({
          data: {
            repair_track_id: track.id,
            user_id: requestedBy,
            event_type: 'track_replanned',
            payload: {
              mode: dto.mode,
              reason: dto.reason,
              previous_plan_id: track.plan_id,
              next_plan_id: newPlan.id,
            },
          },
        });

        return {
          track_id: updatedTrack.id,
          plan_id: newPlan.id,
          status: updatedTrack.status,
          judgment_id: track.plan.judgment_id,
        };
      });

      const summaryText = replanned.description || replanned.first_step || replanned.title;
      await aiStreamService.completed(handle, {
        actorRole: 'aiMediator',
        fullText: summaryText,
        metadata: {
          task_type: 'repair_replan',
          plan_id: result.plan_id,
          judgment_id: result.judgment_id,
          track_id: result.track_id,
          mode: dto.mode,
          reason: dto.reason,
        },
      });
      await aiStreamService.persisted(handle, {
        actorRole: 'aiMediator',
        messageId: result.plan_id,
        metadata: {
          task_type: 'repair_replan',
          plan_id: result.plan_id,
          judgment_id: result.judgment_id,
          track_id: result.track_id,
          mode: dto.mode,
          reason: dto.reason,
        },
      });

      const refreshedTrack = await prisma.repairTrack.findUnique({
        where: { id: result.track_id },
        include: {
          participant_states: true,
          plan: {
            include: {
              judgment: {
                include: { case: { include: REPAIR_CASE_INCLUDE } },
              },
            },
          },
        },
      });
      const notificationAccess = refreshedTrack
        ? await this.getRepairJourneyAccessForExecution(refreshedTrack.plan)
        : repairJourneyAccess;
      const canNotifyPartner = notificationAccess.allowedReconciliationIntents.includes(
        track.intent as (typeof notificationAccess.allowedReconciliationIntents)[number],
      ) && notificationAccess.canNotifyPartner && !notificationAccess.forceSoloRepair;
      const partnerStates = canNotifyPartner
        ? track.participant_states.filter(
            (state) => state.user_id !== requestedBy && state.commitment_status === 'committed'
          )
        : [];
      for (const partner of partnerStates) {
        const partnerJourneyContext = refreshedTrack
          ? await this.buildJourneyContextForExecution(
              {
                ...refreshedTrack.plan,
                repair_track: {
                  status: refreshedTrack.status,
                  recommended_mode: refreshedTrack.recommended_mode,
                  status_reason: refreshedTrack.status_reason,
                  partner_invited_at: refreshedTrack.partner_invited_at,
                  participant_states: refreshedTrack.participant_states,
                },
              },
              partner.user_id,
            )
          : null;
        await notificationService.createIfEnabled(partner.user_id, {
          channel: 'email',
          template_code: 'repair_journey_replan_ready',
          action_key: 'continue_today_step',
          dedup_key: `repair_replan_ready_${result.track_id}_${partner.user_id}_${result.plan_id}`,
          priority: 'now',
          group_key: `repair_track_${result.track_id}`,
          payload: {
            repair_track_id: result.track_id,
            plan_id: result.plan_id,
            judgment_id: result.judgment_id,
            journey_status: result.status,
            mode: dto.mode,
            path: `/execution/${result.plan_id}/checkin`,
            entity_type: 'repair_track',
            entity_id: result.track_id,
            cta_label: '查看調整後的版本',
            journey_context: partnerJourneyContext as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } catch (error) {
      logger.error('Repair track AI replan failed', {
        trackId,
        requestedBy,
        mode: dto.mode,
        reason: dto.reason,
        error,
      });

      await prisma.repairTrack.update({
        where: { id: trackId },
        data: {
          status: safeFallbackStatus,
          status_reason: 'replan_failed',
          needs_replan: true,
        },
      }).catch(() => undefined);

      await this.createTrackEvent(trackId, 'replan_failed', requestedBy, {
        mode: dto.mode,
        reason: dto.reason,
      }).catch(() => undefined);

      await aiStreamService.failed(handle, buildAIStreamFailurePayload({
        code: 'REPLAN_FAILED',
        locale,
        fallbackMessage: 'AI 重調失敗',
        retryable: true,
      }), {
        actorRole: 'aiMediator',
        metadata: {
          task_type: 'repair_replan',
          previous_plan_id: fallback.planId,
          judgment_id: fallback.judgmentId,
          track_id: trackId,
          mode: dto.mode,
          reason: dto.reason,
        },
      }).catch(() => undefined);
    }
  }

  /**
   * 確認執行
   */
  async confirmExecution(userId: string, planId: string, locale: BackendLocale = 'zh-TW') {
    const { plan, caseRecord } = await this.loadPlanAndAssertParticipant(planId, userId);
    this.assertPlanSelected(plan, caseRecord, userId, '請先在和好方案中選擇此方案再確認執行');

    const existing = await prisma.executionRecord.findFirst({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: EXECUTION_ACTION.CONFIRM,
      },
    });

    await reconciliationService.startPlan(planId, userId, locale);

    if (existing) return existing;

    const execution = await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: EXECUTION_ACTION.CONFIRM,
        status: EXECUTION_STATUS.IN_PROGRESS,
      },
    });

    logger.info('Execution confirmed', { executionId: execution.id, userId, planId });

    return execution;
  }

  /**
   * 記下今天的一小步（兼容舊打卡接口）
   */
  async checkin(userId: string, data: CheckinDto, locale: BackendLocale = 'zh-TW') {
    const { plan, caseRecord } = await this.loadPlanAndAssertParticipant(data.plan_id, userId);
    this.assertPlanSelected(plan, caseRecord, userId, '請先選擇並確認此方案後再記錄進展');

    await reconciliationService.startPlan(data.plan_id, userId, locale);

    const safeNotes = this.sanitizeNotes(data.notes);
    const safePhotos = this.sanitizePhotos(data.photos);
    const track = await prisma.repairTrack.findUnique({
      where: { plan_id: data.plan_id },
      include: {
        step_progresses: {
          orderBy: { step_index: 'asc' },
        },
      },
    });

    if (!track) {
      throw Errors.NOT_FOUND('修復旅程不存在');
    }

    const currentStep = track.step_progresses.find((step) => step.step_index === track.current_step_index)
      || track.step_progresses[0];
    const stepIndex = currentStep?.step_index ?? 0;
    const stepResult = data.step_result || 'done';
    const closeness = data.closeness || 'same';
    const stress = data.stress || 'medium';
    const needsHelp = data.needs_help ?? false;

    await prisma.repairCheckIn.create({
      data: {
        repair_track_id: track.id,
        user_id: userId,
        step_index: stepIndex,
        result: stepResult,
        closeness,
        stress,
        needs_help: needsHelp,
        notes: safeNotes,
        photos_urls: safePhotos,
      },
    });

    const nextStep = track.step_progresses.find((step) => step.step_index === stepIndex + 1);
    if (currentStep) {
      await prisma.repairStepProgress.update({
        where: {
          repair_track_id_step_index: {
            repair_track_id: track.id,
            step_index: stepIndex,
          },
        },
        data: {
          status: stepResult === 'done' ? 'done' : stepResult,
          completed_by: stepResult === 'done' ? userId : null,
          completed_at: stepResult === 'done' ? new Date() : null,
        },
      });
    }

    const shouldReplan = needsHelp || closeness === 'farther' || stress === 'high';
    if (stepResult === 'done' && nextStep) {
      await prisma.repairStepProgress.update({
        where: {
          repair_track_id_step_index: {
            repair_track_id: track.id,
            step_index: nextStep.step_index,
          },
        },
        data: {
          status: 'active',
        },
      });
    }

    const completedTrack = stepResult === 'done' && !nextStep;
    await prisma.repairTrack.update({
      where: { id: track.id },
      data: {
        current_step_index: stepResult === 'done' && nextStep ? nextStep.step_index : track.current_step_index,
        status: completedTrack
          ? 'completed'
          : shouldReplan
            ? 'replanning'
            : track.status === 'co_active'
              ? 'co_active'
              : 'solo_active',
        status_reason: completedTrack
          ? 'all_steps_completed'
          : shouldReplan
            ? needsHelp
              ? 'needs_help'
              : closeness === 'farther'
                ? 'farther'
                : 'high_stress'
            : stepResult === 'partial'
              ? 'partial_progress'
              : stepResult === 'skipped'
                ? 'step_skipped'
                : 'step_completed',
        last_closeness: closeness,
        last_stress: stress,
        last_needs_help: needsHelp,
        needs_replan: shouldReplan,
        completed_at: completedTrack ? new Date() : null,
      },
    });

    const execution = await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: data.plan_id,
        user_id: userId,
        action: EXECUTION_ACTION.CHECKIN,
        status: completedTrack ? EXECUTION_STATUS.COMPLETED : EXECUTION_STATUS.IN_PROGRESS,
        notes: safeNotes,
        photos_urls: safePhotos,
      },
    });

    if (completedTrack) {
      await this.ensureLegacyCompletionRecord(data.plan_id, userId);
    }
    await this.createTrackEvent(track.id, shouldReplan ? 'step_requested_replan' : 'step_checked_in', userId, {
      plan_id: data.plan_id,
      step_result: stepResult,
      closeness,
      stress,
      needs_help: needsHelp,
    });

    logger.info('Execution checkin', {
      executionId: execution.id,
      userId,
      planId: data.plan_id,
      stepResult,
      closeness,
      stress,
      needsHelp,
    });

    return execution;
  }

  async replanTrack(userId: string, trackId: string, dto: ReplanTrackDto, locale?: BackendLocale): Promise<ReplanTrackAccepted> {
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
        step_progresses: {
          orderBy: { step_index: 'asc' },
        },
      },
    });

    if (!track) {
      throw Errors.NOT_FOUND('修復旅程不存在');
    }

    const caseRecord = track.plan.judgment.case;
    if (caseRecord.plaintiff_id !== userId && caseRecord.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限調整此修復旅程');
    }

    if (!['solo_active', 'co_active', 'replanning'].includes(track.status)) {
      throw Errors.VALIDATION_ERROR('目前這一輪狀態無法重新調整');
    }

    const repairJourneyAccess = await this.getRepairJourneyAccessForExecution(track.plan);
    this.assertReplanIntentAllowed(track.intent, repairJourneyAccess);

    const existingSnapshot = await this.getLatestRepairTrackSnapshot(trackId);
    if (existingSnapshot && ['created', 'queued', 'started', 'streaming', 'completed'].includes(existingSnapshot.status)) {
      return {
        track_id: track.id,
        status: 'replanning',
        accepted: true,
        stream_scope: 'repair_track',
        scope_id: track.id,
        stream_id: existingSnapshot.streamId,
        request_id: existingSnapshot.requestId,
      };
    }

    const fallbackStatus = repairJourneyAccess.forceSoloRepair
      ? 'solo_active'
      : track.recommended_mode === 'co' ? 'co_active' : 'solo_active';
    const versionGroupId = track.plan.version_group_id || randomUUID();
    const streamHandle = await aiStreamService.createStream('repair_track', track.id);

    await prisma.repairTrack.update({
      where: { id: track.id },
      data: {
        status: 'replanning',
        status_reason: dto.reason,
        needs_replan: true,
      },
    });
    await this.createTrackEvent(track.id, 'replan_requested', userId, {
      mode: dto.mode,
      reason: dto.reason,
      stream_id: streamHandle.streamId,
      request_id: streamHandle.requestId,
    });

    void this.runReplanTask(track.id, userId, dto, streamHandle, {
      status: fallbackStatus,
      planId: track.plan_id,
      judgmentId: track.plan.judgment_id,
      versionGroupId,
    }, locale);

    logger.info('Repair track replan accepted', {
      trackId,
      userId,
      mode: dto.mode,
      reason: dto.reason,
      streamId: streamHandle.streamId,
    });

    return {
      track_id: track.id,
      status: 'replanning',
      accepted: true,
      stream_scope: 'repair_track',
      scope_id: track.id,
      stream_id: streamHandle.streamId,
      request_id: streamHandle.requestId,
    };
  }

  async resumeTrack(userId: string, trackId: string) {
    return reconciliationService.resumeTrack(trackId, userId);
  }

  /**
   * 獲取執行狀態（兼容舊接口，實際返回新旅程信息）
   */
  async getExecutionStatus(userId: string, planId: string, locale: BackendLocale = 'zh-TW') {
    const { plan } = await this.loadPlanAndAssertParticipant(planId, userId);
    const records = await prisma.executionRecord.findMany({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
      },
      orderBy: { created_at: 'desc' },
    });

    const track = await prisma.repairTrack.findUnique({
      where: { plan_id: planId },
      include: {
        participant_states: true,
        step_progresses: {
          orderBy: { step_index: 'asc' },
        },
        checkins: {
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });
    const latestReplanSnapshot = track ? await this.getLatestRepairTrackSnapshot(track.id) : null;

    const progressResult = track
      ? this.buildTrackProgress(track)
      : this.calculateLegacyProgress(plan, records);
    const planWithTrack = {
      ...plan,
      repair_track: track ? {
        status: track.status,
        recommended_mode: track.recommended_mode,
        status_reason: track.status_reason,
        partner_invited_at: track.partner_invited_at,
        participant_states: track.participant_states,
      } : null,
    };
    const journeyContext = await this.buildJourneyContextForExecution(planWithTrack, userId, locale);
    const relationshipMode = await this.getEffectiveRelationshipModeForExecution(planWithTrack);

    const planContent = parsePlanContent(plan.plan_content);
    const currentStep = track?.step_progresses.find((step) => step.step_index === track.current_step_index)
      || track?.step_progresses[0];

    return {
      track_id: track?.id || null,
      plan_id: planId,
      judgment_id: plan.judgment_id,
      replan_state: latestReplanSnapshot?.status || null,
      active_replan_stream_id: latestReplanSnapshot && !['persisted', 'failed', 'cancelled'].includes(latestReplanSnapshot.status)
        ? latestReplanSnapshot.streamId
        : null,
      latest_plan_version: plan.superseded_by_plan_id || plan.id,
      superseded_plan_id: plan.superseded_by_plan_id || null,
      status: progressResult.status,
      journey_status: track?.status || 'draft',
      relationship_mode: relationshipMode,
      records,
      recent_checkins: track?.checkins || [],
      progress: progressResult.progress,
      plan_summary: this.extractPlanSummary(plan),
      commitment: this.buildCommitmentSummary(plan, userId),
      current_step: currentStep ? {
        step_index: currentStep.step_index,
        title: currentStep.step_title,
        content: currentStep.step_content,
        fallback_content: currentStep.fallback_content,
        pause_rule: currentStep.pause_rule || planContent.pause_rule || '',
      } : {
        step_index: 0,
        title: '今天的一小步',
        content: planContent.first_step || planContent.steps?.[0] || planContent.description || '',
        fallback_content: planContent.fallback_step || '',
        pause_rule: planContent.pause_rule || '',
      },
      pulse_summary: {
        closeness: track?.last_closeness || 'same',
        stress: track?.last_stress || 'medium',
        needs_replan: track?.needs_replan || false,
        needs_help: track?.last_needs_help || false,
      },
      ...this.buildJourneyActions({
        id: track?.id || `legacy-${planId}`,
        plan_id: planId,
        status: track?.status || 'draft',
        status_reason: track?.status_reason || null,
        partner_invited_at: track?.partner_invited_at || null,
        paused_at: track?.paused_at || null,
        completed_at: track?.completed_at || null,
        updated_at: track?.updated_at,
        last_replan_at: track?.last_replan_at || null,
      }),
      ...this.buildLegacyJourneyActions(journeyContext),
    };
  }

  /**
   * 獲取所有執行狀態（用於修復進展看板）
   */
  async getAllExecutionStatuses(userId: string, locale: BackendLocale = 'zh-TW') {
    const tracks = await prisma.repairTrack.findMany({
      where: {
        participant_states: {
          some: { user_id: userId },
        },
      },
      orderBy: { updated_at: 'desc' },
      include: {
        participant_states: true,
        step_progresses: {
          orderBy: { step_index: 'asc' },
        },
        checkins: {
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          take: PAGINATION.EXECUTION_RECORDS_TAKE,
        },
        plan: {
          include: {
            judgment: {
              include: { case: { include: REPAIR_CASE_INCLUDE } },
            },
            execution_records: {
              where: { user_id: userId },
              orderBy: { created_at: 'desc' },
              take: PAGINATION.EXECUTION_RECORDS_TAKE,
            },
          },
        },
      },
    });

    if (tracks.length > 0) {
      return Promise.all(tracks.map(async (track) => {
        const progressResult = this.buildTrackProgress(track);
        const planWithTrack = {
          ...track.plan,
          repair_track: {
            status: track.status,
            recommended_mode: track.recommended_mode,
            status_reason: track.status_reason,
            partner_invited_at: track.partner_invited_at,
            participant_states: track.participant_states,
          },
        };
        const journeyContext = await this.buildJourneyContextForExecution(planWithTrack, userId, locale);
        const relationshipMode = await this.getEffectiveRelationshipModeForExecution(planWithTrack);
        return {
          track_id: track.id,
          plan_id: track.plan_id,
          judgment_id: track.plan.judgment_id,
          status: progressResult.status,
          journey_status: track.status,
          relationship_mode: relationshipMode,
          records: track.plan.execution_records,
          recent_checkins: track.checkins,
          progress: progressResult.progress,
          plan_summary: this.extractPlanSummary(track.plan),
          commitment: this.buildCommitmentSummary(
            {
              ...track.plan,
              repair_track: {
                status: track.status,
                recommended_mode: track.recommended_mode,
                partner_invited_at: track.partner_invited_at,
                participant_states: track.participant_states,
              },
            },
            userId,
          ),
          pulse_summary: {
            closeness: track.last_closeness || 'same',
            stress: track.last_stress || 'medium',
            needs_replan: track.needs_replan,
            needs_help: track.last_needs_help || false,
          },
          ...this.buildJourneyActions(track),
          ...this.buildLegacyJourneyActions(journeyContext),
        };
      }));
    }

    const cases = await prisma.case.findMany({
      where: {
        OR: [
          { plaintiff_id: userId },
          { defendant_id: userId },
        ],
        status: { in: [CASE_STATUS.COMPLETED] },
      },
      take: PAGINATION.EXECUTION_LIST_TAKE,
      orderBy: { created_at: 'desc' },
      include: {
        chat_to_case_links: { select: { id: true }, take: 1 },
        judgment: {
          include: {
            reconciliation_plans: {
              include: {
                execution_records: {
                  where: { user_id: userId },
                  orderBy: { created_at: 'desc' },
                  take: PAGINATION.EXECUTION_RECORDS_TAKE,
                },
              },
            },
          },
        },
      },
    });

    const legacyPlans = cases.flatMap((caseRecord) => {
      const judgment = caseRecord.judgment;
      if (!judgment) return [];
      return judgment.reconciliation_plans
        .filter((plan) => {
          const isUser1 = caseRecord.plaintiff_id === userId;
          return (isUser1 && plan.user1_selected) || (!isUser1 && plan.user2_selected);
        })
        .map((plan) => ({ caseRecord, judgment, plan }));
    });

    return Promise.all(legacyPlans.map(async ({ caseRecord, judgment, plan }) => {
      const progressResult = this.calculateLegacyProgress(plan, plan.execution_records);
      const planWithTrack = {
        ...plan,
        repair_track: null,
        judgment: {
          emotional_analysis: judgment.emotional_analysis,
          judgment_content: judgment.judgment_content,
          case: {
            id: caseRecord.id,
            mode: caseRecord.mode,
            session_id: caseRecord.session_id,
            plaintiff_id: caseRecord.plaintiff_id,
            defendant_id: caseRecord.defendant_id,
            chat_to_case_links: caseRecord.chat_to_case_links,
          },
        },
      };
      const journeyContext = await this.buildJourneyContextForExecution(planWithTrack, userId, locale);
      return {
        track_id: null,
        plan_id: plan.id,
        judgment_id: plan.judgment_id,
        status: progressResult.status,
        journey_status: 'draft',
        relationship_mode: 'solo',
        records: plan.execution_records,
        recent_checkins: [],
        progress: progressResult.progress,
        plan_summary: this.extractPlanSummary(plan),
        commitment: {
          track_status: 'draft',
          recommended_mode: 'solo',
        },
        pulse_summary: {
          closeness: 'same',
          stress: 'medium',
          needs_replan: false,
          needs_help: false,
        },
        ...this.buildJourneyActions({
          id: `legacy-${plan.id}`,
          plan_id: plan.id,
          status: 'draft',
          updated_at: plan.created_at,
        }),
        ...this.buildLegacyJourneyActions(journeyContext),
      };
    }));
  }
}

export const executionService = new ExecutionService();
