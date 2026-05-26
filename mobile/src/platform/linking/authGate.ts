import type { AppLandingHref } from './native';

const APP_LANDING_PREFIXES = [
  '/auth',
  '/case',
  '/chat',
  '/notifications',
  '/profile',
  '/quick',
  '/repair',
] as const;

const PUBLIC_LANDING_PREFIXES = ['/auth', '/quick'] as const;

function hasPrefix(href: string, prefix: string): boolean {
  return href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}?`);
}

export function getSafeAppLandingHref(rawHref?: string | null): AppLandingHref | null {
  const href = typeof rawHref === 'string' ? rawHref.trim() : '';
  if (!href || href.includes('://') || href.startsWith('//') || href.includes('\\')) {
    return null;
  }

  return APP_LANDING_PREFIXES.some((prefix) => hasPrefix(href, prefix))
    ? (href as AppLandingHref)
    : null;
}

export function requiresAuthForAppLandingHref(rawHref?: string | null): boolean {
  const href = getSafeAppLandingHref(rawHref);
  if (!href) return false;
  return !PUBLIC_LANDING_PREFIXES.some((prefix) => hasPrefix(href, prefix));
}

export function getPostAuthResumeHref(rawHref?: string | null): AppLandingHref | null {
  const href = getSafeAppLandingHref(rawHref);
  if (!href || !requiresAuthForAppLandingHref(href)) return null;
  return href;
}

export function buildAuthHrefForPostLogin(rawHref?: string | null): AppLandingHref {
  const resumeHref = getPostAuthResumeHref(rawHref);
  return resumeHref ? (`/auth?next=${encodeURIComponent(resumeHref)}` as AppLandingHref) : '/auth';
}
