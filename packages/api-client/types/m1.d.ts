import type { AuthResponse, ClaimSessionResponse, LoginDto, RegisterDto, RegistrationVerificationResult, VerificationCodeDeliveryResult, VerificationType } from '@emorapy/contracts/auth';
import type { Case, QuickCaseDto } from '@emorapy/contracts/case';
import type { Session } from '@emorapy/contracts/session';
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
export declare function createSessionApi(http: M1HttpClient): {
    createQuickSession(): Promise<Session>;
    refreshQuickSession(currentSessionId?: string | null): Promise<Session>;
};
export declare function createAuthApi(http: M1HttpClient): {
    login(input: LoginDto): Promise<AuthResponse>;
    register(input: RegisterDto): Promise<AuthResponse>;
    claimSession(sessionId: string): Promise<ClaimSessionResponse>;
    sendVerificationCode(email: string, type: VerificationType): Promise<VerificationCodeDeliveryResult>;
    verifyRegistrationCode(email: string, code: string): Promise<RegistrationVerificationResult>;
    verifyEmail(email: string, code: string): Promise<boolean>;
    resetPassword(email: string): Promise<void>;
    confirmResetPassword(email: string, code: string, newPassword: string): Promise<void>;
};
export declare function createQuickApi(http: M1HttpClient): {
    createQuickCase(input: QuickCaseDto): Promise<QuickCaseResponse>;
    getCase(caseId: string, sessionId?: string | null): Promise<Case>;
    getCaseBySessionId(sessionId: string): Promise<Case | null>;
    createCollaborativeCase(input: CollaborativeCaseInput, sessionId?: string | null): Promise<CollaborativeCaseResponse>;
};
export declare function createM1ApiClient(http: M1HttpClient): {
    auth: {
        login(input: LoginDto): Promise<AuthResponse>;
        register(input: RegisterDto): Promise<AuthResponse>;
        claimSession(sessionId: string): Promise<ClaimSessionResponse>;
        sendVerificationCode(email: string, type: VerificationType): Promise<VerificationCodeDeliveryResult>;
        verifyRegistrationCode(email: string, code: string): Promise<RegistrationVerificationResult>;
        verifyEmail(email: string, code: string): Promise<boolean>;
        resetPassword(email: string): Promise<void>;
        confirmResetPassword(email: string, code: string, newPassword: string): Promise<void>;
    };
    quick: {
        createQuickCase(input: QuickCaseDto): Promise<QuickCaseResponse>;
        getCase(caseId: string, sessionId?: string | null): Promise<Case>;
        getCaseBySessionId(sessionId: string): Promise<Case | null>;
        createCollaborativeCase(input: CollaborativeCaseInput, sessionId?: string | null): Promise<CollaborativeCaseResponse>;
    };
    session: {
        createQuickSession(): Promise<Session>;
        refreshQuickSession(currentSessionId?: string | null): Promise<Session>;
    };
};
//# sourceMappingURL=m1.d.ts.map