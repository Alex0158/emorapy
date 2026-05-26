import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';
import logger from '../config/logger';

export type AppTelemetrySeverity = 'info' | 'warning' | 'error';

export interface AppTelemetryEventInput {
  name: string;
  severity?: AppTelemetrySeverity;
  route?: string | null;
  request_id?: string | null;
  app_version?: string | null;
  platform?: 'ios' | 'android' | 'web' | null;
  build_number?: string | null;
  context?: Record<string, unknown> | null;
}

export interface AppTelemetryMeta {
  userId?: string;
  sessionId?: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface RecordedAppTelemetryEvent {
  name: string;
  severity: AppTelemetrySeverity;
  route: string | null;
  request_id: string | null;
  app_version: string | null;
  platform: 'ios' | 'android' | 'web' | null;
  build_number: string | null;
  context?: Record<string, string | number | boolean | null>;
}

export interface AppTelemetryReportOptions {
  days?: number;
  limit?: number;
  severity?: AppTelemetrySeverity;
  platform?: 'ios' | 'android' | 'web';
}

interface OtlpKeyValue {
  key?: string;
  value?: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: string | number;
    boolValue?: boolean;
  };
}

interface OtlpSpanInput {
  traceId?: string;
  spanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpKeyValue[];
  status?: {
    code?: string | number;
  };
}

interface OtlpScopeSpanInput {
  scope?: {
    name?: string;
  };
  spans?: OtlpSpanInput[];
}

interface OtlpResourceSpanInput {
  resource?: {
    attributes?: OtlpKeyValue[];
  };
  scopeSpans?: OtlpScopeSpanInput[];
}

export interface AppTelemetryOtlpTraceInput {
  resourceSpans?: OtlpResourceSpanInput[];
}

const sensitiveKeyPattern = /(authorization|cookie|jwt|password|secret|session|token)/i;
const MAX_CONTEXT_KEYS = 30;
const MAX_CONTEXT_VALUE_LENGTH = 500;
const MAX_OTLP_SPANS_PER_REQUEST = 50;
const APP_TELEMETRY_RETENTION_DAYS = 30;
const CRASH_EVENT_NAMES = [
  'app_error_boundary',
  'app_js_fatal',
  'app_unhandled_promise',
  'app_native_crash',
];

function normalizeNullableString(input: unknown, maxLength: number): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return value.length > 0 ? value.slice(0, maxLength) : null;
}

function normalizeSeverity(input: unknown): AppTelemetrySeverity {
  return input === 'warning' || input === 'error' ? input : 'info';
}

function normalizeContextValue(input: unknown): string | number | boolean | null {
  if (input === null || typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (typeof input === 'string') {
    return input.slice(0, MAX_CONTEXT_VALUE_LENGTH);
  }
  return '[unsupported]';
}

export function sanitizeAppTelemetryContext(
  context?: Record<string, unknown> | null
): Record<string, string | number | boolean | null> | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }

  const sanitized = Object.entries(context)
    .slice(0, MAX_CONTEXT_KEYS)
    .map(([key, value]) => {
      const normalizedKey = key.slice(0, 80);
      return [
        normalizedKey,
        sensitiveKeyPattern.test(normalizedKey) ? '[redacted]' : normalizeContextValue(value),
      ] as const;
    });

  return sanitized.length > 0 ? Object.fromEntries(sanitized) : undefined;
}

function normalizeEvent(input: AppTelemetryEventInput): RecordedAppTelemetryEvent {
  return {
    name: input.name.trim().slice(0, 80),
    severity: normalizeSeverity(input.severity),
    route: normalizeNullableString(input.route, 200),
    request_id: normalizeNullableString(input.request_id, 120),
    app_version: normalizeNullableString(input.app_version, 40),
    platform: input.platform === 'ios' || input.platform === 'android' || input.platform === 'web'
      ? input.platform
      : null,
    build_number: normalizeNullableString(input.build_number, 40),
    ...(sanitizeAppTelemetryContext(input.context)
      ? { context: sanitizeAppTelemetryContext(input.context) }
      : {}),
  };
}

function normalizeOtlpValue(attribute?: OtlpKeyValue): string | number | boolean | null {
  const value = attribute?.value;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.stringValue === 'string') return value.stringValue.slice(0, MAX_CONTEXT_VALUE_LENGTH);
  if (typeof value.boolValue === 'boolean') return value.boolValue;
  if (typeof value.intValue === 'number') return Number.isFinite(value.intValue) ? value.intValue : null;
  if (typeof value.doubleValue === 'number') return Number.isFinite(value.doubleValue) ? value.doubleValue : null;
  if (typeof value.intValue === 'string') {
    const numeric = Number(value.intValue);
    return Number.isFinite(numeric) ? numeric : value.intValue.slice(0, MAX_CONTEXT_VALUE_LENGTH);
  }
  if (typeof value.doubleValue === 'string') {
    const numeric = Number(value.doubleValue);
    return Number.isFinite(numeric) ? numeric : value.doubleValue.slice(0, MAX_CONTEXT_VALUE_LENGTH);
  }
  return null;
}

function normalizeOtlpAttributes(attributes?: OtlpKeyValue[]): Record<string, string | number | boolean | null> {
  if (!Array.isArray(attributes)) return {};

  return Object.fromEntries(
    attributes
      .slice(0, MAX_CONTEXT_KEYS)
      .filter((attribute) => typeof attribute.key === 'string' && attribute.key.trim().length > 0)
      .map((attribute) => {
        const key = String(attribute.key).trim().slice(0, 80);
        const value = normalizeOtlpValue(attribute);
        return [key, sensitiveKeyPattern.test(key) ? '[redacted]' : value] as const;
      })
  );
}

function readStringAttribute(
  attributes: Record<string, string | number | boolean | null>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeOtlpPlatform(value: string | null): 'ios' | 'android' | 'web' | null {
  return value === 'ios' || value === 'android' || value === 'web' ? value : null;
}

function normalizeOtlpStatus(status?: OtlpSpanInput['status']): 'ok' | 'error' | 'cancelled' {
  const code = status?.code;
  if (code === 2 || code === '2' || code === 'STATUS_CODE_ERROR') return 'error';
  if (code === 1 || code === '1' || code === 'STATUS_CODE_OK') return 'ok';
  return 'cancelled';
}

function parseUnixNano(input: unknown): bigint | null {
  if (typeof input === 'number' && Number.isFinite(input) && input >= 0) {
    return BigInt(Math.trunc(input));
  }
  if (typeof input === 'string' && /^\d+$/.test(input)) {
    return BigInt(input);
  }
  return null;
}

function durationMs(startTimeUnixNano?: string | number, endTimeUnixNano?: string | number): number | null {
  const start = parseUnixNano(startTimeUnixNano);
  const end = parseUnixNano(endTimeUnixNano);
  if (start === null || end === null || end < start) return null;
  const ms = Number((end - start) / 1_000_000n);
  return Number.isFinite(ms) ? Math.min(ms, 86_400_000) : null;
}

function normalizeOtlpTraceId(input?: string): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return /^[a-fA-F0-9]{16,64}$/.test(value) ? value.slice(0, 64) : null;
}

function normalizeOtlpSpanId(input?: string): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return /^[a-fA-F0-9]{8,32}$/.test(value) ? value.slice(0, 32) : null;
}

function otlpTracesToTelemetryEvents(payload: AppTelemetryOtlpTraceInput): AppTelemetryEventInput[] {
  const events: AppTelemetryEventInput[] = [];

  for (const resourceSpan of payload.resourceSpans ?? []) {
    const resourceAttributes = normalizeOtlpAttributes(resourceSpan.resource?.attributes);
    const appVersion = readStringAttribute(resourceAttributes, ['app.version', 'app_version', 'service.version']);
    const buildNumber = readStringAttribute(resourceAttributes, ['app.build_number', 'build_number']);
    const platform = normalizeOtlpPlatform(readStringAttribute(resourceAttributes, ['app.platform', 'platform']));

    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      const instrumentationScope = scopeSpan.scope?.name?.trim().slice(0, 120) || 'unknown';
      for (const span of scopeSpan.spans ?? []) {
        if (events.length >= MAX_OTLP_SPANS_PER_REQUEST) return events;
        const spanAttributes = normalizeOtlpAttributes(span.attributes);
        const spanStatus = normalizeOtlpStatus(span.status);
        const route = readStringAttribute(spanAttributes, ['route']);
        const duration = durationMs(span.startTimeUnixNano, span.endTimeUnixNano);
        const traceId = normalizeOtlpTraceId(span.traceId);
        const spanId = normalizeOtlpSpanId(span.spanId);
        const { route: _route, ...safeSpanAttributes } = spanAttributes;

        events.push({
          name: 'app_otel_span',
          severity: spanStatus === 'error' ? 'error' : spanStatus === 'cancelled' ? 'warning' : 'info',
          route,
          app_version: appVersion,
          platform,
          build_number: buildNumber,
          context: {
            ...safeSpanAttributes,
            otlpCollector: true,
            spanName: span.name?.trim().slice(0, 160) || 'unknown',
            spanStatus,
            instrumentationScope,
            ...(traceId ? { traceId } : {}),
            ...(spanId ? { spanId } : {}),
            ...(duration !== null ? { durationMs: duration } : {}),
          },
        });
      }
    }
  }

  return events;
}

function hashIdentifier(value?: string): string | null {
  if (!value) return null;
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(value)
    .digest('hex');
}

function toCountMap<K extends string>(
  rows: Array<{ _count: { _all: number } } & { [P in K]: string | null }>,
  key: K
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? 'unknown');
    acc[value] = row._count._all;
    return acc;
  }, {});
}

export class AppTelemetryService {
  async recordOtlpTraces(payload: AppTelemetryOtlpTraceInput, meta: AppTelemetryMeta): Promise<{
    acceptedCount: number;
    persistedCount: number;
    severities: Record<AppTelemetrySeverity, number>;
  }> {
    return this.recordEvents(otlpTracesToTelemetryEvents(payload), meta);
  }

  async recordEvents(events: AppTelemetryEventInput[], meta: AppTelemetryMeta): Promise<{
    acceptedCount: number;
    persistedCount: number;
    severities: Record<AppTelemetrySeverity, number>;
  }> {
    const normalized = events.map(normalizeEvent);
    const severities = normalized.reduce<Record<AppTelemetrySeverity, number>>(
      (acc, event) => {
        acc[event.severity] += 1;
        return acc;
      },
      { info: 0, warning: 0, error: 0 }
    );

    if (normalized.length > 0) {
      logger.info('App telemetry events accepted', {
        count: normalized.length,
        eventNames: normalized.map((event) => event.name),
        severities,
        userId: meta.userId,
        hasSessionId: Boolean(meta.sessionId),
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        events: normalized,
      });
    }

    let persistedCount = 0;
    if (normalized.length > 0) {
      try {
        const result = await prisma.appTelemetryEvent.createMany({
          data: normalized.map((event) => ({
            name: event.name,
            severity: event.severity,
            route: event.route,
            request_id: event.request_id,
            app_version: event.app_version,
            platform: event.platform,
            build_number: event.build_number,
            context: event.context as Prisma.InputJsonValue | undefined,
            user_id: meta.userId,
            session_hash: hashIdentifier(meta.sessionId),
          })),
        });
        persistedCount = result.count;
      } catch (error) {
        logger.warn('App telemetry persistence skipped', {
          error: error instanceof Error ? error.message : String(error),
          acceptedCount: normalized.length,
          requestId: meta.requestId,
        });
      }
    }

    return {
      acceptedCount: normalized.length,
      persistedCount,
      severities,
    };
  }

  async getAdminReport(options: AppTelemetryReportOptions = {}) {
    const days = Math.min(Math.max(Math.floor(options.days ?? 7), 1), 90);
    const limit = Math.min(Math.max(Math.floor(options.limit ?? 20), 1), 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where: Prisma.AppTelemetryEventWhereInput = {
      created_at: { gte: since },
      ...(options.severity ? { severity: options.severity } : {}),
      ...(options.platform ? { platform: options.platform } : {}),
    };
    const crashWhere: Prisma.AppTelemetryEventWhereInput = {
      ...where,
      name: { in: CRASH_EVENT_NAMES },
      session_hash: { not: null },
    };

    const [
      totalEvents,
      bySeverityRows,
      byPlatformRows,
      topEventRows,
      recentEvents,
      sessionRows,
      crashSessionRows,
    ] = await Promise.all([
      prisma.appTelemetryEvent.count({ where }),
      prisma.appTelemetryEvent.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      }),
      prisma.appTelemetryEvent.groupBy({
        by: ['platform'],
        where,
        _count: { _all: true },
      }),
      prisma.appTelemetryEvent.groupBy({
        by: ['name'],
        where,
        _count: { _all: true },
        orderBy: { _count: { name: 'desc' } },
        take: limit,
      }),
      prisma.appTelemetryEvent.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          severity: true,
          route: true,
          request_id: true,
          app_version: true,
          platform: true,
          build_number: true,
          session_hash: true,
          created_at: true,
        },
      }),
      prisma.appTelemetryEvent.groupBy({
        by: ['session_hash'],
        where: {
          ...where,
          session_hash: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.appTelemetryEvent.groupBy({
        by: ['session_hash'],
        where: crashWhere,
        _count: { _all: true },
      }),
    ]);

    const bySeverity = toCountMap(bySeverityRows, 'severity');
    const uniqueSessionCount = sessionRows.length;
    const crashSessionCount = crashSessionRows.length;
    const errorEvents = bySeverity.error ?? 0;

    return {
      days,
      since: since.toISOString(),
      retentionDays: APP_TELEMETRY_RETENTION_DAYS,
      filters: {
        severity: options.severity ?? null,
        platform: options.platform ?? null,
      },
      totals: {
        events: totalEvents,
        infoEvents: bySeverity.info ?? 0,
        warningEvents: bySeverity.warning ?? 0,
        errorEvents,
        errorRate: totalEvents > 0 ? Number((errorEvents / totalEvents).toFixed(4)) : 0,
        uniqueSessions: uniqueSessionCount,
        crashSessions: crashSessionCount,
        crashFreeSessionRate:
          uniqueSessionCount > 0
            ? Number(((uniqueSessionCount - crashSessionCount) / uniqueSessionCount).toFixed(4))
            : null,
      },
      bySeverity,
      byPlatform: toCountMap(byPlatformRows, 'platform'),
      topEvents: topEventRows.map((row) => ({
        name: row.name,
        count: row._count._all,
      })),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        name: event.name,
        severity: event.severity,
        route: event.route,
        requestId: event.request_id,
        appVersion: event.app_version,
        platform: event.platform,
        buildNumber: event.build_number,
        hasSession: Boolean(event.session_hash),
        createdAt: event.created_at.toISOString(),
      })),
    };
  }

  async cleanupExpiredEvents(retentionDays = APP_TELEMETRY_RETENTION_DAYS) {
    const normalizedRetentionDays = Math.min(Math.max(Math.floor(retentionDays), 1), 365);
    const cutoff = new Date(Date.now() - normalizedRetentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.appTelemetryEvent.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    return {
      deletedCount: result.count,
      cutoff: cutoff.toISOString(),
      retentionDays: normalizedRetentionDays,
    };
  }
}

export const appTelemetryService = new AppTelemetryService();
