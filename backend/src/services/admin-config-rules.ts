import { Prisma } from '@prisma/client';
import { Errors } from '../utils/errors';

export const ADMIN_MANAGED_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'jobs.enabled',
  'interview.maxTurns',
  'interview.softTarget',
  'interview.turnIntervalMs',
  'interview.startRateLimit',
  'interview.dailySessionLimit',
  'admin.alert.rules',
  'feature.flags',
]);

function toBoundedInteger(value: unknown, options: { keyLabel: string; min: number; max: number }) {
  const { keyLabel, min, max } = options;
  const parsed = typeof value === 'number'
    ? value
    : (typeof value === 'string' ? Number(value) : Number.NaN);
  if (!Number.isFinite(parsed)) {
    throw Errors.VALIDATION_ERROR(`${keyLabel} 必須為數字`);
  }
  const normalized = Math.floor(parsed);
  if (normalized < min || normalized > max) {
    throw Errors.VALIDATION_ERROR(`${keyLabel} 必須介於 ${min} ~ ${max}`);
  }
  return normalized;
}

function toStrictBoolean(value: unknown, keyLabel: string) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  throw Errors.VALIDATION_ERROR(`${keyLabel} 必須為 boolean`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

type AlertSeverity = 'info' | 'warning' | 'critical';
type NormalizedAlertRule = {
  key: string;
  threshold: number;
  enabled: boolean;
  severity: AlertSeverity;
  windowMinutes: number;
};

function normalizeAlertRule(input: unknown, index: number): NormalizedAlertRule {
  if (!isPlainObject(input)) {
    throw Errors.VALIDATION_ERROR(`admin.alert.rules[${index}] 必須為 object`);
  }
  const key = typeof input.key === 'string' ? input.key.trim() : '';
  if (!key) {
    throw Errors.VALIDATION_ERROR(`admin.alert.rules[${index}].key 為必填`);
  }
  if (key.length > 80) {
    throw Errors.VALIDATION_ERROR(`admin.alert.rules[${index}].key 長度不可超過 80`);
  }

  const thresholdRaw = Number(input.threshold);
  if (!Number.isFinite(thresholdRaw) || thresholdRaw < 0) {
    throw Errors.VALIDATION_ERROR(`admin.alert.rules[${index}].threshold 必須為 >= 0 的數字`);
  }

  const enabledRaw = input.enabled;
  const enabled = enabledRaw === undefined ? true : toStrictBoolean(enabledRaw, `admin.alert.rules[${index}].enabled`);

  const severityRaw = typeof input.severity === 'string' ? input.severity.trim().toLowerCase() : '';
  const severity: AlertSeverity = severityRaw === 'info' || severityRaw === 'critical' ? severityRaw : 'warning';

  const windowMinutesRaw = input.windowMinutes === undefined ? 15 : Number(input.windowMinutes);
  if (!Number.isFinite(windowMinutesRaw)) {
    throw Errors.VALIDATION_ERROR(`admin.alert.rules[${index}].windowMinutes 必須為數字`);
  }
  const windowMinutes = Math.floor(windowMinutesRaw);
  if (windowMinutes < 1 || windowMinutes > 1440) {
    throw Errors.VALIDATION_ERROR(`admin.alert.rules[${index}].windowMinutes 必須介於 1 ~ 1440`);
  }

  return {
    key,
    threshold: Number(thresholdRaw.toFixed(6)),
    enabled,
    severity,
    windowMinutes,
  };
}

function normalizeFeatureFlags(value: unknown): Record<string, string | number | boolean> {
  if (!isPlainObject(value)) throw Errors.VALIDATION_ERROR('feature.flags 必須為 object');
  const keys = Object.keys(value);
  if (keys.length > 200) throw Errors.VALIDATION_ERROR('feature.flags keys 不可超過 200');

  const normalized: Record<string, string | number | boolean> = {};
  for (const rawKey of keys) {
    const key = rawKey.trim();
    if (!key) throw Errors.VALIDATION_ERROR('feature.flags key 不可為空字串');
    if (key.length > 80) throw Errors.VALIDATION_ERROR(`feature.flags key 長度不可超過 80: ${key}`);
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key)) {
      throw Errors.VALIDATION_ERROR(`feature.flags key 格式不合法: ${key}`);
    }

    const rawValue = value[rawKey];
    if (typeof rawValue === 'boolean' || typeof rawValue === 'string') {
      normalized[key] = rawValue;
      continue;
    }
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      normalized[key] = Number(rawValue.toFixed(6));
      continue;
    }
    throw Errors.VALIDATION_ERROR(`feature.flags.${key} 只允許 string/number/boolean`);
  }
  return normalized;
}

export function normalizeManagedConfigValue(key: string, value: unknown): Prisma.InputJsonValue {
  switch (key) {
    case 'jobs.enabled':
      return toStrictBoolean(value, key);
    case 'interview.maxTurns':
      return toBoundedInteger(value, { keyLabel: key, min: 5, max: 100 });
    case 'interview.softTarget':
      return toBoundedInteger(value, { keyLabel: key, min: 3, max: 50 });
    case 'interview.turnIntervalMs':
      return toBoundedInteger(value, { keyLabel: key, min: 0, max: 300000 });
    case 'interview.startRateLimit':
      return toBoundedInteger(value, { keyLabel: key, min: 1, max: 20 });
    case 'interview.dailySessionLimit':
      return toBoundedInteger(value, { keyLabel: key, min: 1, max: 50 });
    case 'admin.alert.rules':
      if (!Array.isArray(value)) throw Errors.VALIDATION_ERROR(`${key} 必須為 array`);
      if (value.length > 100) throw Errors.VALIDATION_ERROR(`${key} 長度不可超過 100`);
      return value.map((item, index) => normalizeAlertRule(item, index)) as Prisma.InputJsonValue;
    case 'feature.flags':
      return normalizeFeatureFlags(value) as Prisma.InputJsonValue;
    default:
      return value as Prisma.InputJsonValue;
  }
}

type CrossConfigRule = {
  key: 'interview.maxTurns' | 'interview.softTarget';
  peerKey: 'interview.maxTurns' | 'interview.softTarget';
  peerFallback: number;
  isValid: (current: number, peer: number) => boolean;
  message: string;
};

const CROSS_CONFIG_RULES: CrossConfigRule[] = [
  {
    key: 'interview.maxTurns',
    peerKey: 'interview.softTarget',
    peerFallback: 10,
    isValid: (current, peer) => current >= peer,
    message: 'interview.maxTurns 不可小於 interview.softTarget',
  },
  {
    key: 'interview.softTarget',
    peerKey: 'interview.maxTurns',
    peerFallback: 30,
    isValid: (current, peer) => current <= peer,
    message: 'interview.softTarget 不可大於 interview.maxTurns',
  },
];

export async function validateCrossManagedConfigRules(
  key: string,
  normalizedValue: Prisma.InputJsonValue,
  getNumberConfig: (key: string, fallback: number) => Promise<number>,
  fallbacks: { maxTurns: number; softTarget: number }
) {
  const rule = CROSS_CONFIG_RULES.find((item) => item.key === key);
  if (!rule) return;
  const current = normalizedValue as number;
  const peerFallback = rule.peerKey === 'interview.maxTurns' ? fallbacks.maxTurns : fallbacks.softTarget;
  const peer = await getNumberConfig(rule.peerKey, peerFallback);
  if (!rule.isValid(current, peer)) {
    throw Errors.VALIDATION_ERROR(rule.message);
  }
}
