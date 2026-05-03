export type RepairJourneyViewerRole = 'initiator' | 'invitee' | 'solo';
export type RepairJourneyTask =
  | 'choose_direction'
  | 'review_recommendation'
  | 'invite_partner'
  | 'respond_invite'
  | 'wait_partner'
  | 'continue_today_step'
  | 'replan_now'
  | 'resume_track'
  | 'review_completed';
export type RepairPartnerState =
  | 'not_invited'
  | 'invited'
  | 'viewed'
  | 'deferred'
  | 'committed'
  | 'declined'
  | 'paused'
  | 'unavailable';
export type RepairJourneyUrgency = 'high' | 'medium' | 'low';
export type RepairJourneyTone = 'calm' | 'warm' | 'supportive' | 'caution';
export type RepairJourneyPresentationBucket =
  | 'draft'
  | 'partner_waiting'
  | 'active'
  | 'replanning'
  | 'paused'
  | 'completed';
export type RepairJourneyAccessContext = {
  flow: 'session_bound' | 'formal_solo' | 'formal_dual';
  product_flow: 'quick_single' | 'quick_collaborative' | 'formal_remote' | 'formal_collaborative' | 'chat_to_case';
  relationship_scope:
    | 'quick_single_solo'
    | 'quick_collaborative_solo'
    | 'formal_single_party'
    | 'formal_dual_party'
    | 'chat_to_case_single_perspective'
    | 'chat_to_case_dual_perspective'
    | 'unclaimed_session_asset';
  pairing_strength: 'none' | 'session_context' | 'weak_contextual' | 'formal_confirmed';
  can_invite_partner: boolean;
  can_use_co_repair: boolean;
  can_notify_partner: boolean;
  force_solo_repair: boolean;
  safety_source?: 'active_risk_state' | 'fallback_route' | 'route_policy';
  risk_level?: string;
  reasons: string[];
};

export interface RepairJourneyContext {
  viewer_role: RepairJourneyViewerRole;
  journey_task: RepairJourneyTask;
  partner_state: RepairPartnerState;
  title: string;
  body: string;
  primary_cta: {
    action: string;
    label: string;
    path: string;
  };
  secondary_cta: {
    action: string;
    label: string;
    path: string;
  } | null;
  urgency: RepairJourneyUrgency;
  banner_tone: RepairJourneyTone;
  reason_code: string;
  entry_path: string;
  resume_path: string;
  presentation_bucket: RepairJourneyPresentationBucket;
  repair_access: RepairJourneyAccessContext | null;
}

interface BuildRepairJourneyContextInput {
  judgmentId: string;
  planId: string;
  viewerRole: RepairJourneyViewerRole;
  trackStatus:
    | 'draft'
    | 'partner_invited'
    | 'solo_active'
    | 'co_active'
    | 'replanning'
    | 'paused'
    | 'completed'
    | 'closed'
    | 'none';
  currentCommitment:
    | 'not_viewed'
    | 'viewed'
    | 'deferred'
    | 'committed'
    | 'declined'
    | 'paused';
  partnerCommitment?:
    | 'not_viewed'
    | 'viewed'
    | 'deferred'
    | 'committed'
    | 'declined'
    | 'paused'
    | null;
  canInvite: boolean;
  hasPartner: boolean;
  isDualCommitted: boolean;
  statusReason?: string | null;
  recommendedMode?: 'solo' | 'co';
  repairAccess?: RepairJourneyAccessContext | null;
}

function buildPaths(judgmentId: string, planId: string) {
  return {
    judgment: `/judgment/${judgmentId}`,
    bundle: `/reconciliation/${judgmentId}`,
    detail: `/reconciliation/${judgmentId}/${planId}`,
    checkin: `/execution/${planId}/checkin`,
    replan: `/execution/${planId}/replan`,
  };
}

function buildPartnerState(
  hasPartner: boolean,
  trackStatus: BuildRepairJourneyContextInput['trackStatus'],
  partnerCommitment: BuildRepairJourneyContextInput['partnerCommitment'],
): RepairPartnerState {
  if (!hasPartner) return 'unavailable';
  if (partnerCommitment === 'committed') return 'committed';
  if (partnerCommitment === 'declined') return 'declined';
  if (partnerCommitment === 'deferred') return 'deferred';
  if (partnerCommitment === 'paused') return 'paused';
  if (partnerCommitment === 'viewed') return 'viewed';
  if (trackStatus === 'partner_invited') return 'invited';
  return 'not_invited';
}

function buildPresentationBucket(trackStatus: BuildRepairJourneyContextInput['trackStatus']): RepairJourneyPresentationBucket {
  switch (trackStatus) {
    case 'partner_invited':
      return 'partner_waiting';
    case 'solo_active':
    case 'co_active':
      return 'active';
    case 'replanning':
      return 'replanning';
    case 'paused':
      return 'paused';
    case 'completed':
    case 'closed':
      return 'completed';
    case 'draft':
    case 'none':
    default:
      return 'draft';
  }
}

export function buildRepairJourneyContext(input: BuildRepairJourneyContextInput): RepairJourneyContext {
  const paths = buildPaths(input.judgmentId, input.planId);
  const partnerState = buildPartnerState(input.hasPartner, input.trackStatus, input.partnerCommitment);
  const presentationBucket = buildPresentationBucket(input.trackStatus);

  if (input.trackStatus === 'replanning') {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'replan_now',
      partner_state: partnerState,
      title: '這一輪需要重新調整',
      body: '現在更重要的是把節奏調回可承受的範圍，而不是硬撐著往前走。',
      primary_cta: { action: 'replan_track', label: '重新調整這一輪', path: paths.replan },
      secondary_cta: { action: 'review_recommendation', label: '回看目前版本', path: paths.detail },
      urgency: 'high',
      banner_tone: 'caution',
      reason_code: input.statusReason || 'replanning',
      entry_path: paths.replan,
      resume_path: paths.replan,
      presentation_bucket: presentationBucket,
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.trackStatus === 'paused' || input.currentCommitment === 'paused') {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'resume_track',
      partner_state: partnerState,
      title: '這一輪可以再回來',
      body: '暫停不代表之前白費。如果現在比較有空間了，可以回來接續這一輪。',
      primary_cta: { action: 'resume_track', label: '恢復這一輪', path: paths.detail },
      secondary_cta: { action: 'review_recommendation', label: '先看看目前狀態', path: paths.detail },
      urgency: 'medium',
      banner_tone: 'supportive',
      reason_code: input.statusReason || 'paused',
      entry_path: paths.detail,
      resume_path: paths.detail,
      presentation_bucket: presentationBucket,
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.trackStatus === 'completed' || input.trackStatus === 'closed') {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'review_completed',
      partner_state: partnerState,
      title: '這一輪已經走完',
      body: '你可以回看這一輪最有效的地方，也可以再開始新一輪更適合現在的版本。',
      primary_cta: { action: 'review_completed_journey', label: '回看這一輪', path: paths.detail },
      secondary_cta: { action: 'review_direction', label: '重新看看方向', path: paths.bundle },
      urgency: 'low',
      banner_tone: 'warm',
      reason_code: input.statusReason || 'completed',
      entry_path: paths.detail,
      resume_path: paths.detail,
      presentation_bucket: presentationBucket,
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.viewerRole === 'invitee' && input.currentCommitment !== 'committed') {
    const isDeferred = input.currentCommitment === 'deferred';
    const isDeclined = input.currentCommitment === 'declined';
    return {
      viewer_role: input.viewerRole,
      journey_task: 'respond_invite',
      partner_state: partnerState,
      title: isDeclined ? '你目前暫時沒有加入這一輪' : isDeferred ? '你先留了一點時間給自己' : '對方邀請你一起試試看',
      body: isDeclined
        ? '這不代表之後都不能回來。你可以先看看，等準備好再決定。'
        : isDeferred
          ? '現在不用急著給出完整承諾，你可以在有空間時再回來看這一輪。'
          : '你可以先看看這一步是什麼，不需要立刻答應把所有事情一次處理完。',
      primary_cta: { action: 'respond_invite', label: '看看這個邀請', path: paths.detail },
      secondary_cta: { action: 'review_direction', label: '先只看目前狀態', path: paths.detail },
      urgency: isDeclined ? 'low' : 'medium',
      banner_tone: 'warm',
      reason_code: isDeclined ? 'invite_declined' : isDeferred ? 'invite_deferred' : 'invite_pending',
      entry_path: paths.detail,
      resume_path: paths.detail,
      presentation_bucket: 'partner_waiting',
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.currentCommitment === 'committed' && (input.trackStatus === 'solo_active' || input.trackStatus === 'co_active')) {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'continue_today_step',
      partner_state: partnerState,
      title: input.trackStatus === 'co_active' ? '你們今天可以一起往前一小步' : '今天只要先做一小步',
      body: input.trackStatus === 'co_active'
        ? '這一輪已經是雙方一起進行，不需要一次做到很多，只要先完成今天這一步。'
        : '你已經開始這一輪了，先把今天這一小步走完，比急著做很多更重要。',
      primary_cta: { action: 'continue_today_step', label: '去看今天的一小步', path: paths.checkin },
      secondary_cta: input.hasPartner && partnerState === 'not_invited' && input.canInvite
        ? { action: 'invite_partner', label: '邀請對方一起試', path: paths.detail }
        : { action: 'review_recommendation', label: '回看這一輪', path: paths.detail },
      urgency: 'high',
      banner_tone: 'supportive',
      reason_code: input.trackStatus,
      entry_path: paths.checkin,
      resume_path: paths.checkin,
      presentation_bucket: presentationBucket,
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.currentCommitment === 'committed' && input.hasPartner && ['invited', 'viewed', 'deferred'].includes(partnerState)) {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'wait_partner',
      partner_state: partnerState,
      title: partnerState === 'deferred' ? '對方需要一點時間' : '這一輪正在等對方節奏',
      body: partnerState === 'deferred'
        ? '對方不是直接拒絕，而是需要一點空間。你可以先由自己低壓地往前走。'
        : '你已經把邀請送出去了，接下來更重要的是留一些空間，不急著催促。',
      primary_cta: { action: 'view_invitation_status', label: '查看邀請進度', path: paths.detail },
      secondary_cta: { action: 'continue_today_step', label: '我先自己開始', path: paths.checkin },
      urgency: 'medium',
      banner_tone: 'calm',
      reason_code: partnerState === 'deferred' ? 'partner_deferred' : 'waiting_partner',
      entry_path: paths.detail,
      resume_path: paths.detail,
      presentation_bucket: 'partner_waiting',
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.currentCommitment === 'committed' && input.hasPartner && partnerState === 'declined') {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'review_recommendation',
      partner_state: partnerState,
      title: '對方暫時沒有加入這一輪',
      body: '這不代表這一輪完全失敗。你可以先由自己低壓地開始，或回來重新看看更適合的方向。',
      primary_cta: { action: 'continue_today_step', label: '我先自己開始', path: paths.checkin },
      secondary_cta: { action: 'review_direction', label: '重新看看方向', path: paths.bundle },
      urgency: 'medium',
      banner_tone: 'supportive',
      reason_code: 'partner_declined',
      entry_path: paths.detail,
      resume_path: paths.detail,
      presentation_bucket: 'partner_waiting',
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.currentCommitment === 'committed' && input.hasPartner && partnerState === 'not_invited' && input.canInvite) {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'invite_partner',
      partner_state: partnerState,
      title: '你可以決定是否邀請對方一起試',
      body: '你已經準備好了。下一步可以由你先開始，也可以用更低壓的方式邀請對方一起加入。',
      primary_cta: { action: 'invite_partner', label: '邀請對方一起試', path: paths.detail },
      secondary_cta: { action: 'continue_today_step', label: '先由我開始', path: paths.checkin },
      urgency: 'medium',
      banner_tone: 'warm',
      reason_code: 'ready_to_invite',
      entry_path: paths.detail,
      resume_path: paths.detail,
      presentation_bucket: 'draft',
      repair_access: input.repairAccess ?? null,
    };
  }

  if (input.trackStatus === 'none') {
    return {
      viewer_role: input.viewerRole,
      journey_task: 'choose_direction',
      partner_state: partnerState,
      title: '先選一個方向',
      body: '你不用現在就把所有事想清楚，只需要先選一個最接近目前狀態的方向。',
      primary_cta: { action: 'open_reconciliation_entry', label: '看看最適合你們的下一步', path: paths.bundle },
      secondary_cta: { action: 'review_judgment', label: '回看這份分析', path: paths.judgment },
      urgency: 'medium',
      banner_tone: 'warm',
      reason_code: 'no_track',
      entry_path: paths.bundle,
      resume_path: paths.bundle,
      presentation_bucket: 'draft',
      repair_access: input.repairAccess ?? null,
    };
  }

  return {
    viewer_role: input.viewerRole,
    journey_task: 'review_recommendation',
    partner_state: partnerState,
    title: '先看看這一輪最適合的下一步',
    body: input.isDualCommitted
      ? '你們都已經點頭，現在可以直接回到今天的一小步。'
      : '這一輪已整理好了，先看一眼最適合你們現在狀態的版本，再決定怎麼開始。',
    primary_cta: { action: input.isDualCommitted ? 'continue_today_step' : 'commit_plan', label: input.isDualCommitted ? '去看今天的一小步' : '回到承諾工作台', path: input.isDualCommitted ? paths.checkin : paths.detail },
    secondary_cta: { action: 'review_direction', label: '重新看看方向', path: paths.bundle },
    urgency: 'medium',
    banner_tone: 'warm',
    reason_code: input.statusReason || 'review_recommendation',
    entry_path: paths.detail,
    resume_path: input.isDualCommitted ? paths.checkin : paths.detail,
    presentation_bucket: presentationBucket,
    repair_access: input.repairAccess ?? null,
  };
}
