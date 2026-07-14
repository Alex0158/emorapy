import { describe, expect, it } from '@jest/globals';
import { resolveEmailDeliveryConfig } from '../../../src/config/email-delivery';

const validProductionConfig = {
  NODE_ENV: 'production',
  EMAIL_DELIVERY_MODE: 'smtp',
  EMAIL_FROM: 'noreply@example.com',
  EMAIL_OTP_PEPPER: 'test-email-otp-pepper-at-least-32-characters',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-password',
  SMTP_REQUIRE_TLS: 'true',
};

describe('resolveEmailDeliveryConfig', () => {
  it('allows explicit disabled mode outside production', () => {
    const result = resolveEmailDeliveryConfig({
      NODE_ENV: 'test',
      EMAIL_DELIVERY_MODE: 'disabled',
    });
    expect(result.errors).toEqual([]);
    expect(result.config).toMatchObject({ mode: 'disabled' });
  });

  it('rejects disabled delivery in production', () => {
    const result = resolveEmailDeliveryConfig({ NODE_ENV: 'production' });
    expect(result.errors).toContain('EMAIL_DELIVERY_MODE must be "smtp" or "resend_api" in production');
  });

  it('returns a normalized Resend HTTPS API config in production', () => {
    const result = resolveEmailDeliveryConfig({
      NODE_ENV: 'production',
      EMAIL_DELIVERY_MODE: 'resend_api',
      EMAIL_FROM: 'no-reply@emorapy.com',
      EMAIL_OTP_PEPPER: 'test-email-otp-pepper-at-least-32-characters',
      RESEND_API_KEY: 're_test',
    });
    expect(result.errors).toEqual([]);
    expect(result.config).toMatchObject({
      mode: 'resend_api',
      from: 'no-reply@emorapy.com',
      resendApi: {
        apiKey: 're_test',
        baseUrl: 'https://api.resend.com',
      },
    });
  });

  it('rejects an insecure Resend API base URL', () => {
    const result = resolveEmailDeliveryConfig({
      NODE_ENV: 'production',
      EMAIL_DELIVERY_MODE: 'resend_api',
      EMAIL_FROM: 'no-reply@emorapy.com',
      EMAIL_OTP_PEPPER: 'test-email-otp-pepper-at-least-32-characters',
      RESEND_API_KEY: 're_test',
      RESEND_API_BASE_URL: 'http://api.resend.com',
    });
    expect(result.errors).toContain('RESEND_API_BASE_URL must be a valid HTTPS URL');
  });

  it.each(['SMTP_HOST', 'EMAIL_FROM', 'EMAIL_OTP_PEPPER', 'SMTP_USER', 'SMTP_PASS'])(
    'rejects production config missing %s',
    (key) => {
      const source = { ...validProductionConfig };
      delete source[key as keyof typeof source];
      const result = resolveEmailDeliveryConfig(source);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  );

  it('rejects partial SMTP credentials in non-production', () => {
    const result = resolveEmailDeliveryConfig({
      NODE_ENV: 'test',
      EMAIL_DELIVERY_MODE: 'smtp',
      EMAIL_FROM: 'noreply@example.com',
      EMAIL_OTP_PEPPER: 'test-email-otp-pepper-at-least-32-characters',
      SMTP_HOST: '127.0.0.1',
      SMTP_USER: 'only-user',
    });
    expect(result.errors).toContain('SMTP_USER and SMTP_PASS must be configured together');
  });

  it('returns a normalized secure SMTP config', () => {
    const result = resolveEmailDeliveryConfig(validProductionConfig);
    expect(result.errors).toEqual([]);
    expect(result.config).toMatchObject({
      mode: 'smtp',
      from: 'noreply@example.com',
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTls: true,
      },
    });
  });
});
