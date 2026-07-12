const GLOBAL_CRISIS_SUPPORT_URL = 'https://findahelpline.com/';

export interface CrisisSupportResource {
  url: string;
  region: string;
  source: 'global_directory' | 'deployment_config';
}

function normalizeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveCrisisSupportResource(
  env: Record<string, unknown>,
): CrisisSupportResource {
  const configuredUrl = normalizeHttpsUrl(env.VITE_CRISIS_SUPPORT_URL);
  const configuredRegion = typeof env.VITE_CRISIS_SUPPORT_REGION === 'string'
    ? env.VITE_CRISIS_SUPPORT_REGION.trim()
    : '';

  if (configuredUrl) {
    return {
      url: configuredUrl,
      region: configuredRegion || 'configured',
      source: 'deployment_config',
    };
  }

  return {
    url: GLOBAL_CRISIS_SUPPORT_URL,
    region: 'global',
    source: 'global_directory',
  };
}

export function getCrisisSupportResource(): CrisisSupportResource {
  return resolveCrisisSupportResource(import.meta.env);
}
