export type MediaProviderType = 'image' | 'video';

export type MediaProviderBillingUnit = 'image' | 'second' | 'frame';

export interface MediaProviderPricing {
  billingUnit: MediaProviderBillingUnit;
  unitPriceUsd: number;
}

export interface MediaProviderCatalogItem {
  providerKey: string;
  providerType: MediaProviderType;
  displayName: string;
  description?: string;
  secretLabel?: string;
  defaultModel?: string;
  defaultBaseUrl?: string;
  supportsSourceImage?: boolean;
  pricing: MediaProviderPricing;
  isEnabledByDefault?: boolean;
}

export interface MediaProviderRuntimeConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface MediaProviderImageInput {
  prompt: string;
  model?: string;
  count?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface MediaProviderVideoInput {
  prompt: string;
  model?: string;
  durationSeconds?: number;
  sourceImageUrl?: string;
  count?: number;
  [key: string]: unknown;
}

export interface MediaProviderAsset {
  url: string;
  type: MediaProviderType;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface MediaProviderGenerationResult {
  assets: MediaProviderAsset[];
  requestId?: string;
  raw?: unknown;
}

export interface MediaProviderCostSummary {
  billingUnit: MediaProviderBillingUnit;
  unitPriceUsd: number;
  unitCount: number;
  totalCostUsd: number;
}

export interface ProviderTestInput {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  model?: string;
  count?: number;
  durationSeconds?: number;
  sourceImageUrl?: string;
  prompt?: string;
}

export interface MediaProviderTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  detail?: unknown;
}

export interface MediaProvider {
  providerKey: string;
  providerType: MediaProviderType;
  displayName: string;
  isEnabledByDefault: boolean;
  defaultBaseUrl?: string;
  pricing: MediaProviderPricing;

  testConnection(
    config: MediaProviderRuntimeConfig,
    input?: ProviderTestInput
  ): Promise<MediaProviderTestResult>;

  generateImages(
    input: MediaProviderImageInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult>;

  generateVideos(
    input: MediaProviderVideoInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult>;

  estimateCost(
    input: { count?: number; durationSeconds?: number },
    pricingOverride?: MediaProviderPricing
  ): MediaProviderCostSummary;
}
