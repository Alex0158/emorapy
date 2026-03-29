export type VerificationType = 'register' | 'reset_password' | 'verify_email';

export interface RegisterDto {
  email: string;
  password: string;
  nickname?: string;
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
