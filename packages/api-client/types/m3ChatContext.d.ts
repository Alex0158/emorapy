import type { ChatAnalysisParticipantApproval, ChatAnalysisRequest, ChatAnalysisRequestListItem, ContextAuthorization, ContextCapsule, ContextCapsuleListItem, ContextUsageReceipt, CreateChatAnalysisRequestInput, CreateContextCapsuleInput, DecideChatAnalysisRequestInput, GrantContextAuthorizationInput, PrivateContextPreference, RevokeContextAuthorizationInput, UpdateSharedAdaptationConsentInput, UpdatePrivateContextPreferenceInput } from "@emorapy/contracts/chat";
import type { ApiResponseEnvelope } from "./apiResponse.js";
import type { HttpResponse, M1HttpClient } from "./m1.js";
type UnwrapResponse = <T>(response: HttpResponse<ApiResponseEnvelope<T>>, fallbackMessage: string) => T;
type EnsureValue = <T>(value: T | null | undefined, code: string, message: string) => T;
interface ChatContextApiDependencies {
    roomPath: (roomId: string, suffix?: string) => string;
    unwrapResponse: UnwrapResponse;
    ensureValue: EnsureValue;
    invalidListResponse: (code: string, message: string) => never;
}
export declare function createChatContextApi(http: M1HttpClient, { roomPath, unwrapResponse, ensureValue, invalidListResponse, }: ChatContextApiDependencies): {
    getPrivateContextPreference(roomId: string): Promise<PrivateContextPreference>;
    updatePrivateContextPreference(roomId: string, input: UpdatePrivateContextPreferenceInput): Promise<PrivateContextPreference>;
    updateSharedAdaptationConsent(roomId: string, input: UpdateSharedAdaptationConsentInput): Promise<PrivateContextPreference>;
    createContextCapsule(roomId: string, input: CreateContextCapsuleInput): Promise<ContextCapsule>;
    listContextCapsules(roomId: string): Promise<ContextCapsuleListItem[]>;
    reviseContextCapsule(roomId: string, capsuleId: string, input: CreateContextCapsuleInput): Promise<ContextCapsule>;
    discardContextCapsule(roomId: string, capsuleId: string): Promise<ContextCapsule>;
    listContextUsageReceipts(roomId: string): Promise<ContextUsageReceipt[]>;
    grantContextAuthorization(roomId: string, capsuleId: string, input: GrantContextAuthorizationInput): Promise<ContextAuthorization>;
    revokeContextAuthorization(roomId: string, authorizationId: string, input: RevokeContextAuthorizationInput): Promise<ContextAuthorization>;
    createAnalysisRequest(roomId: string, input: CreateChatAnalysisRequestInput): Promise<ChatAnalysisRequest>;
    listAnalysisRequests(roomId: string): Promise<ChatAnalysisRequestListItem[]>;
    decideAnalysisRequest(roomId: string, requestId: string, input: DecideChatAnalysisRequestInput): Promise<ChatAnalysisParticipantApproval>;
    revokeAnalysisApproval(roomId: string, requestId: string, input: {
        selection_hash: string;
        policy_version: string;
    }): Promise<ChatAnalysisParticipantApproval>;
    submitAnalysisRequest(roomId: string, requestId: string): Promise<ChatAnalysisRequest>;
};
export {};
//# sourceMappingURL=m3ChatContext.d.ts.map