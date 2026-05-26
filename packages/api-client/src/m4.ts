import type { Case, CreateCaseDto, UpdateCaseDto } from '@cj/contracts/case';

import {
  isApiResponseEnvelope,
  readApiResponseError,
  toRequestError,
  type ApiResponseEnvelope,
} from './apiResponse.js';
import type { HttpResponse, M1HttpClient } from './m1.js';

export type { Case, CreateCaseDto, UpdateCaseDto } from '@cj/contracts/case';

export interface Pairing {
  id: string;
  user1_id?: string | null;
  user2_id?: string | null;
  invite_code?: string | null;
  status: 'pending' | 'active' | 'cancelled' | 'temp';
  pairing_type: 'normal' | 'quick';
  created_at: string;
  confirmed_at?: string | null;
  expires_at?: string | null;
}

export interface Judgment {
  id: string;
  case_id: string;
  judgment_content: string;
  summary?: string | null;
  plaintiff_ratio: number;
  defendant_ratio: number;
  judgment_route?: 'standard' | 'safety_support' | 'crisis_support';
  ai_model: string;
  prompt_version?: string | null;
  user1_acceptance?: boolean | null;
  user2_acceptance?: boolean | null;
  user1_rating?: number | null;
  user2_rating?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AcceptJudgmentInput {
  accepted: boolean;
  rating?: number;
}

function sessionAwareConfig(sessionId?: string | null, config?: Record<string, unknown>): Record<string, unknown> | undefined {
  const headers = sessionId ? { 'X-Session-Id': sessionId } : undefined;
  if (!headers && !config) return undefined;
  return {
    ...(config ?? {}),
    ...(headers ? { headers } : {}),
  };
}

export interface CaseListResponse {
  cases: Case[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface CaseListParams {
  status?: string;
  type?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
}

export type ReconciliationIntent = 'repair' | 'cool_down' | 'graceful_exit' | 'safety_support';
export type PlanStylePreference = 'action' | 'conversation' | 'companionship' | 'distance';

export interface PlanPreferences {
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: number;
  types?: ('activity' | 'communication' | 'intimacy' | 'gift' | 'service')[];
  pressure_level?: 'low' | 'medium' | 'high';
  pace?: 'today' | 'this_week' | 'ease_in';
  style?: PlanStylePreference[];
  invite_partner?: boolean;
}

export interface CommitmentSummary {
  track_id: string | null;
  track_status: string;
  recommended_mode: 'solo' | 'co';
  invited_partner_at: string | null;
  is_dual_committed: boolean;
  current_user: Record<string, unknown>;
  partner: Record<string, unknown> | null;
}

export interface ReconciliationPlan {
  id: string;
  judgment_id: string;
  intent: ReconciliationIntent;
  plan_content: string;
  plan_type: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
  difficulty_level: 'easy' | 'medium' | 'hard';
  estimated_duration?: number | null;
  time_cost: number;
  money_cost: number;
  emotion_cost: number;
  skill_requirement: number;
  user1_selected: boolean;
  user2_selected: boolean;
  created_at: string;
  fit_reason?: string | null;
  first_step?: string | null;
  fallback_step?: string | null;
  pause_rule?: string | null;
  is_recommended?: boolean;
  commitment?: CommitmentSummary;
  judgment?: { case_id: string };
}

export interface ReconciliationPlanBundle {
  plans: ReconciliationPlan[];
  recommended_plan_id: string | null;
  intent: ReconciliationIntent;
  applied_preferences: PlanPreferences | null;
  journey_entry: {
    status: string;
    track_id: string | null;
    active_plan_id: string | null;
    recommended_action: string;
    last_pulse: unknown | null;
    has_superseded_versions: boolean;
  };
  version_summary: {
    version_group_id: string | null;
    has_superseded_versions: boolean;
    superseded_versions_count: number;
  };
}

export interface ExecutionRecord {
  id: string;
  reconciliation_plan_id: string;
  user_id: string;
  action: 'confirm' | 'checkin' | 'complete' | 'skip';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  notes?: string | null;
  photos_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionStatus {
  track_id?: string | null;
  plan_id: string;
  judgment_id?: string | null;
  status: string;
  journey_status: string;
  relationship_mode: 'solo' | 'co';
  records: ExecutionRecord[];
  recent_checkins: unknown[];
  progress: number;
  plan_summary?: {
    title: string;
    plan_type: string;
    difficulty_level: string;
    first_step?: string | null;
  };
  current_step?: {
    step_index: number;
    title: string;
    content: string;
    fallback_content?: string | null;
  };
  primary_cta?: string;
  secondary_cta?: string | null;
}

export interface CheckinInput {
  plan_id: string;
  notes?: string;
  photos?: string[];
  step_result?: 'done' | 'partial' | 'skipped';
  closeness?: 'closer' | 'same' | 'farther';
  stress?: 'low' | 'medium' | 'high';
  needs_help?: boolean;
}

export interface ReplanTrackInput {
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

function unwrapResponse<T>(
  response: HttpResponse<ApiResponseEnvelope<T>>,
  fallbackMessage: string
): T {
  const body = response.data;
  if (!isApiResponseEnvelope(body)) {
    return body as T;
  }

  if (body.success) {
    if (body.data !== undefined && body.data !== null) return body.data as T;
    throw toRequestError('EMPTY_RESPONSE', fallbackMessage);
  }

  const bodyError = readApiResponseError(body);
  throw toRequestError(
    bodyError.code ?? 'API_ERROR',
    bodyError.message ?? fallbackMessage,
    bodyError.details
  );
}

function ensureValue<T>(value: T | null | undefined, code: string, message: string): T {
  if (value === undefined || value === null) {
    throw toRequestError(code, message);
  }
  return value;
}

function normalizeCaseList(result: CaseListResponse | null | undefined): CaseListResponse {
  return {
    cases: Array.isArray(result?.cases) ? result.cases : [],
    pagination: {
      page: result?.pagination?.page ?? 1,
      page_size: result?.pagination?.page_size ?? 10,
      total: result?.pagination?.total ?? 0,
      total_pages: result?.pagination?.total_pages ?? 0,
    },
  };
}

function normalizePlanBundle(result: ReconciliationPlanBundle | null | undefined): ReconciliationPlanBundle {
  return {
    plans: Array.isArray(result?.plans) ? result.plans : [],
    recommended_plan_id: result?.recommended_plan_id ?? null,
    intent: result?.intent ?? 'repair',
    applied_preferences: result?.applied_preferences ?? null,
    journey_entry: result?.journey_entry ?? {
      status: 'none',
      track_id: null,
      active_plan_id: null,
      recommended_action: 'generate_bundle',
      last_pulse: null,
      has_superseded_versions: false,
    },
    version_summary: result?.version_summary ?? {
      version_group_id: null,
      has_superseded_versions: false,
      superseded_versions_count: 0,
    },
  };
}

function normalizeExecutionStatus(status: ExecutionStatus): ExecutionStatus {
  return {
    ...status,
    records: Array.isArray(status.records) ? status.records : [],
    recent_checkins: Array.isArray(status.recent_checkins) ? status.recent_checkins : [],
  };
}

export function createPairingApi(http: M1HttpClient) {
  return {
    async create(): Promise<Pairing> {
      const response = await http.post<ApiResponseEnvelope<{ pairing: Pairing }>>('/pairing/create');
      const data = unwrapResponse(response, 'Invalid pairing response from server');
      return ensureValue(data.pairing, 'INVALID_PAIRING_RESPONSE', 'Invalid pairing response from server');
    },

    async join(inviteCode: string): Promise<Pairing> {
      const response = await http.post<ApiResponseEnvelope<{ pairing: Pairing }>>('/pairing/join', {
        invite_code: inviteCode,
      });
      const data = unwrapResponse(response, 'Invalid pairing response from server');
      return ensureValue(data.pairing, 'INVALID_PAIRING_RESPONSE', 'Invalid pairing response from server');
    },

    async getStatus(): Promise<Pairing | null> {
      try {
        const response = await http.get<ApiResponseEnvelope<{ pairing: Pairing | null }>>('/pairing/status');
        const data = unwrapResponse(response, 'Invalid pairing response from server');
        return data.pairing ?? null;
      } catch (error) {
        const requestError = error as { code?: string };
        if (requestError.code === 'NOT_FOUND' || requestError.code === 'HTTP_404') return null;
        throw error;
      }
    },

    async cancel(): Promise<Pairing> {
      const response = await http.post<ApiResponseEnvelope<{ pairing: Pairing }>>('/pairing/cancel');
      const data = unwrapResponse(response, 'Invalid pairing response from server');
      return ensureValue(data.pairing, 'INVALID_PAIRING_RESPONSE', 'Invalid pairing response from server');
    },
  };
}

export function createFormalCaseApi(http: M1HttpClient) {
  return {
    async create(input: CreateCaseDto): Promise<Case> {
      const response = await http.post<ApiResponseEnvelope<{ case: Case }>>('/cases', input);
      const data = unwrapResponse(response, 'Invalid case response from server');
      return ensureValue(data.case, 'INVALID_CASE_RESPONSE', 'Invalid case response from server');
    },

    async list(params?: CaseListParams): Promise<CaseListResponse> {
      const response = await http.get<ApiResponseEnvelope<CaseListResponse>>('/cases', { params });
      const data = unwrapResponse(response, 'Invalid case list response from server');
      return normalizeCaseList(data);
    },

    async get(caseId: string): Promise<Case> {
      const response = await http.get<ApiResponseEnvelope<{ case: Case }>>(`/cases/${encodeURIComponent(caseId)}`);
      const data = unwrapResponse(response, 'Invalid case response from server');
      return ensureValue(data.case, 'INVALID_CASE_RESPONSE', 'Invalid case response from server');
    },

    async update(caseId: string, input: UpdateCaseDto): Promise<Case> {
      const response = await http.put<ApiResponseEnvelope<{ case: Case }>>(
        `/cases/${encodeURIComponent(caseId)}`,
        input
      );
      const data = unwrapResponse(response, 'Invalid case response from server');
      return ensureValue(data.case, 'INVALID_CASE_RESPONSE', 'Invalid case response from server');
    },

    async submit(caseId: string): Promise<Case> {
      const response = await http.post<ApiResponseEnvelope<{ case: Case }>>(`/cases/${encodeURIComponent(caseId)}/submit`);
      const data = unwrapResponse(response, 'Invalid case response from server');
      return ensureValue(data.case, 'INVALID_CASE_RESPONSE', 'Invalid case response from server');
    },
  };
}

export function createJudgmentApi(http: M1HttpClient) {
  return {
    async generate(caseId: string, sessionId?: string | null): Promise<Judgment> {
      const response = await http.post<ApiResponseEnvelope<{ judgment: Judgment }>>(
        `/judgments/generate/${encodeURIComponent(caseId)}`,
        undefined,
        sessionAwareConfig(sessionId)
      );
      const data = unwrapResponse(response, 'Invalid judgment response from server');
      return ensureValue(data.judgment, 'INVALID_JUDGMENT_RESPONSE', 'Invalid judgment response from server');
    },

    async get(judgmentId: string): Promise<Judgment> {
      const response = await http.get<ApiResponseEnvelope<{ judgment: Judgment }>>(
        `/judgments/${encodeURIComponent(judgmentId)}`
      );
      const data = unwrapResponse(response, 'Invalid judgment response from server');
      return ensureValue(data.judgment, 'INVALID_JUDGMENT_RESPONSE', 'Invalid judgment response from server');
    },

    async getByCaseId(caseId: string, sessionId?: string | null): Promise<Judgment | null> {
      try {
        const response = await http.get<ApiResponseEnvelope<{ judgment: Judgment | null }>>(
          `/cases/${encodeURIComponent(caseId)}/judgment`,
          sessionAwareConfig(sessionId, { metadata: { suppressGlobalSessionToast: true } })
        );
        const data = unwrapResponse(response, 'Invalid judgment response from server');
        return data.judgment ?? null;
      } catch (error) {
        const requestError = error as { code?: string };
        if (
          requestError.code === 'JUDGMENT_PENDING' ||
          requestError.code === 'JUDGMENT_NOT_FOUND' ||
          requestError.code === 'HTTP_404'
        ) {
          return null;
        }
        throw error;
      }
    },

    async accept(judgmentId: string, input: AcceptJudgmentInput): Promise<Judgment> {
      const response = await http.post<ApiResponseEnvelope<{ judgment: Judgment }>>(
        `/judgments/${encodeURIComponent(judgmentId)}/accept`,
        input
      );
      const data = unwrapResponse(response, 'Invalid judgment response from server');
      return ensureValue(data.judgment, 'INVALID_JUDGMENT_RESPONSE', 'Invalid judgment response from server');
    },
  };
}

export function createReconciliationApi(http: M1HttpClient) {
  return {
    async generatePlans(
      judgmentId: string,
      input: { intent?: ReconciliationIntent; preferences?: PlanPreferences; force_regenerate?: boolean } = {}
    ): Promise<ReconciliationPlanBundle> {
      const response = await http.post<ApiResponseEnvelope<ReconciliationPlanBundle>>(
        `/judgments/${encodeURIComponent(judgmentId)}/reconciliation-plans`,
        input
      );
      return normalizePlanBundle(unwrapResponse(response, 'Invalid reconciliation plans response from server'));
    },

    async getPlans(judgmentId: string, filters: { difficulty?: string; type?: string; intent?: ReconciliationIntent } = {}): Promise<ReconciliationPlanBundle> {
      const params = new URLSearchParams();
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.type) params.set('type', filters.type);
      if (filters.intent) params.set('intent', filters.intent);
      const query = params.toString();
      const response = await http.get<ApiResponseEnvelope<ReconciliationPlanBundle>>(
        `/judgments/${encodeURIComponent(judgmentId)}/reconciliation-plans${query ? `?${query}` : ''}`
      );
      return normalizePlanBundle(unwrapResponse(response, 'Invalid reconciliation plans response from server'));
    },

    async getPlan(planId: string): Promise<ReconciliationPlan> {
      const response = await http.get<ApiResponseEnvelope<{ plan: ReconciliationPlan }>>(
        `/reconciliation-plans/${encodeURIComponent(planId)}`
      );
      const data = unwrapResponse(response, 'Invalid plan response from server');
      return ensureValue(data.plan, 'INVALID_PLAN_RESPONSE', 'Invalid plan response from server');
    },

    async selectPlan(planId: string): Promise<ReconciliationPlan> {
      const response = await http.post<ApiResponseEnvelope<{ plan: ReconciliationPlan }>>(
        `/reconciliation-plans/${encodeURIComponent(planId)}/select`
      );
      const data = unwrapResponse(response, 'Invalid plan response from server');
      return ensureValue(data.plan, 'INVALID_PLAN_RESPONSE', 'Invalid plan response from server');
    },

    async getCommitment(planId: string): Promise<CommitmentSummary> {
      const response = await http.get<ApiResponseEnvelope<{ commitment: CommitmentSummary }>>(
        `/reconciliation-plans/${encodeURIComponent(planId)}/commitment`
      );
      const data = unwrapResponse(response, 'Invalid commitment response from server');
      return ensureValue(data.commitment, 'INVALID_COMMITMENT_RESPONSE', 'Invalid commitment response from server');
    },

    async invitePartner(planId: string): Promise<{ track_id: string; partner_id: string | null; invited_at: string; status: string }> {
      const response = await http.post<ApiResponseEnvelope<{ invitation: { track_id: string; partner_id: string | null; invited_at: string; status: string } }>>(
        `/reconciliation-plans/${encodeURIComponent(planId)}/invite`
      );
      const data = unwrapResponse(response, 'Invalid invite response from server');
      return ensureValue(data.invitation, 'INVALID_INVITE_RESPONSE', 'Invalid invite response from server');
    },

    async pausePlan(planId: string): Promise<CommitmentSummary> {
      const response = await http.post<ApiResponseEnvelope<{ commitment: CommitmentSummary }>>(
        `/reconciliation-plans/${encodeURIComponent(planId)}/pause`
      );
      const data = unwrapResponse(response, 'Invalid pause response from server');
      return ensureValue(data.commitment, 'INVALID_PAUSE_RESPONSE', 'Invalid pause response from server');
    },

    async respondPlan(
      planId: string,
      action: 'viewed' | 'committed' | 'deferred' | 'declined' | 'paused',
      options: { reason?: string; remind_in_hours?: number } = {}
    ): Promise<ReconciliationPlan> {
      const response = await http.post<ApiResponseEnvelope<{ plan: ReconciliationPlan }>>(
        `/reconciliation-plans/${encodeURIComponent(planId)}/respond`,
        { action, ...options }
      );
      const data = unwrapResponse(response, 'Invalid respond response from server');
      return ensureValue(data.plan, 'INVALID_RESPOND_RESPONSE', 'Invalid respond response from server');
    },
  };
}

export function createExecutionApi(http: M1HttpClient) {
  return {
    async confirm(planId: string): Promise<ExecutionRecord> {
      const response = await http.post<ApiResponseEnvelope<{ execution: ExecutionRecord }>>('/execution/confirm', {
        plan_id: planId,
      });
      const data = unwrapResponse(response, 'Invalid execution response from server');
      return ensureValue(data.execution, 'INVALID_EXECUTION_RESPONSE', 'Invalid execution response from server');
    },

    async checkin(input: CheckinInput): Promise<ExecutionRecord> {
      const response = await http.post<ApiResponseEnvelope<{ execution: ExecutionRecord }>>('/execution/checkin', input);
      const data = unwrapResponse(response, 'Invalid execution response from server');
      return ensureValue(data.execution, 'INVALID_EXECUTION_RESPONSE', 'Invalid execution response from server');
    },

    async getStatus(planId: string): Promise<ExecutionStatus> {
      const response = await http.get<ApiResponseEnvelope<ExecutionStatus>>('/execution/status', {
        params: { plan_id: planId },
      });
      return normalizeExecutionStatus(unwrapResponse(response, 'Invalid execution status response from server'));
    },

    async getDashboard(): Promise<ExecutionStatus[]> {
      const response = await http.get<ApiResponseEnvelope<{ executions: ExecutionStatus[] }>>('/execution/dashboard');
      const data = unwrapResponse(response, 'Invalid execution dashboard response from server');
      return Array.isArray(data.executions) ? data.executions.map(normalizeExecutionStatus) : [];
    },

    async replanTrack(trackId: string, input: ReplanTrackInput): Promise<ReplanTrackAccepted> {
      const response = await http.post<ApiResponseEnvelope<{ track: ReplanTrackAccepted }>>(
        `/repair-tracks/${encodeURIComponent(trackId)}/replan`,
        input
      );
      const data = unwrapResponse(response, 'Invalid replan response from server');
      return ensureValue(data.track, 'INVALID_REPLAN_RESPONSE', 'Invalid replan response from server');
    },

    async resumeTrack(trackId: string): Promise<{ track_id: string; plan_id: string; status: string }> {
      const response = await http.post<ApiResponseEnvelope<{ track: { track_id: string; plan_id: string; status: string } }>>(
        `/repair-tracks/${encodeURIComponent(trackId)}/resume`
      );
      const data = unwrapResponse(response, 'Invalid resume response from server');
      return ensureValue(data.track, 'INVALID_RESUME_RESPONSE', 'Invalid resume response from server');
    },
  };
}

export function createM4ApiClient(http: M1HttpClient) {
  return {
    cases: createFormalCaseApi(http),
    execution: createExecutionApi(http),
    judgment: createJudgmentApi(http),
    pairing: createPairingApi(http),
    reconciliation: createReconciliationApi(http),
  };
}
