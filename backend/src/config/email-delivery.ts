export type EmailDeliveryMode = 'disabled' | 'smtp';

export interface EmailDeliveryEnvSource {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  EMAIL_DELIVERY_MODE?: string;
  EMAIL_FROM?: string;
  EMAIL_OTP_PEPPER?: string;
  EMAIL_TRANSPORT_VERIFY_TIMEOUT_MS?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_SECURE?: string;
  SMTP_REQUIRE_TLS?: string;
}

export interface EmailDeliveryConfig {
  mode: EmailDeliveryMode;
  from?: string;
  otpPepper?: string;
  transportVerifyTimeoutMs: number;
  smtp?: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    secure: boolean;
    requireTls: boolean;
  };
}

export interface EmailDeliveryConfigResolution {
  config: EmailDeliveryConfig;
  errors: string[];
}

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBoolean(name: string, value: string | undefined, fallback: boolean, errors: string[]): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  errors.push(`${name} must be "true" or "false"`);
  return fallback;
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  errors: string[]
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    errors.push(`${name} must be an integer between ${minimum} and ${maximum}`);
    return fallback;
  }
  return parsed;
}

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function resolveEmailDeliveryConfig(source: EmailDeliveryEnvSource): EmailDeliveryConfigResolution {
  const errors: string[] = [];
  const nodeEnv = source.NODE_ENV?.trim() || 'development';
  const rawMode = source.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
  const mode: EmailDeliveryMode = rawMode === 'smtp' ? 'smtp' : 'disabled';

  if (rawMode && rawMode !== 'smtp' && rawMode !== 'disabled') {
    errors.push('EMAIL_DELIVERY_MODE must be "smtp" or "disabled"');
  }
  if (nodeEnv === 'production' && mode !== 'smtp') {
    errors.push('EMAIL_DELIVERY_MODE must be "smtp" in production');
  }

  const smtpFields = [
    source.SMTP_HOST,
    source.SMTP_PORT,
    source.SMTP_USER,
    source.SMTP_PASS,
    source.EMAIL_FROM,
    source.SMTP_SECURE,
    source.SMTP_REQUIRE_TLS,
  ];
  if (mode === 'disabled' && smtpFields.some(present)) {
    errors.push('SMTP settings must not be present when EMAIL_DELIVERY_MODE is disabled');
  }

  const transportVerifyTimeoutMs = parseInteger(
    'EMAIL_TRANSPORT_VERIFY_TIMEOUT_MS',
    source.EMAIL_TRANSPORT_VERIFY_TIMEOUT_MS,
    10_000,
    1_000,
    30_000,
    errors
  );

  if (mode === 'disabled') {
    return {
      config: { mode, transportVerifyTimeoutMs },
      errors,
    };
  }

  const host = source.SMTP_HOST?.trim() || '';
  const port = parseInteger('SMTP_PORT', source.SMTP_PORT, 587, 1, 65_535, errors);
  const user = source.SMTP_USER?.trim();
  const pass = source.SMTP_PASS;
  const from = source.EMAIL_FROM?.trim();
  const otpPepper = source.EMAIL_OTP_PEPPER;
  const secure = parseBoolean('SMTP_SECURE', source.SMTP_SECURE, port === 465, errors);
  const requireTls = parseBoolean('SMTP_REQUIRE_TLS', source.SMTP_REQUIRE_TLS, true, errors);

  if (!host) errors.push('SMTP_HOST is required when EMAIL_DELIVERY_MODE=smtp');
  if (!from) {
    errors.push('EMAIL_FROM is required when EMAIL_DELIVERY_MODE=smtp');
  } else if (!EMAIL_ADDRESS_PATTERN.test(from)) {
    errors.push('EMAIL_FROM must be a valid email address');
  }
  if (!otpPepper || otpPepper.length < 32) {
    errors.push('EMAIL_OTP_PEPPER must contain at least 32 characters when EMAIL_DELIVERY_MODE=smtp');
  }
  if (present(user) !== present(pass)) {
    errors.push('SMTP_USER and SMTP_PASS must be configured together');
  }
  if (nodeEnv === 'production' && (!user || !pass)) {
    errors.push('SMTP_USER and SMTP_PASS are required in production');
  }
  if (nodeEnv === 'production' && !secure && !requireTls) {
    errors.push('Production SMTP must enable SMTP_SECURE or SMTP_REQUIRE_TLS');
  }

  return {
    config: {
      mode,
      from,
      otpPepper,
      transportVerifyTimeoutMs,
      smtp: {
        host,
        port,
        user,
        pass,
        secure,
        requireTls,
      },
    },
    errors,
  };
}
