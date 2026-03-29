import {
  DEFAULT_MEDIA_PROVIDER_CATALOG,
  getCatalogItem as getCatalogItemFromConfig,
  KNOWN_MEDIA_PROVIDER_KEYS,
} from './media-providers/catalog';
import { mediaProviderRegistry } from './media-providers/registry';
import {
  MediaProvider,
  MediaProviderGenerationResult,
  MediaProviderImageInput,
  MediaProviderRuntimeConfig,
  MediaProviderVideoInput,
  ProviderTestInput,
  MediaProviderCatalogItem,
} from './media-providers/types';
import { Errors } from '../utils/errors';
import { systemConfigService } from './system-config.service';

interface MediaProviderRuntimeInput {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  sourceImageUrl?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toPositiveInteger(raw: unknown, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export class MediaProviderService {
  normalizeProviderKey(providerKey: string): string {
    return String(providerKey || '').trim().toLowerCase();
  }

  getCatalogItem(providerKey: string): MediaProviderCatalogItem {
    const catalogItem = getCatalogItemFromConfig(this.normalizeProviderKey(providerKey));
    if (!catalogItem) {
      throw Errors.NOT_FOUND('Provider catalog 不存在');
    }
    return catalogItem;
  }

  listCatalog(filters?: { providerType?: 'image' | 'video' }): MediaProviderCatalogItem[] {
    const target = filters?.providerType;
    const base = target
      ? DEFAULT_MEDIA_PROVIDER_CATALOG.filter((item) => item.providerType === target)
      : DEFAULT_MEDIA_PROVIDER_CATALOG;
    return base.map((item) => ({
      ...item,
      pricing: {
        billingUnit: item.pricing.billingUnit,
        unitPriceUsd: Number(item.pricing.unitPriceUsd) || 0,
      },
    }));
  }

  async testConnection(providerKey: string, input: ProviderTestInput): Promise<{
    providerKey: string;
    success: boolean;
    message: string;
    latencyMs: number;
    detail?: unknown;
  }> {
    const normalizedProviderKey = this.normalizeProviderKey(providerKey);
    const provider = this.getProvider(normalizedProviderKey);
    const runtimeConfig = await this.getRuntimeConfig(normalizedProviderKey, input);
    const result = await provider.testConnection(runtimeConfig, input);
    return {
      providerKey: provider.providerKey,
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
      detail: result.detail,
    };
  }

  async estimateCost(params: {
    providerKey: string;
    count?: number;
    durationSeconds?: number;
    pricingOverride?: {
      billingUnit: 'image' | 'second' | 'frame';
      unitPriceUsd: number;
    };
  }) {
    const normalizedProviderKey = this.normalizeProviderKey(params.providerKey);
    const provider = this.getProvider(normalizedProviderKey);
    const catalog = this.getCatalogItem(provider.providerKey);

    return provider.estimateCost(
      {
        count: params.count,
        durationSeconds: params.durationSeconds,
      },
      params.pricingOverride || catalog.pricing
    );
  }

  async generateImages(
    providerKey: string,
    input: MediaProviderImageInput,
    runtimeOverrides: Partial<MediaProviderRuntimeConfig> = {}
  ): Promise<MediaProviderGenerationResult> {
    const normalizedProviderKey = this.normalizeProviderKey(providerKey);
    const catalog = this.getCatalogItem(normalizedProviderKey);
    if (catalog.providerType !== 'image') {
      throw Errors.VALIDATION_ERROR(`Provider ${catalog.displayName} 不支援圖片生成`);
    }
    const provider = this.getProvider(normalizedProviderKey);
    const runtimeConfig = await this.getRuntimeConfig(normalizedProviderKey, runtimeOverrides);
    return provider.generateImages(input, runtimeConfig);
  }

  async generateVideos(
    providerKey: string,
    input: MediaProviderVideoInput,
    runtimeOverrides: Partial<MediaProviderRuntimeConfig> = {}
  ): Promise<MediaProviderGenerationResult> {
    const normalizedProviderKey = this.normalizeProviderKey(providerKey);
    const catalog = this.getCatalogItem(normalizedProviderKey);
    if (catalog.providerType !== 'video') {
      throw Errors.VALIDATION_ERROR(`Provider ${catalog.displayName} 不支援影片生成`);
    }
    const provider = this.getProvider(normalizedProviderKey);
    const runtimeConfig = await this.getRuntimeConfig(normalizedProviderKey, runtimeOverrides);
    return provider.generateVideos(input, runtimeConfig);
  }

  getProvider(providerKey: string): MediaProvider {
    const normalized = this.normalizeProviderKey(providerKey);
    const provider = mediaProviderRegistry.get(normalized);
    if (!provider) {
      if (KNOWN_MEDIA_PROVIDER_KEYS.has(normalized)) {
        throw Errors.NOT_FOUND(`Provider 實作尚未部署：${normalized}`);
      }
      throw Errors.NOT_FOUND('不支援的 providerKey');
    }
    return provider;
  }

  async isProviderConfigured(providerKey: string): Promise<boolean> {
    const normalizedProviderKey = this.normalizeProviderKey(providerKey);
    const key = `media.provider.${normalizedProviderKey}`;
    const value = await systemConfigService.getConfigValue<unknown>(key);
    return isPlainObject(value) && 'apiKey' in value;
  }

  private async getRuntimeConfig(
    providerKey: string,
    input: MediaProviderRuntimeInput
  ): Promise<MediaProviderRuntimeConfig> {
    const normalizedProviderKey = this.normalizeProviderKey(providerKey);
    const catalogItem = getCatalogItemFromConfig(normalizedProviderKey);
    if (!catalogItem) {
      throw Errors.NOT_FOUND('Provider catalog 不存在');
    }
    const configKey = `media.provider.${normalizedProviderKey}`;
    const stored = (await systemConfigService.getConfigValue<unknown>(configKey)) ?? {};

    const storedConfig = isPlainObject(stored) ? stored : {};
    const storedApiKey = this.getString(storedConfig.apiKey) || this.getString(storedConfig.api_key);
    const resolvedApiKey = this.getString(input.apiKey) || storedApiKey;
    if (!resolvedApiKey) {
      throw Errors.VALIDATION_ERROR(
        `${catalogItem.displayName} 缺少 API Key，請先以 system config 寫入 ${configKey} 或於測試輸入中提供 apiKey`
      );
    }

    const storedBaseUrl = this.getString(storedConfig.baseUrl) || this.getString(storedConfig.base_url);
    const resolvedBaseUrl = this.getString(input.baseUrl) || storedBaseUrl || catalogItem.defaultBaseUrl || '';

    const storedTimeout = this.getTimeoutFromAny(storedConfig.timeoutMs);
    const resolvedTimeout = toPositiveInteger(input.timeoutMs, storedTimeout || 12000);

    const runtime: MediaProviderRuntimeConfig = {
      apiKey: resolvedApiKey,
      baseUrl: resolvedBaseUrl,
      timeoutMs: resolvedTimeout,
      providerKey: normalizedProviderKey,
    };

    const sourceImageUrl = this.getString(input.sourceImageUrl)
      || this.getString(storedConfig.sourceImageUrl)
      || this.getString(storedConfig.source_image_url);
    if (sourceImageUrl) {
      runtime.sourceImageUrl = sourceImageUrl;
    }
    return runtime;
  }

  private getTimeoutFromAny(raw: unknown): number | undefined {
    if (raw === undefined || raw === null) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(500, Math.min(120000, Math.floor(parsed)));
  }

  private getString(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}

export const mediaProviderService = new MediaProviderService();
