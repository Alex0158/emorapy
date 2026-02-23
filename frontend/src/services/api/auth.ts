/**
 * 認證API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';

export interface RegisterDto {
  email: string;
  password: string;
  nickname?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  email_verified: boolean;
  created_at: string;
  last_login_at?: string;
  gender?: string;
  age?: number;
  relationship_status?: string;
  language?: string;
  timezone?: string;
  notification_enabled?: boolean;
  privacy_level?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expires_in?: number;
}

/**
 * 用戶註冊
 */
export const register = async (data: RegisterDto): Promise<AuthResponse> => {
  const response = await request.post<ApiResponse<AuthResponse>>('/auth/register', data);
  const result = (response.data as ApiResponse<AuthResponse>)?.data;
  if (!result?.token || !result?.user) {
    throw new Error('Invalid auth response from server');
  }
  return result;
};

/**
 * 用戶登錄
 */
export const login = async (data: LoginDto): Promise<AuthResponse> => {
  const response = await request.post<ApiResponse<AuthResponse>>('/auth/login', data);
  const result = (response.data as ApiResponse<AuthResponse>)?.data;
  if (!result?.token || !result?.user) {
    throw new Error('Invalid auth response from server');
  }
  return result;
};

/**
 * 發送驗證碼
 */
export const sendVerificationCode = async (
  email: string,
  type: 'register' | 'reset_password' | 'verify_email'
): Promise<void> => {
  await request.post<ApiResponse>('/auth/send-verification-code', { email, type });
};

/**
 * 驗證郵件驗證碼
 */
export const verifyEmail = async (
  email: string,
  code: string,
  type: 'register' | 'reset_password' | 'verify_email' = 'verify_email'
): Promise<boolean> => {
  const response = await request.post<ApiResponse<{ verified: boolean }>>('/auth/verify-email', {
    email,
    code,
    type,
  });
  return (response.data as ApiResponse<{ verified: boolean }>)?.data?.verified ?? false;
};

/**
 * 重置密碼
 */
export const resetPassword = async (email: string): Promise<void> => {
  await request.post<ApiResponse>('/auth/reset-password', { email });
};

/**
 * 確認重置密碼
 */
export const confirmResetPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<void> => {
  await request.post<ApiResponse>('/auth/reset-password-confirm', {
    email,
    code,
    new_password: newPassword,
  });
};

/**
 * 關聯快速體驗案件到已註冊用戶
 */
export const claimSession = async (sessionId: string): Promise<{ case_id: string | null }> => {
  const response = await request.post<ApiResponse<{ case_id: string | null }>>('/auth/claim-session', {
    session_id: sessionId,
  });
  return (response.data as ApiResponse<{ case_id: string | null }>)?.data ?? { case_id: null };
};
