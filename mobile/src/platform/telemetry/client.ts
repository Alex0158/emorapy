import { getRuntimeConfig } from '@/src/config/runtime';
import { appApiClient } from '@/src/platform/api/client';
import { ExportResultCode } from '@opentelemetry/core';
import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { Platform } from 'react-native';

export type TelemetrySeverity = 'info' | 'warning' | 'error';

export interface SafeTelemetryEvent {
  name: string;
  severity?: TelemetrySeverity;
  requestId?: string;
  route?: string;
  context?: Record<string, string | number | boolean | null>;
}

export type TelemetrySpanStatus = 'ok' | 'error' | 'cancelled';

export interface TelemetrySpanOptions {
  name: string;
  route?: string;
  context?: Record<string, string | number | boolean | null>;
}

interface EndpointTelemetryEvent {
  name: string;
  severity: TelemetrySeverity;
  request_id?: string;
  route?: string;
  app_version: string;
  build_number: string;
  platform: 'ios' | 'android' | 'web';
  context?: Record<string, string | number | boolean | null>;
}

interface OtlpAttributeValue {
  stringValue?: string;
  intValue?: number;
  doubleValue?: number;
  boolValue?: boolean;
}

interface OtlpKeyValue {
  key: string;
  value: OtlpAttributeValue;
}

const sensitiveKeyPattern = /(authorization|password|secret|session|token)/i;
const appTracerName = 'emorapy.mobile.app';

let appTracerProvider: BasicTracerProvider | null = null;
let appTracer: ReturnType<typeof trace.getTracer> | null = null;

export function sanitizeTelemetryContext(
  context?: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> | undefined {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[redacted]' : value,
    ])
  );
}

function toOtelAttributes(
  context?: Record<string, string | number | boolean | null>
): Attributes | undefined {
  const sanitized = sanitizeTelemetryContext(context);
  if (!sanitized) return undefined;
  return Object.fromEntries(
    Object.entries(sanitized)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => [key, value as string | number | boolean])
  );
}

function hrTimeToUnixNanoString(time: unknown): string | undefined {
  const tuple = Array.isArray(time) ? time : [];
  const seconds = Number(tuple[0] ?? 0);
  const nanoseconds = Number(tuple[1] ?? 0);
  if (!Number.isFinite(seconds) || !Number.isFinite(nanoseconds)) return undefined;
  return (BigInt(Math.max(0, Math.trunc(seconds))) * 1_000_000_000n +
    BigInt(Math.max(0, Math.trunc(nanoseconds)))).toString();
}

function spanStatusLabel(span: ReadableSpan): TelemetrySpanStatus {
  const explicitStatus = span.attributes.spanStatus;
  if (explicitStatus === 'ok' || explicitStatus === 'error' || explicitStatus === 'cancelled') {
    return explicitStatus;
  }
  if (span.status.code === SpanStatusCode.ERROR) return 'error';
  if (span.status.code === SpanStatusCode.OK) return 'ok';
  return 'cancelled';
}

function sanitizeSpanAttributeContext(span: ReadableSpan): Record<string, string | number | boolean | null> {
  const context = sanitizeTelemetryContext(
    span.attributes as Record<string, string | number | boolean | null>
  ) ?? {};
  const { route: _route, spanStatus: _spanStatus, ...safeContext } = context;
  return safeContext;
}

function toOtlpAttributeValue(value: string | number | boolean | null): OtlpAttributeValue {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  }
  return { stringValue: String(value ?? '') };
}

function toOtlpAttributes(
  context: Record<string, string | number | boolean | null>
): OtlpKeyValue[] {
  return Object.entries(context)
    .filter(([key]) => key.trim().length > 0)
    .slice(0, 30)
    .map(([key, value]) => ({
      key: key.slice(0, 80),
      value: toOtlpAttributeValue(value),
    }));
}

function buildOtlpTracePayload(spans: ReadableSpan[]) {
  const runtime = getRuntimeConfig();

  return {
    resourceSpans: [
      {
        resource: {
          attributes: toOtlpAttributes({
            'service.name': 'emorapy-mobile',
            'service.version': runtime.appVersion,
            'app.version': runtime.appVersion,
            'app.build_number': runtime.buildNumber ?? 'dev',
            'app.platform': Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
          }),
        },
        scopeSpans: [
          {
            scope: { name: appTracerName },
            spans: spans.map((span) => {
              const spanStatus = spanStatusLabel(span);
              const route = span.attributes.route;
              const context = {
                ...sanitizeSpanAttributeContext(span),
                ...(typeof route === 'string' ? { route } : {}),
              };
              return {
                traceId: span.spanContext().traceId,
                spanId: span.spanContext().spanId,
                name: span.name,
                startTimeUnixNano: hrTimeToUnixNanoString(span.startTime),
                endTimeUnixNano: hrTimeToUnixNanoString(span.endTime),
                attributes: toOtlpAttributes(context),
                status: {
                  code: spanStatus === 'error' ? 2 : spanStatus === 'ok' ? 1 : 0,
                },
              };
            }),
          },
        ],
      },
    ],
  };
}

class SafeTelemetrySpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: { code: ExportResultCode }) => void): void {
    void submitOtlpSpans(spans)
      .then(() => resultCallback({ code: ExportResultCode.SUCCESS }))
      .catch(() => resultCallback({ code: ExportResultCode.FAILED }));
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

export function initializeOpenTelemetryProvider(): BasicTracerProvider {
  if (appTracerProvider) return appTracerProvider;

  appTracerProvider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(new SafeTelemetrySpanExporter())],
    spanLimits: {
      attributeCountLimit: 24,
      attributeValueLengthLimit: 180,
      eventCountLimit: 4,
    },
  });
  trace.setGlobalTracerProvider(appTracerProvider);
  appTracer = appTracerProvider.getTracer(appTracerName);
  return appTracerProvider;
}

function getAppTracer() {
  initializeOpenTelemetryProvider();
  if (!appTracer) appTracer = trace.getTracer(appTracerName);
  return appTracer;
}

export function captureTelemetry(event: SafeTelemetryEvent): void {
  const runtime = getRuntimeConfig();
  const sanitizedContext = sanitizeTelemetryContext(event.context);
  const payload = {
    ...event,
    context: sanitizedContext,
    severity: event.severity ?? 'info',
    appVersion: runtime.appVersion,
    buildNumber: runtime.buildNumber ?? 'dev',
    at: new Date().toISOString(),
  };

  if (event.severity === 'error') {
    console.error('[emorapy-app-telemetry]', payload);
  } else {
    console.info('[emorapy-app-telemetry]', payload);
  }

  void submitTelemetryEvent({
    name: event.name,
    severity: event.severity ?? 'info',
    request_id: event.requestId,
    route: event.route,
    app_version: runtime.appVersion,
    build_number: runtime.buildNumber ?? 'dev',
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    context: sanitizedContext,
  });
}

function readErrorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.slice(0, 80);
  }
  return typeof error === 'string' ? 'StringError' : 'UnknownError';
}

export function startTelemetrySpan(options: TelemetrySpanOptions): {
  end(status?: TelemetrySpanStatus, context?: Record<string, string | number | boolean | null>): void;
  fail(error?: unknown, context?: Record<string, string | number | boolean | null>): void;
} {
  const span = getAppTracer().startSpan(options.name, {
    attributes: {
      ...toOtelAttributes(options.context),
      ...(options.route ? { route: options.route } : {}),
    },
  });
  let ended = false;

  function end(
    status: TelemetrySpanStatus = 'ok',
    context?: Record<string, string | number | boolean | null>
  ) {
    if (ended) return;
    ended = true;
    const attributes = toOtelAttributes(context);
    if (attributes) span.setAttributes(attributes);
    span.setAttribute('spanStatus', status);
    span.setStatus({
      code: status === 'error' ? SpanStatusCode.ERROR : status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.UNSET,
    });
    span.end();
  }

  return {
    end,
    fail(error?: unknown, context?: Record<string, string | number | boolean | null>) {
      end('error', {
        ...context,
        errorName: readErrorName(error),
      });
    },
  };
}

export function __resetTelemetryClientForTests() {
  trace.disable();
  appTracerProvider = null;
  appTracer = null;
}

async function submitTelemetryEvent(event: EndpointTelemetryEvent): Promise<void> {
  try {
    await appApiClient.instance.post('/telemetry/events', { events: [event] });
  } catch (error) {
    console.warn('[emorapy-app-telemetry:send-failed]', {
      name: event.name,
      severity: event.severity,
      hasRequestId: Boolean(event.request_id),
    });
  }
}

async function submitOtlpSpans(spans: ReadableSpan[]): Promise<void> {
  try {
    await appApiClient.instance.post('/telemetry/otlp/v1/traces', buildOtlpTracePayload(spans));
  } catch (error) {
    console.warn('[emorapy-app-otel:send-failed]', {
      spanCount: spans.length,
    });
    throw error;
  }
}
