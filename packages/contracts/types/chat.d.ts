export type ChatRoomStatus = "solo_active" | "invite_pending" | "invite_accepted" | "group_active" | "judgment_requested" | "judgment_completed" | "judgment_failed" | "archived";
export type ChatHistoryVisibilityMode = "share_full_history" | "share_summary_only" | "share_from_join_time";
export type ChatRoleInRoom = "roleA" | "roleB" | "aiMediator" | "system";
export type ChatMessageType = "user_text" | "ai_reflection" | "ai_mediation" | "ai_summary" | "system_event" | "safety_notice";
export type ChatVisibilityScope = "all" | "owner_only" | "summary_only";
export type ChatInviteStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";
export type ChatChannelKind = "shared" | "private";
export type PrivateContextUseMode = "private_only" | "shared_process_controls";
export type SharedAdaptationConsentDecision = "not_set" | "accepted" | "declined";
export type ContextCapsuleStatus = "draft" | "approved" | "revoked" | "expired" | "discarded" | "legacy_review_required";
export type ContextSensitivityClass = "standard" | "sensitive" | "highly_sensitive" | "safety_restricted";
export type ContextPurpose = "private_support" | "shared_mediation" | "shared_mediation_adaptation" | "formal_analysis_evidence" | "formal_analysis_delivery" | "future_private_support" | "future_joint_support" | "solo_repair" | "joint_repair" | "safety_routing";
export type ContextAudience = "private_owner" | "room_participants" | "analysis_participants" | "pairing_participants" | "safety_system";
export type ContextTargetType = "user" | "chat_room" | "case" | "pairing" | "analysis_request" | "repair_track";
export type ChatAnalysisRequestStatus = "draft" | "pending_approval" | "approved" | "submitted" | "processing" | "completed" | "cancelled" | "expired";
export type ChatAnalysisApprovalDecision = "approved" | "declined";
export type ContextUseDecision = "allowed" | "denied";
export type ContextSourceKind = "chat_message" | "context_capsule" | "personal_memory" | "joint_memory" | "formal_evidence";
/** A low-sensitivity lineage reference. It must never contain source content. */
export interface ContextSourceRef {
    kind: ContextSourceKind;
    id: string;
    version?: number;
    content_hash?: string;
}
export interface ContextAuthorizationRef {
    id: string;
    capsule_id: string;
    capsule_content_hash: string;
}
export interface ChatChannel {
    id: string;
    room_id: string;
    kind: ChatChannelKind;
    owner_participant_id?: string | null;
    created_at: string;
    updated_at: string;
}
export interface ContextCapsule {
    id: string;
    room_id: string;
    owner_participant_id: string;
    source_channel_id: string;
    lineage_id: string;
    version: number;
    summary: string;
    source_refs: ContextSourceRef[];
    /** Lowercase hexadecimal SHA-256 of the canonical capsule payload. */
    content_hash: string;
    policy_version: string;
    sensitivity_class: ContextSensitivityClass;
    status: ContextCapsuleStatus;
    expires_at?: string | null;
    revoked_at?: string | null;
    created_at: string;
}
export interface ContextAuthorization {
    id: string;
    capsule_id: string;
    subject_participant_id: string;
    purpose: ContextPurpose;
    audience: ContextAudience;
    target_type: ContextTargetType;
    target_id: string;
    capsule_content_hash: string;
    policy_version: string;
    granted_at: string;
    expires_at?: string | null;
    revoked_at?: string | null;
    revocation_reason_code?: string | null;
}
export interface ContextCapsuleListItem extends ContextCapsule {
    authorizations: ContextAuthorization[];
}
export interface ChatAnalysisSelectionSnapshot {
    message_refs: ContextSourceRef[];
    capsule_refs: ContextSourceRef[];
}
export interface ChatAnalysisParticipantApproval {
    id: string;
    analysis_request_id: string;
    participant_id: string;
    decision: ChatAnalysisApprovalDecision;
    selection_hash: string;
    policy_version: string;
    decision_at: string;
    expires_at: string;
    revoked_at?: string | null;
}
export interface ChatAnalysisMessageSourcePreview {
    kind: "chat_message";
    id: string;
    content: string;
    content_hash: string;
    sender_participant_id: string;
    sender_role: Extract<ChatRoleInRoom, "roleA" | "roleB">;
    created_at: string;
}
export interface ChatAnalysisCapsuleSourcePreview {
    kind: "context_capsule";
    id: string;
    version: number;
    summary: string;
    content_hash: string;
    owner_participant_id: string;
    owner_role: Extract<ChatRoleInRoom, "roleA" | "roleB">;
}
export interface ChatAnalysisSourcePreviews {
    messages: ChatAnalysisMessageSourcePreview[];
    capsules: ChatAnalysisCapsuleSourcePreview[];
}
export interface ChatAnalysisRequest {
    id: string;
    room_id: string;
    requested_by_participant_id: string;
    status: ChatAnalysisRequestStatus;
    selection_snapshot: ChatAnalysisSelectionSnapshot;
    /** Lowercase hexadecimal SHA-256 of the canonical selection snapshot. */
    selection_hash: string;
    required_participant_ids: string[];
    policy_version: string;
    expires_at: string;
    submitted_at?: string | null;
    cancelled_at?: string | null;
    created_at: string;
    updated_at: string;
    participant_approvals?: ChatAnalysisParticipantApproval[];
}
export interface ChatAnalysisRequestListItem extends ChatAnalysisRequest {
    participant_approvals: ChatAnalysisParticipantApproval[];
    source_previews: ChatAnalysisSourcePreviews;
}
/** Append-only, low-sensitivity receipt. source_refs must contain IDs/hashes only. */
export interface ContextUseAudit {
    id: string;
    room_id?: string | null;
    actor_participant_id?: string | null;
    analysis_request_id?: string | null;
    capsule_id?: string | null;
    authorization_id?: string | null;
    purpose: ContextPurpose;
    audience: ContextAudience;
    target_type: ContextTargetType;
    target_id: string;
    decision: ContextUseDecision;
    reason_code: string;
    source_refs: ContextSourceRef[];
    authorization_refs: ContextAuthorizationRef[];
    content_hashes: string[];
    policy_version: string;
    prompt_version?: string | null;
    request_correlation_id?: string | null;
    created_at: string;
}
export type ContextUsageReceiptScope = "actor" | "room_aggregate";
export type ContextUsageReceiptCategory = "capsule_lifecycle" | "authorization" | "analysis_request" | "analysis_consent" | "adaptation_consent" | "private_support_use" | "shared_mediation_use" | "adaptation_use" | "adaptation_readiness";
export interface ContextUsageSourceTypeCounts {
    chat_message: number;
    context_capsule: number;
    personal_memory: number;
    joint_memory: number;
    formal_evidence: number;
}
/** Owner-facing, identifier-free view of a durable context-use audit. */
export interface ContextUsageReceipt {
    scope: ContextUsageReceiptScope;
    purpose: ContextPurpose;
    decision: ContextUseDecision;
    category: ContextUsageReceiptCategory;
    source_type_counts: ContextUsageSourceTypeCounts;
    authorization_count: number;
    policy_version: string;
    prompt_version?: string | null;
    created_at: string;
}
export interface CreateContextCapsuleInput {
    source_channel_id: string;
    source_message_ids: string[];
    summary: string;
    expires_at?: string | null;
}
export interface GrantContextAuthorizationInput {
    capsule_content_hash: string;
    purpose: ContextPurpose;
    audience: ContextAudience;
    target_type: ContextTargetType;
    target_id: string;
    policy_version: string;
    expires_at?: string | null;
}
export interface RevokeContextAuthorizationInput {
    reason_code: string;
}
export interface CreateChatAnalysisRequestInput {
    selected_message_ids: string[];
    selected_capsule_ids: string[];
}
export interface DecideChatAnalysisRequestInput {
    selection_hash: string;
    decision: ChatAnalysisApprovalDecision;
    policy_version: string;
}
export type ChatStreamEventType = "message" | "invite" | "room_status" | "ready" | "ping" | "system";
export interface ChatParticipant {
    id: string;
    room_id: string;
    participant_type: "user" | "ai" | "system";
    user_id?: string | null;
    role_in_room: ChatRoleInRoom;
    joined_at: string;
    left_at?: string | null;
    is_active: boolean;
    private_context_use_mode: PrivateContextUseMode;
    private_context_policy_version?: string | null;
    private_context_preference_updated_at?: string | null;
    shared_adaptation_consent: SharedAdaptationConsentDecision;
    shared_adaptation_policy_version?: string | null;
    shared_adaptation_decided_at?: string | null;
}
export interface RoomAdaptationStatus {
    policy_version: string;
    enabled: boolean;
    active_participant_count: number;
    accepted_participant_count: number;
    owner_opt_in_count: number;
}
export interface PrivateContextPreference {
    participant_id: string;
    mode: PrivateContextUseMode;
    mode_policy_version?: string | null;
    mode_updated_at?: string | null;
    adaptation_decision: SharedAdaptationConsentDecision;
    adaptation_policy_version?: string | null;
    adaptation_decided_at?: string | null;
    room_adaptation: RoomAdaptationStatus;
}
export interface UpdatePrivateContextPreferenceInput {
    mode: PrivateContextUseMode;
    policy_version: string;
}
export interface UpdateSharedAdaptationConsentInput {
    decision: Exclude<SharedAdaptationConsentDecision, "not_set">;
    policy_version: string;
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
    channels?: ChatChannel[];
}
export type ChatRoomSafetyState = "open" | "paused";
/** Sanitized room-wide safety state. It intentionally carries no source or reason. */
export interface ChatRoomSafetyStatus {
    status: ChatRoomSafetyState;
}
export interface ChatMessage {
    id: string;
    room_id: string;
    channel_id?: string | null;
    ai_context_eligible: boolean;
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
    channel?: ChatChannel;
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
    channelId?: string;
    payload?: Record<string, unknown> & {
        text?: string;
        streamId?: string;
        requestId?: string;
        messageId?: string;
        done?: boolean;
        error?: boolean;
    };
    at?: string;
}
//# sourceMappingURL=chat.d.ts.map