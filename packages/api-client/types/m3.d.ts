import type { ChatHistoryVisibilityMode, ChatInvite, ChatJudgmentResult, ChatJudgmentStatus, ChatMessage, ChatRoom, ChatVisibilityScope } from '@emorapy/contracts/chat';
import type { M1HttpClient } from './m1.js';
export type { ChatHistoryVisibilityMode, ChatInvite, ChatJudgmentResult, ChatJudgmentStatus, ChatMessage, ChatRoom, ChatStreamEvent, ChatVisibilityScope, } from '@emorapy/contracts/chat';
export declare const CHAT_JUDGMENT_REQUEST_TIMEOUT_MS = 180000;
export interface ListChatMessagesResponse {
    messages: ChatMessage[];
    nextCursor: string | null;
}
export interface CreateChatInviteInput {
    history_visibility_mode?: ChatHistoryVisibilityMode;
    expires_in_hours?: number;
}
export interface SendChatMessageInput {
    content: string;
    visibility_scope?: ChatVisibilityScope;
    reply_to_message_id?: string | null;
}
export interface RequestChatJudgmentInput {
    included_message_ids?: string[];
    participant_consent?: {
        role_b_included_messages?: boolean;
    };
}
export declare function chatRoomPath(roomId: string, suffix?: string): string;
export declare function chatInvitePath(inviteCode: string, suffix?: string): string;
export declare function normalizeListChatMessagesResponse(result: ListChatMessagesResponse): ListChatMessagesResponse;
export declare function createChatApi(http: M1HttpClient): {
    createRoom(historyVisibilityMode?: ChatHistoryVisibilityMode): Promise<ChatRoom>;
    getRoom(roomId: string): Promise<ChatRoom>;
    createInvite(roomId: string, input?: CreateChatInviteInput): Promise<ChatInvite>;
    acceptInvite(inviteCode: string): Promise<ChatRoom>;
    declineInvite(inviteCode: string): Promise<ChatInvite>;
    listMessages(roomId: string, params?: {
        cursor?: string;
        limit?: number;
    }): Promise<ListChatMessagesResponse>;
    sendMessage(roomId: string, input: SendChatMessageInput): Promise<ChatMessage>;
    requestJudgment(roomId: string, input?: RequestChatJudgmentInput): Promise<ChatJudgmentResult>;
    getJudgmentStatus(roomId: string): Promise<ChatJudgmentStatus>;
    leaveRoom(roomId: string): Promise<ChatRoom>;
    kickParticipantB(roomId: string): Promise<ChatRoom>;
};
export declare function createM3ApiClient(http: M1HttpClient): {
    chat: {
        createRoom(historyVisibilityMode?: ChatHistoryVisibilityMode): Promise<ChatRoom>;
        getRoom(roomId: string): Promise<ChatRoom>;
        createInvite(roomId: string, input?: CreateChatInviteInput): Promise<ChatInvite>;
        acceptInvite(inviteCode: string): Promise<ChatRoom>;
        declineInvite(inviteCode: string): Promise<ChatInvite>;
        listMessages(roomId: string, params?: {
            cursor?: string;
            limit?: number;
        }): Promise<ListChatMessagesResponse>;
        sendMessage(roomId: string, input: SendChatMessageInput): Promise<ChatMessage>;
        requestJudgment(roomId: string, input?: RequestChatJudgmentInput): Promise<ChatJudgmentResult>;
        getJudgmentStatus(roomId: string): Promise<ChatJudgmentStatus>;
        leaveRoom(roomId: string): Promise<ChatRoom>;
        kickParticipantB(roomId: string): Promise<ChatRoom>;
    };
};
//# sourceMappingURL=m3.d.ts.map