/**
 * 認證相關類型定義
 */

export interface RegisterDto {
  email: string;
  password: string;
  nickname?: string;
  registration_proof: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UserPayload {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    nickname?: string;
    avatar_url?: string;
    email_verified: boolean;
  };
  token: string;
  expires_in?: number;
}

export type VerificationType = 'register' | 'verify_email';

export interface VerificationCodeDeliveryResult {
  expires_in: number;
  resend_after: number;
}

export interface RegistrationVerificationResult {
  verified: true;
  registration_proof: string;
  registration_proof_expires_in: number;
}

export interface EmailVerificationResult {
  verified: true;
}
