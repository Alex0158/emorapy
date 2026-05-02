export type PsychDomain = 'attachment' | 'family_origin' | 'life_events' | 'belief_values' | 'cultural_background' | 'education_cognition' | 'personality' | 'relationship_history';
export type InterviewStatus = 'in_progress' | 'processing' | 'completed' | 'processing_failed' | 'abandoned';
export type InterviewTrigger = 'organic' | 'pre_case' | 'post_judgment' | 'onboarding';
export type InsightType = 'trait' | 'pattern' | 'belief' | 'trigger' | 'strength' | 'risk' | 'cultural' | 'developmental';
export declare const RichnessLevel: {
    readonly L0: "L0";
    readonly L1: "L1";
    readonly L2: "L2";
    readonly L3: "L3";
};
export type RichnessLevel = typeof RichnessLevel[keyof typeof RichnessLevel];
export declare const PipelineStep: {
    readonly NOT_STARTED: 0;
    readonly NARRATIVE_EXTRACTION: 1;
    readonly NARRATIVE_SUMMARY: 2;
    readonly INSIGHT_EXTRACTION: 3;
    readonly RICHNESS_CALCULATION: 4;
    readonly FEEDBACK_GENERATION: 5;
    readonly COMPLETED: 6;
};
export type PipelineStep = typeof PipelineStep[keyof typeof PipelineStep];
export interface InterviewTurn {
    id: string;
    turn_order: number;
    ai_message: string;
    ai_intent?: string;
    ai_target_domains?: PsychDomain[];
    extracted_facts?: string[];
    user_response?: string;
    skipped: boolean;
    safety_flag: boolean;
    safety_detail?: string;
    created_at: string;
}
export interface InterviewSession {
    id: string;
    user_id: string;
    status: InterviewStatus;
    trigger: InterviewTrigger;
    ai_model_used?: string;
    total_user_words: number;
    total_ai_words?: number;
    domains_touched: PsychDomain[];
    feedback_card?: string;
    pipeline_step: number;
    partial_success?: boolean;
    started_at?: string;
    ended_at?: string;
    created_at: string;
    updated_at: string;
    turns?: InterviewTurn[];
}
export interface InterviewResumeStatus {
    has_pending: boolean;
    session_id?: string | null;
    last_ai_message?: string | null;
    turn_count?: number;
    has_failed?: boolean;
    failed_session_id?: string | null;
}
export interface ProfileNarrative {
    id: string;
    domain: PsychDomain;
    ai_summary?: string;
    completeness: number;
    word_count: number;
    is_latest: boolean;
}
export interface ProfileInsight {
    id: string;
    domain: PsychDomain;
    insight_type: InsightType;
    key: string;
    value: string;
    confidence: number;
    evidence?: string;
    is_active: boolean;
}
export interface FeedbackCard {
    summary: string;
    domains_explored: string[];
    domains_unexplored: string[];
    key_insights: string[];
    richness_score: number;
    encouragement: string;
    continuation_hint: string;
}
export interface FeedbackHistoryItem {
    session_id: string;
    feedback_card: string | null;
    domains_touched: PsychDomain[];
    created_at: string;
    updated_at: string;
}
export interface PsychProfile {
    consent_given: boolean;
    consent_at?: string | null;
    narratives: ProfileNarrative[];
    insights: ProfileInsight[];
    richness_score: number;
}
export interface InterviewAIResponse {
    text: string;
    intent?: string;
    target_domains?: PsychDomain[];
    should_end?: boolean;
    safety_flag?: boolean;
    safety_message?: string;
    key_facts?: string[];
}
export interface SSETokenEvent {
    text: string;
}
export interface SSEMetadataEvent {
    turn_order: number;
    intent?: string;
    target_domains?: PsychDomain[];
    domains_touched?: PsychDomain[];
    total_turns?: number;
    should_end?: boolean;
}
export interface SSESafetyAlertEvent {
    message: string;
    severity: 'info' | 'warning' | 'critical';
}
export interface SSECompleteEvent {
    session_id: string;
    status: InterviewStatus | string;
    total_turns: number;
    domains_touched: PsychDomain[];
    feedback_card?: string;
}
export interface SSEErrorEvent {
    code: string;
    message: string;
}
//# sourceMappingURL=interview.d.ts.map