import logger from '../../config/logger';
import { Errors } from '../../utils/errors';
import {
  MediaProvider,
  MediaProviderAsset,
  MediaProviderBillingUnit,
  MediaProviderCostSummary,
  MediaProviderGenerationResult,
  MediaProviderImageInput,
  MediaProviderPricing,
  MediaProviderRuntimeConfig,
  MediaProviderTestResult,
  MediaProviderType,
  MediaProviderVideoInput,
} from './types';

type HttpMethod = 'GET' | 'POST';

type HttpPayload = {
  baseUrl: string;
  endpoint: string;
  method: HttpMethod;
  apiKey: string;
  payload?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const URL_PATH_JOIN_ERROR = 'Invalid base URL or endpoint';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export abstract class BaseMediaProvider implements MediaProvider {
  public readonly isEnabledByDefault = true;

  protected constructor(
    public readonly providerKey: string,
    public readonly providerType: MediaProviderType,
    public readonly displayName: string,
    public readonly defaultBaseUrl: string,
    public readonly pricing: MediaProviderPricing
  ) {
    this.pricing.unitPriceUsd = Number.isFinite(pricing.unitPriceUsd) ? pricing.unitPriceUsd : 0;
  }

  abstract testConnection(
    config: MediaProviderRuntimeConfig,
    input?: { model?: string; prompt?: string; count?: number; durationSeconds?: number; sourceImageUrl?: string }
  ): Promise<MediaProviderTestResult>;

  abstract generateImages(
    input: MediaProviderImageInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult>;

  abstract generateVideos(
    input: MediaProviderVideoInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult>;

  estimateCost(
    input: { count?: number; durationSeconds?: number },
    pricingOverride?: MediaProviderPricing
  ): MediaProviderCostSummary {
    const resolvedPricing = pricingOverride || this.pricing;
    const billingUnit: MediaProviderBillingUnit = resolvedPricing.billingUnit;
    const unitPriceUsd = Number.isFinite(resolvedPricing.unitPriceUsd) ? resolvedPricing.unitPriceUsd : 0;
    const unitCount = billingUnit === 'image'
      ? Math.max(1, Math.trunc(input.count ?? 1))
      : Math.max(1, Math.trunc(input.durationSeconds ?? 1));
    return {
      billingUnit,
      unitPriceUsd,
      unitCount,
      totalCostUsd: Number((unitCount * unitPriceUsd).toFixed(6)),
    };
  }

  protected async requestJson<T>(payload: HttpPayload): Promise<{ body: T; status: number; rawText: string }> {
    const { baseUrl, endpoint, method, apiKey, payload: bodyPayload, headers = {}, timeoutMs } = payload;
    const url = this.joinUrl(baseUrl, endpoint);
    const timeout = Math.min(Math.max(Number(timeoutMs ?? 12000), 500), 120000);
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
      ...headers,
    };
    if (method === 'POST') {
      requestHeaders['Content-Type'] = 'application/json';
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const start = Date.now();
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
        signal: controller.signal,
      });

      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      const parsedBody = contentType.includes('application/json')
        ? this.parseJsonSafely(rawText)
        : rawText;

      if (!response.ok) {
        const message = this.extractMessageFromBody(parsedBody) || `HTTP ${response.status}`;
        logger.warn('Media provider request failed', {
          provider: this.providerKey,
          method,
          endpoint,
          status: response.status,
          url,
          message,
          latencyMs: Date.now() - start,
        });
        throw this.mapStatusToError(response.status, message);
      }

      return { body: parsedBody as T, status: response.status, rawText };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 請求逾時`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  protected joinUrl(baseUrl: string, endpoint: string): string {
    if (!baseUrl || !endpoint) {
      throw Errors.VALIDATION_ERROR(URL_PATH_JOIN_ERROR);
    }
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    if (!normalizedBaseUrl.startsWith('http')) {
      throw Errors.VALIDATION_ERROR(URL_PATH_JOIN_ERROR);
    }
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${normalizedBaseUrl}${normalizedEndpoint}`;
  }

  protected getTimeout(config: MediaProviderRuntimeConfig, override?: number): number {
    const resolved = typeof override === 'number' ? override : (config.timeoutMs as number | undefined);
    if (typeof resolved !== 'number' || !Number.isFinite(resolved)) return 12000;
    return Math.min(Math.max(Math.trunc(resolved), 500), 120000);
  }

  protected parseJsonSafely(raw: string): unknown {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  protected extractMessageFromBody(body: unknown): string {
    if (!body) return '';
    if (typeof body === 'string') return body.slice(0, 200);
    if (isPlainObject(body)) {
      const candidates = ['message', 'error', 'detail', 'error_message', 'reason'];
      for (const key of candidates) {
        const value = body[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim().slice(0, 200);
        }
      }
      if (isPlainObject(body.error) && typeof body.error.message === 'string') {
        return body.error.message.trim().slice(0, 200);
      }
      if (typeof body.err === 'string' && body.err.trim()) {
        return body.err.trim().slice(0, 200);
      }
    }
    return '';
  }

  protected isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
  }

  protected mapPositiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.trunc(parsed);
    return normalized > 0 ? normalized : fallback;
  }

  protected extractUrlsFromUnknown(raw: unknown, limit = 8): string[] {
    const results: string[] = [];
    const walk = (value: unknown, depth: number): void => {
      if (results.length >= limit || depth > 4) return;
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        results.push(value);
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item, depth + 1);
          if (results.length >= limit) break;
        }
        return;
      }
      const object = value as Record<string, unknown>;
      for (const key of Object.keys(object)) {
        const nested = object[key];
        if (typeof nested === 'string' && /url/i.test(key) && /^https?:\/\//i.test(nested)) {
          results.push(nested);
          if (results.length >= limit) return;
        }
        walk(nested, depth + 1);
        if (results.length >= limit) break;
      }
    };
    walk(raw, 0);
    return [...new Set(results)].slice(0, limit);
  }

  protected toNormalizedProviderAssets(raw: unknown, type: MediaProviderType): MediaProviderAsset[] {
    const urls = this.extractUrlsFromUnknown(raw, 10);
    const assets = urls
      .filter((url): url is string => !!url)
      .map((url) => ({ url, type }));
    return assets;
  }

  protected toRequestPayload(base: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(base)) {
      const value = base[key];
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim().length === 0) continue;
      payload[key] = value;
    }
    return payload;
  }

  protected mapStatusToError(status: number, message: string): Error {
    if (status === 401 || status === 403) {
      return Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 授權失敗，請檢查 API Key`);
    }
    if (status === 429) {
      return Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 請求過頻，請稍後再試`);
    }
    if (status >= 500) {
      return Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 服務異常 (${status})`);
    }
    if (status === 400 || status === 422) {
      return Errors.VALIDATION_ERROR(`${this.displayName} 請求參數回傳錯誤: ${message || '請檢查請求參數'}`);
    }
    return Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 回應錯誤 (${status}): ${message || '未知錯誤'}`);
  }
}
