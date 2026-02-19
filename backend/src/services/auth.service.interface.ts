/**
 * 認證服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * AuthService 符合此介面；Controller 可選改為依賴 IAuthService 並在建構時注入。
 */

export type VerificationType = 'register' | 'reset_password' | 'verify_email';

export interface IAuthService {
  register(data: unknown): Promise<{ user: unknown; token: string }>;

  login(data: unknown): Promise<{ user: unknown; token: string; expires_in: number }>;

  sendVerificationCode(email: string, type: VerificationType): Promise<void>;

  verifyEmail(
    email: string,
    code: string,
    type?: VerificationType
  ): Promise<boolean>;

  resetPassword(email: string): Promise<void>;

  confirmResetPassword(email: string, code: string, newPassword: string): Promise<void>;
}
