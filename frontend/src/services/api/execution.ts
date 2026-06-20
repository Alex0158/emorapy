/**
 * 修復旅程 / 執行 API
 */

import { createM4ApiClient } from '@emorapy/api-client';
import request from '../request';
import type { CommitmentSummary } from './reconciliation';
import type { RepairJourneyContext, RepairJourneyPresentationBucket } from '@/types/repairJourney';

const sharedExecutionApi = createM4ApiClient(request).execution;

export interface ExecutionRecord {
  id: string;
  reconciliation_plan_id: string;
  user_id: string;
  action: 'confirm' | 'checkin' | 'complete' | 'skip';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  notes?: string;
  photos_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface RepairCheckIn {
  id: string;
  step_index: number;
  result: 'done' | 'partial' | 'skipped';
  closeness: 'closer' | 'same' | 'farther';
  stress: 'low' | 'medium' | 'high';
  needs_help: boolean;
  notes?: string;
  photos_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface PlanSummary {
  title: string;
  plan_type: string;
  difficulty_level: string;
  estimated_duration?: number;
  fit_reason?: string;
  first_step?: string;
  pause_rule?: string;
}

export interface CurrentRepairStep {
  step_index: number;
  title: string;
  content: string;
  fallback_content?: string;
  pause_rule?: string;
}

export interface PulseSummary {
  closeness: 'closer' | 'same' | 'farther';
  stress: 'low' | 'medium' | 'high';
  needs_replan: boolean;
  needs_help: boolean;
}

export interface ExecutionStatus {
  track_id?: string | null;
  plan_id: string;
  judgment_id?: string;
  replan_state?: string | null;
  active_replan_stream_id?: string | null;
  latest_plan_version?: string | null;
  superseded_plan_id?: string | null;
  status: string;
  journey_status: string;
  relationship_mode: 'solo' | 'co';
  records: ExecutionRecord[];
  recent_checkins: RepairCheckIn[];
  progress: number;
  plan_summary?: PlanSummary;
  commitment?: CommitmentSummary;
  current_step?: CurrentRepairStep;
  pulse_summary?: PulseSummary;
  primary_cta?: string;
  secondary_cta?: string | null;
  presentation_bucket?: RepairJourneyPresentationBucket;
  journey_context?: RepairJourneyContext;
  last_activity_at?: string | null;
  status_reason?: string | null;
  replan_recommendation?: string | null;
}

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

/**
 * 開始今天的第一步
 */
export const confirmExecution = async (planId: string): Promise<ExecutionRecord> => {
  return sharedExecutionApi.confirm(planId) as Promise<ExecutionRecord>;
};

/**
 * 記下今天的一小步
 */
export const checkin = async (data: CheckinDto): Promise<ExecutionRecord> => {
  return sharedExecutionApi.checkin(data) as Promise<ExecutionRecord>;
};

/**
 * 獲取修復旅程狀態
 */
export const getExecutionStatus = async (planId: string): Promise<ExecutionStatus> => {
  return sharedExecutionApi.getStatus(planId) as Promise<ExecutionStatus>;
};

/**
 * 獲取所有修復旅程狀態（用於旅程看板）
 */
export const getAllExecutionStatuses = async (): Promise<ExecutionStatus[]> => {
  return sharedExecutionApi.getDashboard() as Promise<ExecutionStatus[]>;
};

export const replanTrack = async (
  trackId: string,
  data: ReplanTrackDto,
): Promise<ReplanTrackAccepted> => {
  return sharedExecutionApi.replanTrack(trackId, data) as Promise<ReplanTrackAccepted>;
};

export const resumeTrack = async (
  trackId: string,
): Promise<{ track_id: string; plan_id: string; status: string }> => {
  return sharedExecutionApi.resumeTrack(trackId);
};
