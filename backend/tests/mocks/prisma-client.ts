export const NotificationChannel = {
  email: 'email',
  push: 'push',
} as const;

export const NotificationStatus = {
  pending: 'pending',
  sent: 'sent',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export const RecoveryTaskStatus = {
  manual_review_required: 'manual_review_required',
  in_review: 'in_review',
  resolved: 'resolved',
  dismissed: 'dismissed',
} as const;

export const RecoveryTaskSeverity = {
  warning: 'warning',
  critical: 'critical',
} as const;

export const PairingStatus = {
  pending: 'pending',
  active: 'active',
  cancelled: 'cancelled',
  temp: 'temp',
} as const;

export const PairingType = {
  normal: 'normal',
  quick: 'quick',
} as const;

export const CaseStatus = {
  draft: 'draft',
  submitted: 'submitted',
  in_progress: 'in_progress',
  judgment_failed: 'judgment_failed',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

export const CaseMode = {
  remote: 'remote',
  collaborative: 'collaborative',
  quick: 'quick',
} as const;

export const AdminRoleKey = {
  super_admin: 'super_admin',
  ops: 'ops',
  marketing: 'marketing',
  support: 'support',
} as const;

export const PsychDomain = {
  attachment: 'attachment',
  family_origin: 'family_origin',
  life_events: 'life_events',
  belief_values: 'belief_values',
  cultural_background: 'cultural_background',
  education_cognition: 'education_cognition',
  personality: 'personality',
  relationship_history: 'relationship_history',
} as const;

export const InsightType = {
  trait: 'trait',
  pattern: 'pattern',
  belief: 'belief',
  trigger: 'trigger',
  strength: 'strength',
  risk: 'risk',
  cultural: 'cultural',
  developmental: 'developmental',
} as const;

export const ChatRoomStatus = {
  solo_active: 'solo_active',
  invite_pending: 'invite_pending',
  invite_accepted: 'invite_accepted',
  group_active: 'group_active',
  judgment_requested: 'judgment_requested',
  judgment_completed: 'judgment_completed',
  judgment_failed: 'judgment_failed',
  archived: 'archived',
} as const;

export const ChatHistoryVisibilityMode = {
  share_full_history: 'share_full_history',
  share_summary_only: 'share_summary_only',
  share_from_join_time: 'share_from_join_time',
} as const;

export const ChatParticipantType = {
  user: 'user',
  ai: 'ai',
  system: 'system',
} as const;

export const ChatRoleInRoom = {
  roleA: 'roleA',
  roleB: 'roleB',
  aiMediator: 'aiMediator',
  system: 'system',
} as const;

export const ChatParticipant = {};

export const ChatMessageType = {
  user_text: 'user_text',
  ai_reflection: 'ai_reflection',
  ai_mediation: 'ai_mediation',
  ai_summary: 'ai_summary',
  system_event: 'system_event',
  safety_notice: 'safety_notice',
} as const;

export const ChatVisibilityScope = {
  all: 'all',
  owner_only: 'owner_only',
  summary_only: 'summary_only',
} as const;

export const ChatChannelKind = {
  shared: 'shared',
  private: 'private',
} as const;

export const ChatInviteStatus = {
  pending: 'pending',
  accepted: 'accepted',
  declined: 'declined',
  expired: 'expired',
  revoked: 'revoked',
} as const;

class PrismaClientKnownRequestError extends Error {
  code: string;
  clientVersion: string;
  meta?: Record<string, unknown>;

  constructor(message: string, options: { code: string; clientVersion?: string; meta?: Record<string, unknown> }) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = options.code;
    this.clientVersion = options.clientVersion ?? 'test';
    this.meta = options.meta;
  }
}

export const Prisma = {
  JsonNull: null,
  DbNull: null,
  AnyNull: null,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  PrismaClientKnownRequestError,
};
