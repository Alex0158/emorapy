import type {
  AuthResponse,
  ClaimSessionResponse,
  LoginDto,
  RegisterDto,
  VerificationType,
} from '@cj/contracts/auth';
import type { Case, QuickCaseDto } from '@cj/contracts/case';
import type { Session } from '@cj/contracts/session';

import {
  isApiResponseEnvelope,
  readApiResponseError,
  toRequestError,
  type ApiResponseEnvelope,
} from './apiResponse.js';

export interface HttpResponse<T> {
  data: T;
}

export interface M1HttpClient {
  delete<T = unknown>(url: string, config?: unknown): Promise<HttpResponse<T>>;
  get<T = unknown>(url: string, config?: unknown): Promise<HttpResponse<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<HttpResponse<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<HttpResponse<T>>;
}

export interface QuickCaseResponse {
  case: Case;
  session_id?: string;
  session_expires_at?: string;
}

export interface CollaborativeCaseInput {
  case_id?: string;
  plaintiff_statement?: string;
  defendant_statement?: string;
}

export interface CollaborativeCaseResponse {
  case: Case;
  session_id: string;
  session_expires_at: string;
  phase: 'a_done' | 'submitted';
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
    throw toRequestError('EMPTY_RESPONSE', fallbackMessage);
  }

  const bodyError = readApiResponseError(body);
  throw toRequestError(
    bodyError.code ?? 'API_ERROR',
    bodyError.message ?? fallbackMessage,
    bodyError.details
  );
}

export function createSessionApi(http: M1HttpClient) {
  return {
    async createQuickSession(): Promise<Session> {
      const response = await http.post<ApiResponseEnvelope<Session>>('/sessions/quick');
      const data = unwrapResponse(response, 'Invalid session response from server');
      if (!data.session_id || !data.expires_at) {
        throw toRequestError('INVALID_SESSION_RESPONSE', 'Invalid session response from server');
      }
      return data;
    },

    async refreshQuickSession(currentSessionId?: string | null): Promise<Session> {
      const response = await http.post<ApiResponseEnvelope<Session>>(
        '/sessions/refresh',
        undefined,
        currentSessionId ? { headers: { 'X-Session-Id': currentSessionId } } : undefined
      );
      const data = unwrapResponse(response, 'Invalid session response from server');
      if (!data.session_id || !data.expires_at) {
        throw toRequestError('INVALID_SESSION_RESPONSE', 'Invalid session response from server');
      }
      return data;
    },
  };
}

export function createAuthApi(http: M1HttpClient) {
  return {
    async login(input: LoginDto): Promise<AuthResponse> {
      const response = await http.post<ApiResponseEnvelope<AuthResponse>>('/auth/login', input);
      const data = unwrapResponse(response, 'Invalid auth response from server');
      if (!data.token || !data.user) {
        throw toRequestError('INVALID_AUTH_RESPONSE', 'Invalid auth response from server');
      }
      return data;
    },

    async register(input: RegisterDto): Promise<AuthResponse> {
      const response = await http.post<ApiResponseEnvelope<AuthResponse>>('/auth/register', input);
      const data = unwrapResponse(response, 'Invalid auth response from server');
      if (!data.token || !data.user) {
        throw toRequestError('INVALID_AUTH_RESPONSE', 'Invalid auth response from server');
      }
      return data;
    },

    async claimSession(sessionId: string): Promise<ClaimSessionResponse> {
      const response = await http.post<ApiResponseEnvelope<ClaimSessionResponse>>(
        '/auth/claim-session',
        { session_id: sessionId }
      );
      const data = unwrapResponse(response, 'Invalid claim-session response from server');
      return { case_id: data.case_id ?? null };
    },

    async sendVerificationCode(email: string, type: VerificationType): Promise<void> {
      await http.post<ApiResponseEnvelope<unknown>>('/auth/send-verification-code', { email, type });
    },

    async verifyEmail(
      email: string,
      code: string,
      type: VerificationType = 'verify_email'
    ): Promise<boolean> {
      const response = await http.post<ApiResponseEnvelope<{ verified?: boolean }>>('/auth/verify-email', {
        email,
        code,
        type,
      });
      const data = unwrapResponse(response, 'Invalid verify-email response from server');
      return data.verified ?? false;
    },

    async resetPassword(email: string): Promise<void> {
      await http.post<ApiResponseEnvelope<unknown>>('/auth/reset-password', { email });
    },

    async confirmResetPassword(email: string, code: string, newPassword: string): Promise<void> {
      await http.post<ApiResponseEnvelope<unknown>>('/auth/reset-password-confirm', {
        email,
        code,
        new_password: newPassword,
      });
    },
  };
}

export function createQuickApi(http: M1HttpClient) {
  return {
    async createQuickCase(input: QuickCaseDto): Promise<QuickCaseResponse> {
      const response = await http.post<ApiResponseEnvelope<QuickCaseResponse>>(
        '/cases/quick',
        input
      );
      const data = unwrapResponse(response, 'Invalid quick case response from server');
      if (!data.case?.id) {
        throw toRequestError('INVALID_CASE_RESPONSE', 'Invalid quick case response from server');
      }
      return data;
    },

    async getCase(caseId: string, sessionId?: string | null): Promise<Case> {
      const response = await http.get<ApiResponseEnvelope<{ case: Case }>>(
        `/cases/${caseId}`,
        sessionId ? { headers: { 'X-Session-Id': sessionId } } : undefined
      );
      const data = unwrapResponse(response, 'Invalid case response from server');
      if (!data.case?.id) {
        throw toRequestError('INVALID_CASE_RESPONSE', 'Invalid case response from server');
      }
      return data.case;
    },

    async getCaseBySessionId(sessionId: string): Promise<Case | null> {
      try {
        const response = await http.get<ApiResponseEnvelope<{ case: Case }>>('/cases/by-session', {
          headers: { 'X-Session-Id': sessionId },
        });
        const data = unwrapResponse(response, 'Invalid case response from server');
        return data.case ?? null;
      } catch (error) {
        const requestError = error as { code?: string };
        if (requestError.code === 'NOT_FOUND' || requestError.code === 'HTTP_404') {
          return null;
        }
        throw error;
      }
    },

    async createCollaborativeCase(
      input: CollaborativeCaseInput,
      sessionId?: string | null
    ): Promise<CollaborativeCaseResponse> {
      const response = await http.post<ApiResponseEnvelope<CollaborativeCaseResponse>>(
        '/cases/collaborative',
        input,
        sessionId ? { headers: { 'X-Session-Id': sessionId } } : undefined
      );
      const data = unwrapResponse(response, 'Invalid collaborative case response from server');
      if (!data.case?.id || !data.session_id) {
        throw toRequestError(
          'INVALID_COLLABORATIVE_RESPONSE',
          'Invalid collaborative case response from server'
        );
      }
      return data;
    },
  };
}

export function createM1ApiClient(http: M1HttpClient) {
  return {
    auth: createAuthApi(http),
    quick: createQuickApi(http),
    session: createSessionApi(http),
  };
}
