import type { RepairJourneyAccessContext } from './repair-eligibility.service';
import type { BackendLocale } from '../i18n';

export type { RepairJourneyAccessContext } from './repair-eligibility.service';

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
  locale?: BackendLocale;
}

interface RepairJourneyCtaCopy {
  label: string;
}

interface RepairJourneyContextCopy {
  title: string;
  body: string;
  primary: RepairJourneyCtaCopy;
  secondary: RepairJourneyCtaCopy;
}

const REPAIR_JOURNEY_COPY: Record<BackendLocale, Record<
  | 'replanning'
  | 'paused'
  | 'completed'
  | 'invite_declined'
  | 'invite_deferred'
  | 'invite_pending'
  | 'active_co'
  | 'active_solo'
  | 'wait_deferred'
  | 'wait_partner'
  | 'partner_declined'
  | 'ready_to_invite'
  | 'no_track'
  | 'review_dual'
  | 'review_default',
  RepairJourneyContextCopy
>> = {
  'zh-TW': {
    replanning: {
      title: '這一輪需要重新調整',
      body: '現在更重要的是把節奏調回可承受的範圍，而不是硬撐著往前走。',
      primary: { label: '重新調整這一輪' },
      secondary: { label: '回看目前版本' },
    },
    paused: {
      title: '這一輪可以再回來',
      body: '暫停不代表之前白費。如果現在比較有空間了，可以回來接續這一輪。',
      primary: { label: '恢復這一輪' },
      secondary: { label: '先看看目前狀態' },
    },
    completed: {
      title: '這一輪已經走完',
      body: '你可以回看這一輪最有效的地方，也可以再開始新一輪更適合現在的版本。',
      primary: { label: '回看這一輪' },
      secondary: { label: '重新看看方向' },
    },
    invite_declined: {
      title: '你目前暫時沒有加入這一輪',
      body: '這不代表之後都不能回來。你可以先看看，等準備好再決定。',
      primary: { label: '看看這個邀請' },
      secondary: { label: '先只看目前狀態' },
    },
    invite_deferred: {
      title: '你先留了一點時間給自己',
      body: '現在不用急著給出完整承諾，你可以在有空間時再回來看這一輪。',
      primary: { label: '看看這個邀請' },
      secondary: { label: '先只看目前狀態' },
    },
    invite_pending: {
      title: '對方邀請你一起試試看',
      body: '你可以先看看這一步是什麼，不需要立刻答應把所有事情一次處理完。',
      primary: { label: '看看這個邀請' },
      secondary: { label: '先只看目前狀態' },
    },
    active_co: {
      title: '你們今天可以一起往前一小步',
      body: '這一輪已經是雙方一起進行，不需要一次做到很多，只要先完成今天這一步。',
      primary: { label: '去看今天的一小步' },
      secondary: { label: '回看這一輪' },
    },
    active_solo: {
      title: '今天只要先做一小步',
      body: '你已經開始這一輪了，先把今天這一小步走完，比急著做很多更重要。',
      primary: { label: '去看今天的一小步' },
      secondary: { label: '回看這一輪' },
    },
    wait_deferred: {
      title: '對方需要一點時間',
      body: '對方不是直接拒絕，而是需要一點空間。你可以先由自己低壓地往前走。',
      primary: { label: '查看邀請進度' },
      secondary: { label: '我先自己開始' },
    },
    wait_partner: {
      title: '這一輪正在等對方節奏',
      body: '你已經把邀請送出去了，接下來更重要的是留一些空間，不急著催促。',
      primary: { label: '查看邀請進度' },
      secondary: { label: '我先自己開始' },
    },
    partner_declined: {
      title: '對方暫時沒有加入這一輪',
      body: '這不代表這一輪完全失敗。你可以先由自己低壓地開始，或回來重新看看更適合的方向。',
      primary: { label: '我先自己開始' },
      secondary: { label: '重新看看方向' },
    },
    ready_to_invite: {
      title: '你可以決定是否邀請對方一起試',
      body: '你已經準備好了。下一步可以由你先開始，也可以用更低壓的方式邀請對方一起加入。',
      primary: { label: '邀請對方一起試' },
      secondary: { label: '先由我開始' },
    },
    no_track: {
      title: '先選一個方向',
      body: '你不用現在就把所有事想清楚，只需要先選一個最接近目前狀態的方向。',
      primary: { label: '看看最適合你們的下一步' },
      secondary: { label: '回看這份分析' },
    },
    review_dual: {
      title: '先看看這一輪最適合的下一步',
      body: '你們都已經點頭，現在可以直接回到今天的一小步。',
      primary: { label: '去看今天的一小步' },
      secondary: { label: '重新看看方向' },
    },
    review_default: {
      title: '先看看這一輪最適合的下一步',
      body: '這一輪已整理好了，先看一眼最適合你們現在狀態的版本，再決定怎麼開始。',
      primary: { label: '回到承諾工作台' },
      secondary: { label: '重新看看方向' },
    },
  },
  'en-US': {
    replanning: {
      title: 'This round needs to be adjusted',
      body: 'What matters now is bringing the pace back to something manageable, not forcing yourself to push through.',
      primary: { label: 'Adjust this round' },
      secondary: { label: 'Review the current version' },
    },
    paused: {
      title: 'You can return to this round',
      body: 'Pausing does not mean the earlier effort was wasted. If there is more room now, you can continue this round.',
      primary: { label: 'Resume this round' },
      secondary: { label: 'Review the current status' },
    },
    completed: {
      title: 'This round has been completed',
      body: 'You can review what worked best in this round, or start another version that fits where things are now.',
      primary: { label: 'Review this round' },
      secondary: { label: 'Review the direction again' },
    },
    invite_declined: {
      title: 'You have chosen not to join this round for now',
      body: 'This does not mean you can never return. You can look first and decide when you feel ready.',
      primary: { label: 'View this invitation' },
      secondary: { label: 'Just review the current status' },
    },
    invite_deferred: {
      title: 'You gave yourself a little more time',
      body: 'You do not need to give a full commitment right now. You can come back to this round when you have more room.',
      primary: { label: 'View this invitation' },
      secondary: { label: 'Just review the current status' },
    },
    invite_pending: {
      title: 'They invited you to try this together',
      body: 'You can first see what this step involves. You do not need to agree to solve everything at once.',
      primary: { label: 'View this invitation' },
      secondary: { label: 'Just review the current status' },
    },
    active_co: {
      title: 'Today you can take one small step together',
      body: 'This round is already moving with both of you involved. You do not need to do a lot at once; just complete today\'s step.',
      primary: { label: 'View today\'s small step' },
      secondary: { label: 'Review this round' },
    },
    active_solo: {
      title: 'Today only needs one small step',
      body: 'You have already started this round. Finishing this small step matters more than rushing to do a lot.',
      primary: { label: 'View today\'s small step' },
      secondary: { label: 'Review this round' },
    },
    wait_deferred: {
      title: 'They need a little more time',
      body: 'They did not directly reject this; they need some room. You can continue forward gently on your own for now.',
      primary: { label: 'View invitation progress' },
      secondary: { label: 'I will start on my own' },
    },
    wait_partner: {
      title: 'This round is waiting for their pace',
      body: 'You have sent the invitation. What matters next is leaving some room instead of rushing for a response.',
      primary: { label: 'View invitation progress' },
      secondary: { label: 'I will start on my own' },
    },
    partner_declined: {
      title: 'They are not joining this round for now',
      body: 'This does not mean the whole round has failed. You can start gently on your own, or review a direction that fits better.',
      primary: { label: 'I will start on my own' },
      secondary: { label: 'Review the direction again' },
    },
    ready_to_invite: {
      title: 'You can decide whether to invite them to try together',
      body: 'You are ready. The next step can begin with you, or you can invite them in a lower-pressure way.',
      primary: { label: 'Invite them to try together' },
      secondary: { label: 'Start with me first' },
    },
    no_track: {
      title: 'Choose one direction first',
      body: 'You do not need to figure everything out now. Just choose the direction that feels closest to the current situation.',
      primary: { label: 'See the next step that fits best' },
      secondary: { label: 'Review this analysis' },
    },
    review_dual: {
      title: 'Review the next step that best fits this round',
      body: 'Both of you have said yes, so you can go straight back to today\'s small step.',
      primary: { label: 'View today\'s small step' },
      secondary: { label: 'Review the direction again' },
    },
    review_default: {
      title: 'Review the next step that best fits this round',
      body: 'This round has been organized. Take a look at the version that fits your current situation, then decide how to begin.',
      primary: { label: 'Return to the commitment workspace' },
      secondary: { label: 'Review the direction again' },
    },
  },
};

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
  const copy = REPAIR_JOURNEY_COPY[input.locale ?? 'zh-TW'];

  if (input.trackStatus === 'replanning') {
    const text = copy.replanning;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'replan_now',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'replan_track', label: text.primary.label, path: paths.replan },
      secondary_cta: { action: 'review_recommendation', label: text.secondary.label, path: paths.detail },
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
    const text = copy.paused;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'resume_track',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'resume_track', label: text.primary.label, path: paths.detail },
      secondary_cta: { action: 'review_recommendation', label: text.secondary.label, path: paths.detail },
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
    const text = copy.completed;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'review_completed',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'review_completed_journey', label: text.primary.label, path: paths.detail },
      secondary_cta: { action: 'review_direction', label: text.secondary.label, path: paths.bundle },
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
    const text = isDeclined ? copy.invite_declined : isDeferred ? copy.invite_deferred : copy.invite_pending;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'respond_invite',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'respond_invite', label: text.primary.label, path: paths.detail },
      secondary_cta: { action: 'review_direction', label: text.secondary.label, path: paths.detail },
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
    const text = input.trackStatus === 'co_active' ? copy.active_co : copy.active_solo;
    const secondaryText = input.hasPartner && partnerState === 'not_invited' && input.canInvite
      ? copy.ready_to_invite
      : text;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'continue_today_step',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'continue_today_step', label: text.primary.label, path: paths.checkin },
      secondary_cta: input.hasPartner && partnerState === 'not_invited' && input.canInvite
        ? { action: 'invite_partner', label: secondaryText.primary.label, path: paths.detail }
        : { action: 'review_recommendation', label: secondaryText.secondary.label, path: paths.detail },
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
    const text = partnerState === 'deferred' ? copy.wait_deferred : copy.wait_partner;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'wait_partner',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'view_invitation_status', label: text.primary.label, path: paths.detail },
      secondary_cta: { action: 'continue_today_step', label: text.secondary.label, path: paths.checkin },
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
    const text = copy.partner_declined;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'review_recommendation',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'continue_today_step', label: text.primary.label, path: paths.checkin },
      secondary_cta: { action: 'review_direction', label: text.secondary.label, path: paths.bundle },
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
    const text = copy.ready_to_invite;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'invite_partner',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'invite_partner', label: text.primary.label, path: paths.detail },
      secondary_cta: { action: 'continue_today_step', label: text.secondary.label, path: paths.checkin },
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
    const text = copy.no_track;
    return {
      viewer_role: input.viewerRole,
      journey_task: 'choose_direction',
      partner_state: partnerState,
      title: text.title,
      body: text.body,
      primary_cta: { action: 'open_reconciliation_entry', label: text.primary.label, path: paths.bundle },
      secondary_cta: { action: 'review_judgment', label: text.secondary.label, path: paths.judgment },
      urgency: 'medium',
      banner_tone: 'warm',
      reason_code: 'no_track',
      entry_path: paths.bundle,
      resume_path: paths.bundle,
      presentation_bucket: 'draft',
      repair_access: input.repairAccess ?? null,
    };
  }

  const text = input.isDualCommitted ? copy.review_dual : copy.review_default;
  return {
    viewer_role: input.viewerRole,
    journey_task: 'review_recommendation',
    partner_state: partnerState,
    title: text.title,
    body: text.body,
    primary_cta: { action: input.isDualCommitted ? 'continue_today_step' : 'commit_plan', label: text.primary.label, path: input.isDualCommitted ? paths.checkin : paths.detail },
    secondary_cta: { action: 'review_direction', label: text.secondary.label, path: paths.bundle },
    urgency: 'medium',
    banner_tone: 'warm',
    reason_code: input.statusReason || 'review_recommendation',
    entry_path: paths.detail,
    resume_path: input.isDualCommitted ? paths.checkin : paths.detail,
    presentation_bucket: presentationBucket,
    repair_access: input.repairAccess ?? null,
  };
}
