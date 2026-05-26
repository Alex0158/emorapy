/**
 * 認證API
 */

import { createM1ApiClient } from '@cj/api-client';
import request from '../request';
import type {
  AuthResponse,
  AuthUser,
  ClaimSessionResponse,
  LoginDto,
  RegisterDto,
  VerificationType,
} from '@cj/contracts/auth';

export type User = AuthUser;

const sharedAuthApi = createM1ApiClient(request).auth;

/**
 * 用戶註冊
 */
export const register = async (data: RegisterDto): Promise<AuthResponse> => {
  return sharedAuthApi.register(data);
};

/**
 * 用戶登錄
 */
export const login = async (data: LoginDto): Promise<AuthResponse> => {
  return sharedAuthApi.login(data);
};

/**
 * 發送驗證碼
 */
export const sendVerificationCode = async (
  email: string,
  type: VerificationType
): Promise<void> => {
  await sharedAuthApi.sendVerificationCode(email, type);
};

/**
 * 驗證郵件驗證碼
 */
export const verifyEmail = async (
  email: string,
  code: string,
  type: VerificationType = 'verify_email'
): Promise<boolean> => {
  return sharedAuthApi.verifyEmail(email, code, type);
};

/**
 * 重置密碼
 */
export const resetPassword = async (email: string): Promise<void> => {
  await sharedAuthApi.resetPassword(email);
};

/**
 * 確認重置密碼
 */
export const confirmResetPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<void> => {
  await sharedAuthApi.confirmResetPassword(email, code, newPassword);
};

/**
 * 關聯快速體驗案件到已註冊用戶
 */
export const claimSession = async (sessionId: string): Promise<ClaimSessionResponse> => {
  return sharedAuthApi.claimSession(sessionId);
};
