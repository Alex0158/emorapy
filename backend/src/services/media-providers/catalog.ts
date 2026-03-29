import { MediaProviderCatalogItem, MediaProviderPricing } from './types';

const NANOBANANAPRO_PRICING: MediaProviderPricing = {
  billingUnit: 'image',
  unitPriceUsd: 0,
};

const SEEDANCE_PRICING: MediaProviderPricing = {
  billingUnit: 'second',
  unitPriceUsd: 0,
};

export const DEFAULT_MEDIA_PROVIDER_CATALOG: MediaProviderCatalogItem[] = [
  {
    providerKey: 'nanobananapro',
    providerType: 'image',
    displayName: 'NanoBananaPro',
    secretLabel: 'NanoBananaPro API Key',
    description: 'Image generation provider.',
    defaultModel: 'default',
    defaultBaseUrl: 'https://api.nanobananapro.com',
    supportsSourceImage: false,
    pricing: NANOBANANAPRO_PRICING,
    isEnabledByDefault: true,
  },
  {
    providerKey: 'seedance',
    providerType: 'video',
    displayName: 'Seedance',
    secretLabel: 'Seedance API Key',
    description: 'Video generation provider with task-based async output.',
    defaultModel: 'video-2.0',
    defaultBaseUrl: 'https://api.seedance.ai',
    supportsSourceImage: true,
    pricing: SEEDANCE_PRICING,
    isEnabledByDefault: true,
  },
];

export const KNOWN_MEDIA_PROVIDER_KEYS = new Set(DEFAULT_MEDIA_PROVIDER_CATALOG.map((item) => item.providerKey));

export function getCatalogItem(providerKey: string): MediaProviderCatalogItem | undefined {
  return DEFAULT_MEDIA_PROVIDER_CATALOG.find((item) => item.providerKey === providerKey);
}
