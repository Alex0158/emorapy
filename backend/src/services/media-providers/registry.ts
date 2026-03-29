import { DEFAULT_MEDIA_PROVIDER_CATALOG } from './catalog';
import { MediaProvider } from './types';
import { NanoBananaProImageProvider } from './nanobananapro-image-provider';
import { SeedanceVideoProvider } from './seedance-video-provider';

function buildRegistry(): Map<string, MediaProvider> {
  const registry = new Map<string, MediaProvider>();
  for (const item of DEFAULT_MEDIA_PROVIDER_CATALOG) {
    if (registry.has(item.providerKey)) {
      continue;
    }

    if (item.providerKey === 'nanobananapro') {
      registry.set(item.providerKey, new NanoBananaProImageProvider());
      continue;
    }

    if (item.providerKey === 'seedance') {
      registry.set(item.providerKey, new SeedanceVideoProvider());
      continue;
    }
  }
  return registry;
}

export const mediaProviderRegistry = buildRegistry();

export const KNOWN_MEDIA_PROVIDERS = Array.from(mediaProviderRegistry.values());
