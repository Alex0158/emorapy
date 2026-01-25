/**
 * 認證相關類型定義
 */

export interface RegisterDto {
  email: string;
  password: string;
  nickname?: string;
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

export type VerificationType = 'register' | 'reset_password' | 'verify_email';

