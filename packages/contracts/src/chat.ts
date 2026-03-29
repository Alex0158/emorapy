export type ChatRoomStatus =
  | 'solo_active'
  | 'invite_pending'
  | 'invite_accepted'
  | 'group_active'
  | 'judgment_requested'
  | 'judgment_completed'
  | 'judgment_failed'
  | 'archived';

export type ChatHistoryVisibilityMode =
  | 'share_full_history'
  | 'share_summary_only'
  | 'share_from_join_time';

export type ChatRoleInRoom = 'roleA' | 'roleB' | 'aiMediator' | 'system';

export type ChatMessageType =
  | 'user_text'
  | 'ai_reflection'
  | 'ai_mediation'
  | 'ai_summary'
  | 'system_event'
  | 'safety_notice';

export type ChatVisibilityScope = 'all' | 'owner_only' | 'summary_only';

export type ChatInviteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked';

export type ChatStreamEventType =
  | 'message'
  | 'invite'
  | 'room_status'
  | 'ready'
  | 'ping'
  | 'system'
  | 'ai_start'
  | 'ai_token'
  | 'ai_end';

export interface ChatParticipant {
  id: string;
  room_id: string;
  participant_type: 'user' | 'ai' | 'system';
  user_id?: string | null;
  role_in_room: ChatRoleInRoom;
  joined_at: string;
  left_at?: string | null;
  is_active: boolean;
}

export interface ChatRoom {
  id: string;
  status: ChatRoomStatus;
  owner_user_id?: string | null;
  session_id?: string | null;
  history_visibility_mode: ChatHistoryVisibilityMode;
  created_at: string;
  updated_at: string;
  participants: ChatParticipant[];
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_participant_id: string;
  reply_to_message_id?: string | null;
  content: string;
  message_type: ChatMessageType;
  visibility_scope: ChatVisibilityScope;
  ai_strategy?: string | null;
  ai_confidence?: number | null;
  safety_flag: boolean;
  safety_detail?: string | null;
  created_at: string;
  sender_participant?: ChatParticipant;
}

export interface ChatInvite {
  id: string;
  room_id: string;
  inviter_participant_id: string;
  invited_user_id?: string | null;
  invite_code?: string | null;
  status: ChatInviteStatus;
  expires_at?: string | null;
  responded_at?: string | null;
  created_at: string;
}

export interface ChatJudgmentResult {
  roomId: string;
  caseId: string;
  judgmentId?: string;
  linkId?: string;
  status: ChatRoomStatus;
}

export interface ChatJudgmentStatus {
  roomStatus?: ChatRoomStatus;
  latestLink?: {
    id: string;
    case?: {
      id: string;
      status: string;
      mode: string;
      submitted_at?: string | null;
      completed_at?: string | null;
    } | null;
    judgment?: {
      id: string;
      created_at: string;
      plaintiff_ratio?: number;
      defendant_ratio?: number;
    } | null;
  } | null;
}

export interface ChatStreamEvent {
  type: ChatStreamEventType;
  roomId: string;
  payload?: Record<string, unknown> & { text?: string };
  at?: string;
}
