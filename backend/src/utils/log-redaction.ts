const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const REGISTRATION_PROOF_PATTERN = /\brp1_[A-Za-z0-9_-]{43}\b/g;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SIX_DIGIT_OTP_PATTERN = /(?<![A-Za-z0-9])\d{6}(?![A-Za-z0-9])/g;
const SENSITIVE_KEY_PATTERN = /^(?:access_?token|authorization|cookie|email|email_address|id_?token|jwt|otp|pass|password|recipient|refresh_?token|registration_?proof|secret|token|verification_?code)$/i;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[email-redacted]')
    .replace(REGISTRATION_PROOF_PATTERN, '[registration-proof-redacted]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [token-redacted]')
    .replace(JWT_PATTERN, '[jwt-redacted]')
    .replace(SIX_DIGIT_OTP_PATTERN, '[otp-redacted]');
}

function redactValue(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
  if (typeof value === 'string') return redactSensitiveText(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (value instanceof Error) {
    value.message = redactSensitiveText(value.message);
    if (value.stack) value.stack = redactSensitiveText(value.stack);
    for (const property of Object.keys(value)) {
      const record = value as unknown as Record<string, unknown>;
      record[property] = redactValue(record[property], property, seen);
    }
    return value;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = redactValue(value[index], undefined, seen);
    }
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const property of Object.keys(record)) {
    record[property] = redactValue(record[property], property, seen);
  }
  return record;
}

export function redactLogInfo<T extends Record<string, unknown>>(info: T): T {
  return redactValue(info, undefined, new WeakSet<object>()) as T;
}
