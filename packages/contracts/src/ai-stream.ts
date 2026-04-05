export type AIStreamScopeType =
  | 'interview_session'
  | 'chat_room'
  | 'case_judgment'
  | 'judgment_detail'
  | 'repair_track'
  | 'generic_ai_task';

export type AIStreamEventType =
  | 'stream.created'
  | 'stream.queued'
  | 'stream.started'
  | 'stream.delta'
  | 'stream.phase'
  | 'stream.completed'
  | 'stream.persisted'
  | 'stream.failed'
  | 'stream.cancelled'
  | 'stream.heartbeat';

export type AIStreamStatus =
  | 'created'
  | 'queued'
  | 'started'
  | 'streaming'
  | 'completed'
  | 'persisted'
  | 'failed'
  | 'cancelled';

export type AIStreamPhase =
  | 'thinking'
  | 'collecting_context'
  | 'analyzing_recent_pulse'
  | 'analyzing_emotion'
  | 'building_responsibility'
  | 'drafting_judgment'
  | 'drafting_adjustment'
  | 'finalizing'
  | 'finalizing_plan'
  | 'safety_alert'
  | 'completed'
  | (string & {});

export interface AIStreamErrorPayload {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface AIStreamEvent {
  eventType: AIStreamEventType;
  streamId: string;
  requestId: string;
  scopeType: AIStreamScopeType;
  scopeId: string;
  seq: number;
  createdAt: string;
  actorRole?: string;
  phase?: AIStreamPhase;
  messageId?: string;
  deltaText?: string;
  fullText?: string;
  metadata?: Record<string, unknown>;
  error?: AIStreamErrorPayload;
}

export interface AIStreamSnapshot {
  streamId: string;
  requestId: string;
  scopeType: AIStreamScopeType;
  scopeId: string;
  status: AIStreamStatus;
  lastSeq: number;
  text: string;
  phase?: AIStreamPhase;
  messageId?: string;
  metadata?: Record<string, unknown>;
  error?: AIStreamErrorPayload;
  updatedAt: string;
}
