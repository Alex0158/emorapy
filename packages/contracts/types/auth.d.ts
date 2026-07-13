export type VerificationType = 'register' | 'verify_email';
export interface VerificationCodeDeliveryResult {
    expires_in: number;
    resend_after: number;
}
export interface RegisterDto {
    email: string;
    password: string;
    registration_proof: string;
    nickname?: string;
}
export interface RegistrationVerificationResult {
    verified: true;
    registration_proof: string;
    registration_proof_expires_in: number;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface AuthUser {
    id: string;
    email: string;
    nickname?: string;
    avatar_url?: string;
    email_verified: boolean;
    created_at?: string;
    last_login_at?: string;
    gender?: string;
    age?: number;
    relationship_status?: string;
    language?: string;
    timezone?: string;
    notification_enabled?: boolean;
    privacy_level?: string;
}
export interface UserPayload {
    id: string;
    email: string;
}
export interface AuthResponse {
    user: AuthUser;
    token: string;
    expires_in?: number;
}
export interface ClaimSessionResponse {
    case_id: string | null;
}
//# sourceMappingURL=auth.d.ts.map