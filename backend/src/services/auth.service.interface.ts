/**
 * 認證服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * AuthService 符合此介面；Controller 可選改為依賴 IAuthService 並在建構時注入。
 */

import type {
  EmailVerificationResult,
  RegistrationVerificationResult,
  VerificationCodeDeliveryResult,
} from '../types/auth.types';

export type VerificationType = 'register' | 'verify_email';
export type AuthLocale = 'zh-TW' | 'en-US';

export interface IAuthService {
  register(data: unknown, locale?: AuthLocale): Promise<{ user: unknown; token: string }>;

  login(data: unknown): Promise<{ user: unknown; token: string; expires_in: number }>;

  sendVerificationCode(
    email: string,
    type: VerificationType,
    locale?: AuthLocale
  ): Promise<VerificationCodeDeliveryResult>;

  verifyEmail(
    email: string,
    code: string,
    type?: VerificationType
  ): Promise<RegistrationVerificationResult | EmailVerificationResult>;

  resetPassword(email: string, locale?: AuthLocale): Promise<void>;

  confirmResetPassword(email: string, code: string, newPassword: string): Promise<void>;
}
