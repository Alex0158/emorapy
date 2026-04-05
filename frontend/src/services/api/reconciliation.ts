/**
 * 和好方案 API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { RepairJourneyContext } from '@/types/repairJourney';

export type ReconciliationIntent = 'repair' | 'cool_down' | 'graceful_exit' | 'safety_support';
export type PlanStylePreference = 'action' | 'conversation' | 'companionship' | 'distance';

export interface ReconciliationPlanContent {
  title: string;
  description: string;
  steps: string[];
  expected_effect: string;
  fit_reason: string;
  do_not_use_when: string[];
  first_step: string;
  fallback_step: string;
  pause_rule: string;
  risk_note?: string | null;
}

export interface CommitmentSummary {
  track_id: string | null;
  track_status: string;
  recommended_mode: 'solo' | 'co';
  invited_partner_at: string | null;
  is_dual_committed: boolean;
  current_user: {
    user_id: string;
    commitment_status: string;
    viewed_at: string | null;
    committed_at: string | null;
    responded_at?: string | null;
    deferred_until?: string | null;
    response_reason?: string | null;
  };
  partner: {
    user_id: string;
    commitment_status: string;
    viewed_at: string | null;
    committed_at: string | null;
    responded_at?: string | null;
    deferred_until?: string | null;
    response_reason?: string | null;
  } | null;
}

export interface JourneyEntry {
  status: string;
  track_id: string | null;
  active_plan_id: string | null;
  recommended_action: string;
  last_pulse: {
    closeness: string | null;
    stress: string | null;
    needs_help: boolean | null;
    needs_replan: boolean;
  } | null;
  has_superseded_versions: boolean;
  journey_context?: RepairJourneyContext;
}

export interface VersionSummary {
  version_group_id: string | null;
  has_superseded_versions: boolean;
  superseded_versions_count: number;
}

export interface PlanInviteContext {
  partner_invited_at: string | null;
  partner_status: string;
  can_invite: boolean;
}

export interface PlanCtaState {
  primary_action: string;
  secondary_action: string | null;
}

export interface TrackHistorySummary {
  current_track_id: string | null;
  current_version_group_id: string | null;
  has_superseded_versions: boolean;
  superseded_versions_count: number;
  current_plan_superseded_at: string | null;
}

export interface ReconciliationPlan {
  id: string;
  judgment_id: string;
  intent: ReconciliationIntent;
  plan_content: string;
  content?: ReconciliationPlanContent;
  plan_type: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
  difficulty_level: 'easy' | 'medium' | 'hard';
  estimated_duration?: number;
  time_cost: number;
  money_cost: number;
  emotion_cost: number;
  skill_requirement: number;
  user1_selected: boolean;
  user2_selected: boolean;
  created_at: string;
  fit_reason?: string;
  first_step?: string;
  fallback_step?: string;
  pause_rule?: string;
  do_not_use_when?: string[];
  risk_note?: string | null;
  is_recommended?: boolean;
  commitment?: CommitmentSummary;
  journey_context?: RepairJourneyContext;
}

export interface PlanPreferences {
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: number;
  types?: ('activity' | 'communication' | 'intimacy' | 'gift' | 'service')[];
  pressure_level?: 'low' | 'medium' | 'high';
  pace?: 'today' | 'this_week' | 'ease_in';
  style?: PlanStylePreference[];
  invite_partner?: boolean;
}

export interface ReconciliationPlanBundle {
  plans: ReconciliationPlan[];
  recommended_plan_id: string | null;
  intent: ReconciliationIntent;
  applied_preferences: PlanPreferences | null;
  journey_entry: JourneyEntry;
  version_summary: VersionSummary;
}

function toPlanBundle(
  payload: ApiResponse<ReconciliationPlanBundle> | undefined,
): ReconciliationPlanBundle {
  const data = payload?.data;
  return {
    plans: Array.isArray(data?.plans) ? data.plans : [],
    recommended_plan_id: data?.recommended_plan_id ?? null,
    intent: (data?.intent as ReconciliationIntent | undefined) ?? 'repair',
    applied_preferences: data?.applied_preferences ?? null,
    journey_entry: data?.journey_entry ?? {
      status: 'none',
      track_id: null,
      active_plan_id: null,
      recommended_action: 'generate_bundle',
      last_pulse: null,
      has_superseded_versions: false,
    },
    version_summary: data?.version_summary ?? {
      version_group_id: null,
      has_superseded_versions: false,
      superseded_versions_count: 0,
    },
  };
}

/**
 * 生成和好方案
 */
export const generatePlans = async (
  judgmentId: string,
  input?: {
    intent?: ReconciliationIntent;
    preferences?: PlanPreferences;
    force_regenerate?: boolean;
  },
): Promise<ReconciliationPlanBundle> => {
  const response = await request.post<ApiResponse<ReconciliationPlanBundle>>(
    `/judgments/${judgmentId}/reconciliation-plans`,
    input || {},
  );
  return toPlanBundle(response.data as ApiResponse<ReconciliationPlanBundle>);
};

/**
 * 獲取和好方案列表
 */
export const getPlans = async (
  judgmentId: string,
  filters?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    type?: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
    intent?: ReconciliationIntent;
  },
): Promise<ReconciliationPlanBundle> => {
  const params = new URLSearchParams();
  if (filters?.difficulty) params.append('difficulty', filters.difficulty);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.intent) params.append('intent', filters.intent);

  const queryString = params.toString();
  const url = `/judgments/${judgmentId}/reconciliation-plans${queryString ? `?${queryString}` : ''}`;

  const response = await request.get<ApiResponse<ReconciliationPlanBundle>>(url);
  return toPlanBundle(response.data as ApiResponse<ReconciliationPlanBundle>);
};

/**
 * 獲取和好方案詳情
 */
export const getPlanById = async (
  planId: string,
): Promise<ReconciliationPlan & {
  judgment: { case_id: string };
  viewer_role?: 'initiator' | 'invitee' | 'solo';
  invite_context?: PlanInviteContext;
  cta_state?: PlanCtaState;
  track_history_summary?: TrackHistorySummary;
}> => {
  const response = await request.get<ApiResponse<{ plan: ReconciliationPlan & {
    judgment: { case_id: string };
    viewer_role?: 'initiator' | 'invitee' | 'solo';
    invite_context?: PlanInviteContext;
    cta_state?: PlanCtaState;
    track_history_summary?: TrackHistorySummary;
  } }>>(
    `/reconciliation-plans/${planId}`,
  );
  const result = (response.data as ApiResponse<{ plan: ReconciliationPlan & {
    judgment: { case_id: string };
    viewer_role?: 'initiator' | 'invitee' | 'solo';
    invite_context?: PlanInviteContext;
    cta_state?: PlanCtaState;
    track_history_summary?: TrackHistorySummary;
  } }>)?.data?.plan;
  if (!result) throw new Error('Invalid plan response from server');
  return result;
};

/**
 * 承諾此方案
 */
export const selectPlan = async (planId: string): Promise<ReconciliationPlan> => {
  const response = await request.post<ApiResponse<{ plan: ReconciliationPlan }>>(
    `/reconciliation-plans/${planId}/select`,
  );
  const result = (response.data as ApiResponse<{ plan: ReconciliationPlan }>)?.data?.plan;
  if (!result) throw new Error('Invalid plan response from server');
  return result;
};

export const getCommitment = async (planId: string): Promise<CommitmentSummary> => {
  const response = await request.get<ApiResponse<{ commitment: CommitmentSummary }>>(
    `/reconciliation-plans/${planId}/commitment`,
  );
  const result = (response.data as ApiResponse<{ commitment: CommitmentSummary }>)?.data?.commitment;
  if (!result) throw new Error('Invalid commitment response from server');
  return result;
};

export const invitePartner = async (
  planId: string,
): Promise<{ track_id: string; partner_id: string | null; invited_at: string; status: string }> => {
  const response = await request.post<ApiResponse<{ invitation: { track_id: string; partner_id: string | null; invited_at: string; status: string } }>>(
    `/reconciliation-plans/${planId}/invite`,
  );
  const result = (response.data as ApiResponse<{ invitation: { track_id: string; partner_id: string | null; invited_at: string; status: string } }>)?.data?.invitation;
  if (!result) throw new Error('Invalid invite response from server');
  return result;
};

export const pausePlan = async (planId: string): Promise<CommitmentSummary> => {
  const response = await request.post<ApiResponse<{ commitment: CommitmentSummary }>>(
    `/reconciliation-plans/${planId}/pause`,
  );
  const result = (response.data as ApiResponse<{ commitment: CommitmentSummary }>)?.data?.commitment;
  if (!result) throw new Error('Invalid pause response from server');
  return result;
};

export const respondPlan = async (
  planId: string,
  action: 'viewed' | 'committed' | 'deferred' | 'declined' | 'paused',
  options?: { reason?: 'need_time' | 'needs_space' | 'unsure' | 'too_much_pressure'; remind_in_hours?: number },
): Promise<ReconciliationPlan> => {
  const response = await request.post<ApiResponse<{ plan: ReconciliationPlan }>>(
    `/reconciliation-plans/${planId}/respond`,
    { action, ...options },
  );
  const result = (response.data as ApiResponse<{ plan: ReconciliationPlan }>)?.data?.plan;
  if (!result) throw new Error('Invalid respond response from server');
  return result;
};
