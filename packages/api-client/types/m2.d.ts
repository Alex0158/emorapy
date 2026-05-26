import type { FeedbackHistoryItem, InterviewResumeStatus, InterviewSession, InterviewTrigger, PsychProfile } from '@cj/contracts/interview';
import type { M1HttpClient } from './m1.js';
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
export declare function createProfileApi(http: M1HttpClient): {
    getUserProfile(): Promise<UserProfile | null>;
    upsertUserProfile(input: UserProfileInput): Promise<UserProfile>;
};
export declare function createPsychProfileApi(http: M1HttpClient): {
    getProfile(): Promise<PsychProfile>;
    getFeedbackHistory(): Promise<FeedbackHistoryResponse>;
    giveConsent(): Promise<void>;
    deleteAllData(): Promise<void>;
};
export declare function createInterviewApi(http: M1HttpClient): {
    startSession(trigger?: InterviewTrigger): Promise<InterviewSession>;
    checkResume(): Promise<InterviewResumeStatus | null>;
    getSession(sessionId: string): Promise<InterviewSession>;
    respond(sessionId: string, message: string): Promise<AcceptedResponse>;
    skip(sessionId: string): Promise<AcceptedResponse>;
    cancel(sessionId: string): Promise<CancelInterviewResponse>;
    endSession(sessionId: string): Promise<void>;
    retryFailed(sessionId: string): Promise<void>;
};
export declare function createM2ApiClient(http: M1HttpClient): {
    interview: {
        startSession(trigger?: InterviewTrigger): Promise<InterviewSession>;
        checkResume(): Promise<InterviewResumeStatus | null>;
        getSession(sessionId: string): Promise<InterviewSession>;
        respond(sessionId: string, message: string): Promise<AcceptedResponse>;
        skip(sessionId: string): Promise<AcceptedResponse>;
        cancel(sessionId: string): Promise<CancelInterviewResponse>;
        endSession(sessionId: string): Promise<void>;
        retryFailed(sessionId: string): Promise<void>;
    };
    profile: {
        getUserProfile(): Promise<UserProfile | null>;
        upsertUserProfile(input: UserProfileInput): Promise<UserProfile>;
    };
    psychProfile: {
        getProfile(): Promise<PsychProfile>;
        getFeedbackHistory(): Promise<FeedbackHistoryResponse>;
        giveConsent(): Promise<void>;
        deleteAllData(): Promise<void>;
    };
};
//# sourceMappingURL=m2.d.ts.map