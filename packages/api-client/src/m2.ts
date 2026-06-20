import type {
  FeedbackHistoryItem,
  InterviewResumeStatus,
  InterviewSession,
  InterviewTrigger,
  PsychProfile,
} from '@emorapy/contracts/interview';

import {
  isApiResponseEnvelope,
  readApiResponseError,
  toRequestError,
  type ApiResponseEnvelope,
} from './apiResponse.js';
import type { M1HttpClient, HttpResponse } from './m1.js';

export type UserProfile = Record<string, unknown>;
export type UserProfileInput = Record<string, unknown>;

export interface FeedbackHistoryResponse {
  history: FeedbackHistoryItem[];
}

export interface AcceptedResponse {
  accepted: boolean;
  session_id: string;
}

export interface CancelInterviewResponse {
  cancelled: boolean;
  session_id: string;
}

function unwrapResponse<T>(
  response: HttpResponse<ApiResponseEnvelope<T>>,
  fallbackMessage: string
): T {
  const body = response.data;
  if (!isApiResponseEnvelope(body)) {
    return body as T;
  }

  if (body.success) {
    if (body.data !== undefined) return body.data as T;
    return undefined as T;
  }

  const bodyError = readApiResponseError(body);
  throw toRequestError(
    bodyError.code ?? 'API_ERROR',
    bodyError.message ?? fallbackMessage,
    bodyError.details
  );
}

export function createProfileApi(http: M1HttpClient) {
  return {
    async getUserProfile(): Promise<UserProfile | null> {
      const response = await http.get<ApiResponseEnvelope<{ profile: UserProfile | null }>>('/profile/me');
      const data = unwrapResponse(response, 'Invalid profile response from server');
      return data.profile ?? null;
    },

    async upsertUserProfile(input: UserProfileInput): Promise<UserProfile> {
      const response = await http.put<ApiResponseEnvelope<{ profile: UserProfile }>>('/profile/me', input);
      const data = unwrapResponse(response, 'Invalid profile response from server');
      if (!data.profile) {
        throw toRequestError('INVALID_PROFILE_RESPONSE', 'Invalid profile response from server');
      }
      return data.profile;
    },
  };
}

export function createPsychProfileApi(http: M1HttpClient) {
  return {
    async getProfile(): Promise<PsychProfile> {
      const response = await http.get<ApiResponseEnvelope<PsychProfile>>('/psych-profile');
      const data = unwrapResponse(response, 'Invalid psych profile response from server');
      if (typeof data.consent_given !== 'boolean') {
        throw toRequestError('INVALID_PSYCH_PROFILE_RESPONSE', 'Invalid psych profile response from server');
      }
      return data;
    },

    async getFeedbackHistory(): Promise<FeedbackHistoryResponse> {
      const response = await http.get<ApiResponseEnvelope<FeedbackHistoryResponse>>('/psych-profile/feedback');
      const data = unwrapResponse(response, 'Invalid feedback history response from server');
      return { history: Array.isArray(data.history) ? data.history : [] };
    },

    async giveConsent(): Promise<void> {
      await http.post<ApiResponseEnvelope<undefined>>('/psych-profile/consent');
    },

    async deleteAllData(): Promise<void> {
      await http.delete<ApiResponseEnvelope<undefined>>('/psych-profile');
    },
  };
}

export function createInterviewApi(http: M1HttpClient) {
  return {
    async startSession(trigger: InterviewTrigger = 'organic'): Promise<InterviewSession> {
      const response = await http.post<ApiResponseEnvelope<InterviewSession>>('/interview/start', { trigger });
      const data = unwrapResponse(response, 'Invalid interview session response from server');
      if (!data.id) {
        throw toRequestError('INVALID_INTERVIEW_RESPONSE', 'Invalid interview session response from server');
      }
      return data;
    },

    async checkResume(): Promise<InterviewResumeStatus | null> {
      const response = await http.get<ApiResponseEnvelope<InterviewResumeStatus | null>>('/interview/resume');
      return unwrapResponse(response, 'Invalid interview resume response from server') ?? null;
    },

    async getSession(sessionId: string): Promise<InterviewSession> {
      const response = await http.get<ApiResponseEnvelope<InterviewSession>>(
        `/interview/${encodeURIComponent(sessionId)}`
      );
      const data = unwrapResponse(response, 'Invalid interview session response from server');
      if (!data.id) {
        throw toRequestError('INVALID_INTERVIEW_RESPONSE', 'Invalid interview session response from server');
      }
      return data;
    },

    async respond(sessionId: string, message: string): Promise<AcceptedResponse> {
      const response = await http.post<ApiResponseEnvelope<AcceptedResponse>>(
        `/interview/${encodeURIComponent(sessionId)}/respond`,
        { message }
      );
      return unwrapResponse(response, 'Invalid interview response acknowledgement from server');
    },

    async skip(sessionId: string): Promise<AcceptedResponse> {
      const response = await http.post<ApiResponseEnvelope<AcceptedResponse>>(
        `/interview/${encodeURIComponent(sessionId)}/skip`
      );
      return unwrapResponse(response, 'Invalid interview skip acknowledgement from server');
    },

    async cancel(sessionId: string): Promise<CancelInterviewResponse> {
      const response = await http.post<ApiResponseEnvelope<CancelInterviewResponse>>(
        `/interview/${encodeURIComponent(sessionId)}/cancel`
      );
      return unwrapResponse(response, 'Invalid interview cancel response from server');
    },

    async endSession(sessionId: string): Promise<void> {
      await http.post<ApiResponseEnvelope<undefined>>(`/interview/${encodeURIComponent(sessionId)}/end`);
    },

    async retryFailed(sessionId: string): Promise<void> {
      await http.post<ApiResponseEnvelope<undefined>>(`/interview/${encodeURIComponent(sessionId)}/retry`);
    },
  };
}

export function createM2ApiClient(http: M1HttpClient) {
  return {
    interview: createInterviewApi(http),
    profile: createProfileApi(http),
    psychProfile: createPsychProfileApi(http),
  };
}
