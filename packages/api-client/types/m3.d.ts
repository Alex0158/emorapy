import type { ChatChannel, ChatHistoryVisibilityMode, ChatInvite, ChatJudgmentResult, ChatJudgmentStatus, ChatMessage, ChatRoom, ChatRoomSafetyStatus, ChatVisibilityScope } from "@emorapy/contracts/chat";
import type { M1HttpClient } from "./m1.js";
export type { ChatAnalysisApprovalDecision, ChatAnalysisParticipantApproval, ChatAnalysisRequest, ChatAnalysisRequestListItem, ChatAnalysisRequestStatus, ChatAnalysisSelectionSnapshot, ChatAnalysisSourcePreviews, ChatChannel, ChatChannelKind, ChatHistoryVisibilityMode, ChatInvite, ChatJudgmentResult, ChatJudgmentStatus, ChatMessage, ChatRoom, ChatRoomSafetyState, ChatRoomSafetyStatus, ChatStreamEvent, ChatVisibilityScope, PrivateContextPreference, PrivateContextUseMode, ContextAudience, ContextAuthorization, ContextAuthorizationRef, ContextCapsule, ContextCapsuleListItem, ContextCapsuleStatus, ContextPurpose, ContextSensitivityClass, ContextSourceKind, ContextSourceRef, ContextTargetType, ContextUseAudit, ContextUseDecision, CreateChatAnalysisRequestInput, CreateContextCapsuleInput, DecideChatAnalysisRequestInput, GrantContextAuthorizationInput, RevokeContextAuthorizationInput, UpdatePrivateContextPreferenceInput, } from "@emorapy/contracts/chat";
export declare const CHAT_JUDGMENT_REQUEST_TIMEOUT_MS = 180000;
export interface ListChatMessagesResponse {
    messages: ChatMessage[];
    nextCursor: string | null;
}
export interface ListChatMessagesInput {
    cursor?: string;
    limit?: number;
    channel_id?: string;
}
export interface ListChannelMessagesInput {
    cursor?: string;
    limit?: number;
}
export interface CreateChatInviteInput {
    history_visibility_mode?: ChatHistoryVisibilityMode;
    expires_in_hours?: number;
}
export interface SendChatMessageInput {
    content: string;
    channel_id?: string;
    visibility_scope?: ChatVisibilityScope;
    reply_to_message_id?: string | null;
}
export interface SendChannelMessageInput {
    content: string;
    reply_to_message_id?: string | null;
}
export interface RequestChatJudgmentInput {
    included_message_ids?: string[];
    analysis_request_id?: string;
}
export declare function chatRoomPath(roomId: string, suffix?: string): string;
export declare function chatInvitePath(inviteCode: string, suffix?: string): string;
export declare function chatChannelPath(channelId: string, suffix?: string): string;
export declare function normalizeListChatMessagesResponse(result: ListChatMessagesResponse): ListChatMessagesResponse;
export declare function createChatApi(http: M1HttpClient): {
    createRoom(historyVisibilityMode?: ChatHistoryVisibilityMode): Promise<ChatRoom>;
    getRoom(roomId: string): Promise<ChatRoom>;
    getRoomSafetyStatus(roomId: string): Promise<ChatRoomSafetyStatus>;
    createInvite(roomId: string, input?: CreateChatInviteInput): Promise<ChatInvite>;
    acceptInvite(inviteCode: string): Promise<ChatRoom>;
    declineInvite(inviteCode: string): Promise<ChatInvite>;
    listMessages(roomId: string, params?: ListChatMessagesInput): Promise<ListChatMessagesResponse>;
    listChannels(roomId: string): Promise<ChatChannel[]>;
    listChannelMessages(channelId: string, params?: ListChannelMessagesInput): Promise<ListChatMessagesResponse>;
    sendMessage(roomId: string, input: SendChatMessageInput): Promise<ChatMessage>;
    sendChannelMessage(channelId: string, input: SendChannelMessageInput): Promise<ChatMessage>;
    requestJudgment(roomId: string, input?: RequestChatJudgmentInput): Promise<ChatJudgmentResult>;
    getJudgmentStatus(roomId: string): Promise<ChatJudgmentStatus>;
    leaveRoom(roomId: string): Promise<ChatRoom>;
    kickParticipantB(roomId: string): Promise<ChatRoom>;
    getPrivateContextPreference(roomId: string): Promise<import("@emorapy/contracts/chat").PrivateContextPreference>;
    updatePrivateContextPreference(roomId: string, input: import("@emorapy/contracts/chat").UpdatePrivateContextPreferenceInput): Promise<import("@emorapy/contracts/chat").PrivateContextPreference>;
    updateSharedAdaptationConsent(roomId: string, input: import("@emorapy/contracts/chat").UpdateSharedAdaptationConsentInput): Promise<import("@emorapy/contracts/chat").PrivateContextPreference>;
    createContextCapsule(roomId: string, input: import("@emorapy/contracts/chat").CreateContextCapsuleInput): Promise<import("@emorapy/contracts/chat").ContextCapsule>;
    listContextCapsules(roomId: string): Promise<import("@emorapy/contracts/chat").ContextCapsuleListItem[]>;
    reviseContextCapsule(roomId: string, capsuleId: string, input: import("@emorapy/contracts/chat").CreateContextCapsuleInput): Promise<import("@emorapy/contracts/chat").ContextCapsule>;
    discardContextCapsule(roomId: string, capsuleId: string): Promise<import("@emorapy/contracts/chat").ContextCapsule>;
    listContextUsageReceipts(roomId: string): Promise<import("@emorapy/contracts/chat").ContextUsageReceipt[]>;
    grantContextAuthorization(roomId: string, capsuleId: string, input: import("@emorapy/contracts/chat").GrantContextAuthorizationInput): Promise<import("@emorapy/contracts/chat").ContextAuthorization>;
    revokeContextAuthorization(roomId: string, authorizationId: string, input: import("@emorapy/contracts/chat").RevokeContextAuthorizationInput): Promise<import("@emorapy/contracts/chat").ContextAuthorization>;
    createAnalysisRequest(roomId: string, input: import("@emorapy/contracts/chat").CreateChatAnalysisRequestInput): Promise<import("@emorapy/contracts/chat").ChatAnalysisRequest>;
    listAnalysisRequests(roomId: string): Promise<import("@emorapy/contracts/chat").ChatAnalysisRequestListItem[]>;
    decideAnalysisRequest(roomId: string, requestId: string, input: import("@emorapy/contracts/chat").DecideChatAnalysisRequestInput): Promise<import("@emorapy/contracts/chat").ChatAnalysisParticipantApproval>;
    revokeAnalysisApproval(roomId: string, requestId: string, input: {
        selection_hash: string;
        policy_version: string;
    }): Promise<import("@emorapy/contracts/chat").ChatAnalysisParticipantApproval>;
    submitAnalysisRequest(roomId: string, requestId: string): Promise<import("@emorapy/contracts/chat").ChatAnalysisRequest>;
};
export declare function createM3ApiClient(http: M1HttpClient): {
    chat: {
        createRoom(historyVisibilityMode?: ChatHistoryVisibilityMode): Promise<ChatRoom>;
        getRoom(roomId: string): Promise<ChatRoom>;
        getRoomSafetyStatus(roomId: string): Promise<ChatRoomSafetyStatus>;
        createInvite(roomId: string, input?: CreateChatInviteInput): Promise<ChatInvite>;
        acceptInvite(inviteCode: string): Promise<ChatRoom>;
        declineInvite(inviteCode: string): Promise<ChatInvite>;
        listMessages(roomId: string, params?: ListChatMessagesInput): Promise<ListChatMessagesResponse>;
        listChannels(roomId: string): Promise<ChatChannel[]>;
        listChannelMessages(channelId: string, params?: ListChannelMessagesInput): Promise<ListChatMessagesResponse>;
        sendMessage(roomId: string, input: SendChatMessageInput): Promise<ChatMessage>;
        sendChannelMessage(channelId: string, input: SendChannelMessageInput): Promise<ChatMessage>;
        requestJudgment(roomId: string, input?: RequestChatJudgmentInput): Promise<ChatJudgmentResult>;
        getJudgmentStatus(roomId: string): Promise<ChatJudgmentStatus>;
        leaveRoom(roomId: string): Promise<ChatRoom>;
        kickParticipantB(roomId: string): Promise<ChatRoom>;
        getPrivateContextPreference(roomId: string): Promise<import("@emorapy/contracts/chat").PrivateContextPreference>;
        updatePrivateContextPreference(roomId: string, input: import("@emorapy/contracts/chat").UpdatePrivateContextPreferenceInput): Promise<import("@emorapy/contracts/chat").PrivateContextPreference>;
        updateSharedAdaptationConsent(roomId: string, input: import("@emorapy/contracts/chat").UpdateSharedAdaptationConsentInput): Promise<import("@emorapy/contracts/chat").PrivateContextPreference>;
        createContextCapsule(roomId: string, input: import("@emorapy/contracts/chat").CreateContextCapsuleInput): Promise<import("@emorapy/contracts/chat").ContextCapsule>;
        listContextCapsules(roomId: string): Promise<import("@emorapy/contracts/chat").ContextCapsuleListItem[]>;
        reviseContextCapsule(roomId: string, capsuleId: string, input: import("@emorapy/contracts/chat").CreateContextCapsuleInput): Promise<import("@emorapy/contracts/chat").ContextCapsule>;
        discardContextCapsule(roomId: string, capsuleId: string): Promise<import("@emorapy/contracts/chat").ContextCapsule>;
        listContextUsageReceipts(roomId: string): Promise<import("@emorapy/contracts/chat").ContextUsageReceipt[]>;
        grantContextAuthorization(roomId: string, capsuleId: string, input: import("@emorapy/contracts/chat").GrantContextAuthorizationInput): Promise<import("@emorapy/contracts/chat").ContextAuthorization>;
        revokeContextAuthorization(roomId: string, authorizationId: string, input: import("@emorapy/contracts/chat").RevokeContextAuthorizationInput): Promise<import("@emorapy/contracts/chat").ContextAuthorization>;
        createAnalysisRequest(roomId: string, input: import("@emorapy/contracts/chat").CreateChatAnalysisRequestInput): Promise<import("@emorapy/contracts/chat").ChatAnalysisRequest>;
        listAnalysisRequests(roomId: string): Promise<import("@emorapy/contracts/chat").ChatAnalysisRequestListItem[]>;
        decideAnalysisRequest(roomId: string, requestId: string, input: import("@emorapy/contracts/chat").DecideChatAnalysisRequestInput): Promise<import("@emorapy/contracts/chat").ChatAnalysisParticipantApproval>;
        revokeAnalysisApproval(roomId: string, requestId: string, input: {
            selection_hash: string;
            policy_version: string;
        }): Promise<import("@emorapy/contracts/chat").ChatAnalysisParticipantApproval>;
        submitAnalysisRequest(roomId: string, requestId: string): Promise<import("@emorapy/contracts/chat").ChatAnalysisRequest>;
    };
};
//# sourceMappingURL=m3.d.ts.map