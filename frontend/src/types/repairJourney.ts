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
  repair_access?: {
    can_invite_partner: boolean;
    can_use_co_repair: boolean;
    can_notify_partner: boolean;
    force_solo_repair: boolean;
    relationship_scope: string;
    reasons: string[];
  };
}
