import type { Case, CreateCaseDto, UpdateCaseDto } from '@emorapy/contracts/case';
import type { M1HttpClient } from './m1.js';
export type { Case, CreateCaseDto, UpdateCaseDto } from '@emorapy/contracts/case';
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
    judgment?: {
        case_id: string;
    };
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
export declare function createPairingApi(http: M1HttpClient): {
    create(): Promise<Pairing>;
    join(inviteCode: string): Promise<Pairing>;
    getStatus(): Promise<Pairing | null>;
    cancel(): Promise<Pairing>;
};
export declare function createFormalCaseApi(http: M1HttpClient): {
    create(input: CreateCaseDto): Promise<Case>;
    list(params?: CaseListParams): Promise<CaseListResponse>;
    get(caseId: string): Promise<Case>;
    update(caseId: string, input: UpdateCaseDto): Promise<Case>;
    submit(caseId: string): Promise<Case>;
};
export declare function createJudgmentApi(http: M1HttpClient): {
    generate(caseId: string, sessionId?: string | null): Promise<Judgment>;
    get(judgmentId: string): Promise<Judgment>;
    getByCaseId(caseId: string, sessionId?: string | null): Promise<Judgment | null>;
    accept(judgmentId: string, input: AcceptJudgmentInput): Promise<Judgment>;
};
export declare function createReconciliationApi(http: M1HttpClient): {
    generatePlans(judgmentId: string, input?: {
        intent?: ReconciliationIntent;
        preferences?: PlanPreferences;
        force_regenerate?: boolean;
    }): Promise<ReconciliationPlanBundle>;
    getPlans(judgmentId: string, filters?: {
        difficulty?: string;
        type?: string;
        intent?: ReconciliationIntent;
    }): Promise<ReconciliationPlanBundle>;
    getPlan(planId: string): Promise<ReconciliationPlan>;
    selectPlan(planId: string): Promise<ReconciliationPlan>;
    getCommitment(planId: string): Promise<CommitmentSummary>;
    invitePartner(planId: string): Promise<{
        track_id: string;
        partner_id: string | null;
        invited_at: string;
        status: string;
    }>;
    pausePlan(planId: string): Promise<CommitmentSummary>;
    respondPlan(planId: string, action: "viewed" | "committed" | "deferred" | "declined" | "paused", options?: {
        reason?: string;
        remind_in_hours?: number;
    }): Promise<ReconciliationPlan>;
};
export declare function createExecutionApi(http: M1HttpClient): {
    confirm(planId: string): Promise<ExecutionRecord>;
    checkin(input: CheckinInput): Promise<ExecutionRecord>;
    getStatus(planId: string): Promise<ExecutionStatus>;
    getDashboard(): Promise<ExecutionStatus[]>;
    replanTrack(trackId: string, input: ReplanTrackInput): Promise<ReplanTrackAccepted>;
    resumeTrack(trackId: string): Promise<{
        track_id: string;
        plan_id: string;
        status: string;
    }>;
};
export declare function createM4ApiClient(http: M1HttpClient): {
    cases: {
        create(input: CreateCaseDto): Promise<Case>;
        list(params?: CaseListParams): Promise<CaseListResponse>;
        get(caseId: string): Promise<Case>;
        update(caseId: string, input: UpdateCaseDto): Promise<Case>;
        submit(caseId: string): Promise<Case>;
    };
    execution: {
        confirm(planId: string): Promise<ExecutionRecord>;
        checkin(input: CheckinInput): Promise<ExecutionRecord>;
        getStatus(planId: string): Promise<ExecutionStatus>;
        getDashboard(): Promise<ExecutionStatus[]>;
        replanTrack(trackId: string, input: ReplanTrackInput): Promise<ReplanTrackAccepted>;
        resumeTrack(trackId: string): Promise<{
            track_id: string;
            plan_id: string;
            status: string;
        }>;
    };
    judgment: {
        generate(caseId: string, sessionId?: string | null): Promise<Judgment>;
        get(judgmentId: string): Promise<Judgment>;
        getByCaseId(caseId: string, sessionId?: string | null): Promise<Judgment | null>;
        accept(judgmentId: string, input: AcceptJudgmentInput): Promise<Judgment>;
    };
    pairing: {
        create(): Promise<Pairing>;
        join(inviteCode: string): Promise<Pairing>;
        getStatus(): Promise<Pairing | null>;
        cancel(): Promise<Pairing>;
    };
    reconciliation: {
        generatePlans(judgmentId: string, input?: {
            intent?: ReconciliationIntent;
            preferences?: PlanPreferences;
            force_regenerate?: boolean;
        }): Promise<ReconciliationPlanBundle>;
        getPlans(judgmentId: string, filters?: {
            difficulty?: string;
            type?: string;
            intent?: ReconciliationIntent;
        }): Promise<ReconciliationPlanBundle>;
        getPlan(planId: string): Promise<ReconciliationPlan>;
        selectPlan(planId: string): Promise<ReconciliationPlan>;
        getCommitment(planId: string): Promise<CommitmentSummary>;
        invitePartner(planId: string): Promise<{
            track_id: string;
            partner_id: string | null;
            invited_at: string;
            status: string;
        }>;
        pausePlan(planId: string): Promise<CommitmentSummary>;
        respondPlan(planId: string, action: "viewed" | "committed" | "deferred" | "declined" | "paused", options?: {
            reason?: string;
            remind_in_hours?: number;
        }): Promise<ReconciliationPlan>;
    };
};
//# sourceMappingURL=m4.d.ts.map