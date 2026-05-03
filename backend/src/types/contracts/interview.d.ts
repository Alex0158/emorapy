export interface InterviewResumeStatus {
  has_pending: boolean;
  session_id?: string | null;
  last_ai_message?: string | null;
  turn_count?: number;
  has_failed?: boolean;
  failed_session_id?: string | null;
}
