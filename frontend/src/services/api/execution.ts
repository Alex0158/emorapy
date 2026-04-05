/**
 * 修復旅程 / 執行 API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { CommitmentSummary } from './reconciliation';
import type { RepairJourneyContext, RepairJourneyPresentationBucket } from '@/types/repairJourney';

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
  const response = await request.post<ApiResponse<{ execution: ExecutionRecord }>>(
    '/execution/confirm',
    { plan_id: planId },
  );
  const result = (response.data as ApiResponse<{ execution: ExecutionRecord }>)?.data?.execution;
  if (!result) throw new Error('Invalid execution response from server');
  return result;
};

/**
 * 記下今天的一小步
 */
export const checkin = async (data: CheckinDto): Promise<ExecutionRecord> => {
  const response = await request.post<ApiResponse<{ execution: ExecutionRecord }>>(
    '/execution/checkin',
    data,
  );
  const result = (response.data as ApiResponse<{ execution: ExecutionRecord }>)?.data?.execution;
  if (!result) throw new Error('Invalid execution response from server');
  return result;
};

/**
 * 獲取修復旅程狀態
 */
export const getExecutionStatus = async (planId: string): Promise<ExecutionStatus> => {
  const response = await request.get<ApiResponse<ExecutionStatus>>(
    '/execution/status',
    { params: { plan_id: planId } },
  );
  const result = (response.data as ApiResponse<ExecutionStatus>)?.data;
  if (!result) throw new Error('Invalid execution status response from server');
  return {
    ...result,
    records: Array.isArray(result.records) ? result.records : [],
    recent_checkins: Array.isArray(result.recent_checkins) ? result.recent_checkins : [],
  };
};

/**
 * 獲取所有修復旅程狀態（用於旅程看板）
 */
export const getAllExecutionStatuses = async (): Promise<ExecutionStatus[]> => {
  const response = await request.get<ApiResponse<{ executions: ExecutionStatus[] }>>(
    '/execution/dashboard',
  );
  const executions = (response.data as ApiResponse<{ executions: ExecutionStatus[] }>)?.data?.executions;
  const list = Array.isArray(executions) ? executions : [];
  return list.map((item) => ({
    ...item,
    records: Array.isArray(item.records) ? item.records : [],
    recent_checkins: Array.isArray(item.recent_checkins) ? item.recent_checkins : [],
  }));
};

export const replanTrack = async (
  trackId: string,
  data: ReplanTrackDto,
): Promise<ReplanTrackAccepted> => {
  const response = await request.post<ApiResponse<{ track: ReplanTrackAccepted }>>(
    `/repair-tracks/${trackId}/replan`,
    data,
  );
  const result = (response.data as ApiResponse<{ track: ReplanTrackAccepted }>)?.data?.track;
  if (!result) throw new Error('Invalid replan response from server');
  return result;
};

export const resumeTrack = async (
  trackId: string,
): Promise<{ track_id: string; plan_id: string; status: string }> => {
  const response = await request.post<ApiResponse<{ track: { track_id: string; plan_id: string; status: string } }>>(
    `/repair-tracks/${trackId}/resume`,
  );
  const result = (response.data as ApiResponse<{ track: { track_id: string; plan_id: string; status: string } }>)?.data?.track;
  if (!result) throw new Error('Invalid resume response from server');
  return result;
};
