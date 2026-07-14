import { describe, expect, it } from '@jest/globals';
import { redactLogInfo, redactSensitiveText } from '../../../src/utils/log-redaction';

describe('redactLogInfo', () => {
  it('redacts email and credential fields recursively', () => {
    const info = redactLogInfo({
      message: 'Delivery failed for owner@example.com',
      email: 'owner@example.com',
      nested: {
        verification_code: '123456',
        registration_proof: 'proof-secret',
        providerCode: 'EAUTH',
      },
    });

    expect(info).toEqual({
      message: 'Delivery failed for [email-redacted]',
      email: '[redacted]',
      nested: {
        verification_code: '[redacted]',
        registration_proof: '[redacted]',
        providerCode: 'EAUTH',
      },
    });
  });

  it('preserves operational error codes while redacting email text in errors', () => {
    const error = new Error('Mailbox owner@example.com rejected');
    const info = redactLogInfo({ code: 'EMAIL_DELIVERY_UNAVAILABLE', error });

    expect(info.code).toBe('EMAIL_DELIVERY_UNAVAILABLE');
    expect(error.message).toBe('Mailbox [email-redacted] rejected');
    expect(error.stack).not.toContain('owner@example.com');
  });

  it('redacts proof and OTP values embedded in validation or provider strings', () => {
    const proof = `rp1_${'a'.repeat(43)}`;
    const error = new Error(`registration_proof ${proof} is invalid; code 123456`);
    const info = redactLogInfo({
      message: `Provider rejected ${proof} after OTP 654321`,
      error,
      ordinaryNumber: '12345',
      sessionId: 'guest_ab123456cd',
    });

    expect(info.message).toBe(
      'Provider rejected [registration-proof-redacted] after OTP [otp-redacted]'
    );
    expect(error.message).toBe(
      'registration_proof [registration-proof-redacted] is invalid; code [otp-redacted]'
    );
    expect(error.stack).not.toContain(proof);
    expect(error.stack).not.toContain('123456');
    expect(info.ordinaryNumber).toBe('12345');
    expect(info.sessionId).toBe('guest_ab123456cd');
  });

  it('redacts JWT and bearer credentials from free-form error text', () => {
    const jwt = `${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`;
    const text = redactSensitiveText(`token ${jwt}; Authorization: Bearer opaque-token-value`);

    expect(text).toBe('token [jwt-redacted]; Authorization: Bearer [token-redacted]');
    expect(text).not.toContain(jwt);
    expect(text).not.toContain('opaque-token-value');
  });
});
