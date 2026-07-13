import type {
  ChatAnalysisParticipantApproval,
  ChatAnalysisRequest,
  ChatAnalysisRequestListItem,
  ContextAuthorization,
  ContextCapsule,
  ContextCapsuleListItem,
  ContextUsageReceipt,
  CreateChatAnalysisRequestInput,
  CreateContextCapsuleInput,
  DecideChatAnalysisRequestInput,
  GrantContextAuthorizationInput,
  PrivateContextPreference,
  RevokeContextAuthorizationInput,
  UpdateSharedAdaptationConsentInput,
  UpdatePrivateContextPreferenceInput,
} from "@emorapy/contracts/chat";
import type { ApiResponseEnvelope } from "./apiResponse.js";
import type { HttpResponse, M1HttpClient } from "./m1.js";

type UnwrapResponse = <T>(
  response: HttpResponse<ApiResponseEnvelope<T>>,
  fallbackMessage: string,
) => T;

type EnsureValue = <T>(
  value: T | null | undefined,
  code: string,
  message: string,
) => T;

interface ChatContextApiDependencies {
  roomPath: (roomId: string, suffix?: string) => string;
  unwrapResponse: UnwrapResponse;
  ensureValue: EnsureValue;
  invalidListResponse: (code: string, message: string) => never;
}

export function createChatContextApi(
  http: M1HttpClient,
  {
    roomPath,
    unwrapResponse,
    ensureValue,
    invalidListResponse,
  }: ChatContextApiDependencies,
) {
  return {
    async getPrivateContextPreference(
      roomId: string,
    ): Promise<PrivateContextPreference> {
      const response = await http.get<
        ApiResponseEnvelope<{ preference: PrivateContextPreference }>
      >(roomPath(roomId, "/context-preference"));
      const data = unwrapResponse(
        response,
        "Invalid private context preference response",
      );
      return ensureValue(
        data.preference,
        "INVALID_CHAT_CONTEXT_PREFERENCE_RESPONSE",
        "Invalid private context preference response",
      );
    },

    async updatePrivateContextPreference(
      roomId: string,
      input: UpdatePrivateContextPreferenceInput,
    ): Promise<PrivateContextPreference> {
      const response = await http.put<
        ApiResponseEnvelope<{ preference: PrivateContextPreference }>
      >(roomPath(roomId, "/context-preference"), input);
      const data = unwrapResponse(
        response,
        "Invalid private context preference response",
      );
      return ensureValue(
        data.preference,
        "INVALID_CHAT_CONTEXT_PREFERENCE_RESPONSE",
        "Invalid private context preference response",
      );
    },

    async updateSharedAdaptationConsent(
      roomId: string,
      input: UpdateSharedAdaptationConsentInput,
    ): Promise<PrivateContextPreference> {
      const response = await http.put<
        ApiResponseEnvelope<{ preference: PrivateContextPreference }>
      >(roomPath(roomId, "/adaptation-consent"), input);
      const data = unwrapResponse(
        response,
        "Invalid shared adaptation consent response",
      );
      return ensureValue(
        data.preference,
        "INVALID_CHAT_ADAPTATION_CONSENT_RESPONSE",
        "Invalid shared adaptation consent response",
      );
    },

    async createContextCapsule(
      roomId: string,
      input: CreateContextCapsuleInput,
    ): Promise<ContextCapsule> {
      const response = await http.post<
        ApiResponseEnvelope<{ capsule: ContextCapsule }>
      >(roomPath(roomId, "/context-capsules"), input);
      const data = unwrapResponse(response, "Invalid context capsule response");
      return ensureValue(
        data.capsule,
        "INVALID_CONTEXT_CAPSULE_RESPONSE",
        "Invalid context capsule response",
      );
    },

    async listContextCapsules(
      roomId: string,
    ): Promise<ContextCapsuleListItem[]> {
      const response = await http.get<
        ApiResponseEnvelope<{ capsules: ContextCapsuleListItem[] }>
      >(roomPath(roomId, "/context-capsules"));
      const data = unwrapResponse(
        response,
        "Invalid context capsules response",
      );
      if (!Array.isArray(data.capsules)) {
        invalidListResponse(
          "INVALID_CONTEXT_CAPSULES_RESPONSE",
          "Invalid context capsules response",
        );
      }
      return data.capsules;
    },

    async reviseContextCapsule(
      roomId: string,
      capsuleId: string,
      input: CreateContextCapsuleInput,
    ): Promise<ContextCapsule> {
      const response = await http.post<
        ApiResponseEnvelope<{ capsule: ContextCapsule }>
      >(
        roomPath(
          roomId,
          `/context-capsules/${encodeURIComponent(capsuleId)}/revisions`,
        ),
        input,
      );
      const data = unwrapResponse(response, "Invalid context capsule response");
      return ensureValue(
        data.capsule,
        "INVALID_CONTEXT_CAPSULE_RESPONSE",
        "Invalid context capsule response",
      );
    },

    async discardContextCapsule(
      roomId: string,
      capsuleId: string,
    ): Promise<ContextCapsule> {
      const response = await http.post<
        ApiResponseEnvelope<{ capsule: ContextCapsule }>
      >(
        roomPath(
          roomId,
          `/context-capsules/${encodeURIComponent(capsuleId)}/discard`,
        ),
      );
      const data = unwrapResponse(response, "Invalid context capsule response");
      return ensureValue(
        data.capsule,
        "INVALID_CONTEXT_CAPSULE_RESPONSE",
        "Invalid context capsule response",
      );
    },

    async listContextUsageReceipts(
      roomId: string,
    ): Promise<ContextUsageReceipt[]> {
      const response = await http.get<
        ApiResponseEnvelope<{ receipts: ContextUsageReceipt[] }>
      >(roomPath(roomId, "/context-usage-receipts"));
      const data = unwrapResponse(
        response,
        "Invalid context usage receipts response",
      );
      if (!Array.isArray(data.receipts)) {
        invalidListResponse(
          "INVALID_CONTEXT_USAGE_RECEIPTS_RESPONSE",
          "Invalid context usage receipts response",
        );
      }
      return data.receipts;
    },

    async grantContextAuthorization(
      roomId: string,
      capsuleId: string,
      input: GrantContextAuthorizationInput,
    ): Promise<ContextAuthorization> {
      const response = await http.post<
        ApiResponseEnvelope<{ authorization: ContextAuthorization }>
      >(
        roomPath(
          roomId,
          `/context-capsules/${encodeURIComponent(capsuleId)}/authorizations`,
        ),
        input,
      );
      const data = unwrapResponse(
        response,
        "Invalid context authorization response",
      );
      return ensureValue(
        data.authorization,
        "INVALID_CONTEXT_AUTHORIZATION_RESPONSE",
        "Invalid context authorization response",
      );
    },

    async revokeContextAuthorization(
      roomId: string,
      authorizationId: string,
      input: RevokeContextAuthorizationInput,
    ): Promise<ContextAuthorization> {
      const response = await http.post<
        ApiResponseEnvelope<{ authorization: ContextAuthorization }>
      >(
        roomPath(
          roomId,
          `/context-authorizations/${encodeURIComponent(authorizationId)}/revoke`,
        ),
        input,
      );
      const data = unwrapResponse(
        response,
        "Invalid context authorization response",
      );
      return ensureValue(
        data.authorization,
        "INVALID_CONTEXT_AUTHORIZATION_RESPONSE",
        "Invalid context authorization response",
      );
    },

    async createAnalysisRequest(
      roomId: string,
      input: CreateChatAnalysisRequestInput,
    ): Promise<ChatAnalysisRequest> {
      const response = await http.post<
        ApiResponseEnvelope<{ analysis_request: ChatAnalysisRequest }>
      >(roomPath(roomId, "/analysis-requests"), input);
      const data = unwrapResponse(
        response,
        "Invalid chat analysis request response",
      );
      return ensureValue(
        data.analysis_request,
        "INVALID_CHAT_ANALYSIS_REQUEST_RESPONSE",
        "Invalid chat analysis request response",
      );
    },

    async listAnalysisRequests(
      roomId: string,
    ): Promise<ChatAnalysisRequestListItem[]> {
      const response = await http.get<
        ApiResponseEnvelope<{
          analysis_requests: ChatAnalysisRequestListItem[];
        }>
      >(roomPath(roomId, "/analysis-requests"));
      const data = unwrapResponse(
        response,
        "Invalid chat analysis requests response",
      );
      if (!Array.isArray(data.analysis_requests)) {
        invalidListResponse(
          "INVALID_CHAT_ANALYSIS_REQUESTS_RESPONSE",
          "Invalid chat analysis requests response",
        );
      }
      return data.analysis_requests;
    },

    async decideAnalysisRequest(
      roomId: string,
      requestId: string,
      input: DecideChatAnalysisRequestInput,
    ): Promise<ChatAnalysisParticipantApproval> {
      const response = await http.post<
        ApiResponseEnvelope<{ approval: ChatAnalysisParticipantApproval }>
      >(
        roomPath(
          roomId,
          `/analysis-requests/${encodeURIComponent(requestId)}/decision`,
        ),
        input,
      );
      const data = unwrapResponse(
        response,
        "Invalid chat analysis approval response",
      );
      return ensureValue(
        data.approval,
        "INVALID_CHAT_ANALYSIS_APPROVAL_RESPONSE",
        "Invalid chat analysis approval response",
      );
    },

    async revokeAnalysisApproval(
      roomId: string,
      requestId: string,
      input: { selection_hash: string; policy_version: string },
    ): Promise<ChatAnalysisParticipantApproval> {
      const response = await http.post<
        ApiResponseEnvelope<{ approval: ChatAnalysisParticipantApproval }>
      >(
        roomPath(
          roomId,
          `/analysis-requests/${encodeURIComponent(requestId)}/approval/revoke`,
        ),
        input,
      );
      const data = unwrapResponse(
        response,
        "Invalid chat analysis approval response",
      );
      return ensureValue(
        data.approval,
        "INVALID_CHAT_ANALYSIS_APPROVAL_RESPONSE",
        "Invalid chat analysis approval response",
      );
    },

    async submitAnalysisRequest(
      roomId: string,
      requestId: string,
    ): Promise<ChatAnalysisRequest> {
      const response = await http.post<
        ApiResponseEnvelope<{ analysis_request: ChatAnalysisRequest }>
      >(
        roomPath(
          roomId,
          `/analysis-requests/${encodeURIComponent(requestId)}/submit`,
        ),
      );
      const data = unwrapResponse(
        response,
        "Invalid chat analysis request response",
      );
      return ensureValue(
        data.analysis_request,
        "INVALID_CHAT_ANALYSIS_REQUEST_RESPONSE",
        "Invalid chat analysis request response",
      );
    },
  };
}
