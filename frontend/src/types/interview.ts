import { t } from '@/utils/i18n';

export type PsychDomain =
  | 'attachment'
  | 'family_origin'
  | 'life_events'
  | 'belief_values'
  | 'cultural_background'
  | 'education_cognition'
  | 'personality'
  | 'relationship_history';

export type InterviewStatus =
  | 'in_progress'
  | 'processing'
  | 'completed'
  | 'processing_failed'
  | 'abandoned';
export type InterviewTrigger =
  | 'organic'
  | 'pre_case'
  | 'post_judgment'
  | 'onboarding';
export type InsightType =
  | 'trait'
  | 'pattern'
  | 'belief'
  | 'trigger'
  | 'strength'
  | 'risk'
  | 'cultural'
  | 'developmental';

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
  /** Backend returns this when AI flags safety concern; frontend may display it */
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

export function getDomainLabel(domain: PsychDomain): string {
  return t(`psychProfile.domain.${domain}`);
}
