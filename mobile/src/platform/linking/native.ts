import * as Linking from 'expo-linking';

export interface ParsedAppLink {
  path: string | null;
  queryParams: Record<string, string | string[]>;
}

export interface AppDeepLinkLandingTarget {
  href: AppLandingHref;
  sourceUrl: string;
  sourcePath: string | null;
}

export type AppLandingHref =
  | '/auth'
  | '/case'
  | '/chat'
  | '/notifications'
  | '/profile'
  | '/quick'
  | '/repair'
  | string;

export async function getInitialAppLink(): Promise<ParsedAppLink | null> {
  const url = await Linking.getInitialURL();
  if (!url) return null;
  const parsed = Linking.parse(url);
  return {
    path: parsed.path ?? null,
    queryParams: parsed.queryParams as Record<string, string | string[]>,
  };
}

export function createAppLink(path: string, params?: Record<string, string>): string {
  return Linking.createURL(path, { queryParams: params });
}

function getFirstQueryValue(searchParams: URLSearchParams, ...names: string[]): string | null {
  for (const name of names) {
    const value = searchParams.get(name);
    if (value) return value;
  }
  return null;
}

function parsePath(rawPath: string): { pathname: string; searchParams: URLSearchParams } {
  try {
    const parsed = new URL(rawPath, 'https://app.local');
    return {
      pathname: parsed.pathname,
      searchParams: parsed.searchParams,
    };
  } catch {
    return {
      pathname: rawPath.split('?')[0] || '/',
      searchParams: new URLSearchParams(rawPath.includes('?') ? rawPath.split('?').slice(1).join('?') : ''),
    };
  }
}

function normalizePathFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'cj:') {
      const host = parsed.hostname ? `/${parsed.hostname}` : '';
      const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
      return `${host}${pathname || ''}${parsed.search}` || '/';
    }

    const marker = '/--/';
    const markerIndex = parsed.pathname.indexOf(marker);
    const pathname = markerIndex >= 0 ? parsed.pathname.slice(markerIndex + marker.length - 1) : parsed.pathname;
    return `${pathname || '/'}${parsed.search}`;
  } catch {
    return rawUrl.startsWith('/') ? rawUrl : null;
  }
}

export function resolveAppHrefFromAppPath(rawPath?: string | null): AppLandingHref | null {
  if (!rawPath) return null;

  const { pathname, searchParams } = parsePath(rawPath);
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const lowerPath = normalized.toLowerCase();

  if (lowerPath === '/auth' || lowerPath.startsWith('/auth/')) {
    const next = getFirstQueryValue(searchParams, 'next');
    return next ? (`/auth?next=${encodeURIComponent(next)}` as AppLandingHref) : '/auth';
  }

  if (lowerPath === '/quick') return '/quick';
  if (lowerPath === '/quick/collaborative') return '/quick/collaborative';
  if (lowerPath === '/quick/result') {
    const caseId = getFirstQueryValue(searchParams, 'caseId', 'case_id');
    return caseId ? (`/quick/result?caseId=${encodeURIComponent(caseId)}` as AppLandingHref) : '/quick/result';
  }
  if (lowerPath.startsWith('/quick/')) return '/quick';

  if (lowerPath === '/profile/interview') {
    const sessionId = getFirstQueryValue(searchParams, 'sessionId', 'session_id');
    return sessionId ? (`/profile/interview?sessionId=${encodeURIComponent(sessionId)}` as AppLandingHref) : '/profile/interview';
  }
  if (lowerPath === '/profile/story') return '/profile/story';
  if (lowerPath === '/profile' || lowerPath.startsWith('/profile/')) return '/profile';

  if (lowerPath === '/notifications' || lowerPath.startsWith('/notifications/')) return '/notifications';

  if (lowerPath === '/chat/invite') {
    const code = getFirstQueryValue(searchParams, 'code', 'inviteCode', 'invite_code');
    return code ? (`/chat/invite?code=${encodeURIComponent(code)}` as AppLandingHref) : '/chat/invite';
  }
  if (lowerPath === '/chat/room') {
    const roomId = getFirstQueryValue(searchParams, 'roomId', 'room_id');
    return roomId ? (`/chat/room?roomId=${encodeURIComponent(roomId)}` as AppLandingHref) : '/chat/room';
  }
  if (lowerPath.startsWith('/chat/rooms/') || lowerPath.startsWith('/chat/room/')) {
    const roomId = normalized.split('/').filter(Boolean).at(-1);
    return roomId ? (`/chat/room?roomId=${encodeURIComponent(decodeURIComponent(roomId))}` as AppLandingHref) : '/chat';
  }
  if (lowerPath === '/chat' || lowerPath.startsWith('/chat/')) return '/chat';

  if (
    lowerPath === '/case' ||
    lowerPath.startsWith('/case/') ||
    lowerPath === '/cases' ||
    lowerPath.startsWith('/cases/') ||
    lowerPath === '/judgment' ||
    lowerPath.startsWith('/judgment') ||
    lowerPath.startsWith('/judgments')
  ) {
    return '/case';
  }

  if (
    lowerPath === '/repair' ||
    lowerPath.startsWith('/repair/') ||
    lowerPath === '/execution' ||
    lowerPath.startsWith('/execution/') ||
    lowerPath === '/reconciliation' ||
    lowerPath.startsWith('/reconciliation/') ||
    lowerPath.startsWith('/repair-tracks/')
  ) {
    return '/repair';
  }

  return null;
}

export function resolveAppHrefFromUrl(rawUrl?: string | null): AppDeepLinkLandingTarget | null {
  const sourceUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!sourceUrl) return null;

  const sourcePath = normalizePathFromUrl(sourceUrl);
  const href = resolveAppHrefFromAppPath(sourcePath);
  return href && sourcePath ? { href, sourcePath, sourceUrl } : null;
}

export async function getInitialAppLandingTarget(): Promise<AppDeepLinkLandingTarget | null> {
  const url = await Linking.getInitialURL();
  return resolveAppHrefFromUrl(url);
}

export async function subscribeToAppLandingTargets(
  onTarget: (target: AppDeepLinkLandingTarget) => void
): Promise<() => void> {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const target = resolveAppHrefFromUrl(url);
    if (target) onTarget(target);
  });

  return () => {
    subscription.remove();
  };
}

export function resolveAppHrefFromBackendPath(rawPath?: string | null): AppLandingHref {
  if (!rawPath) return '/notifications';

  const { pathname, searchParams } = parsePath(rawPath);
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const lowerPath = normalized.toLowerCase();

  if (lowerPath === '/auth' || lowerPath.startsWith('/auth/')) return '/auth';
  if (lowerPath === '/quick') return '/quick';
  if (lowerPath === '/quick/collaborative') return '/quick/collaborative';
  if (lowerPath === '/quick/result') {
    const explicitCaseId = searchParams.get('caseId') ?? searchParams.get('case_id');
    return explicitCaseId
      ? `/quick/result?caseId=${encodeURIComponent(explicitCaseId)}`
      : '/quick/result';
  }
  if (lowerPath.startsWith('/quick/')) return '/quick';
  if (lowerPath === '/profile' || lowerPath.startsWith('/profile/')) return '/profile';
  if (lowerPath === '/notifications' || lowerPath.startsWith('/notifications/')) return '/notifications';

  if (lowerPath === '/chat' || lowerPath.startsWith('/chat/')) {
    const explicitInviteCode = searchParams.get('code') ?? searchParams.get('inviteCode') ?? searchParams.get('invite_code');
    if (lowerPath === '/chat/invite' || lowerPath === '/chat/invites') {
      return explicitInviteCode ? `/chat/invite?code=${encodeURIComponent(explicitInviteCode)}` : '/chat/invite';
    }

    const inviteMatch = normalized.match(/^\/chat\/(?:invite|invites)\/([^/]+)$/i);
    if (inviteMatch?.[1]) return `/chat/invite?code=${encodeURIComponent(decodeURIComponent(inviteMatch[1]))}`;

    const explicitRoomId = searchParams.get('roomId') ?? searchParams.get('room_id');
    if (explicitRoomId) return `/chat/room?roomId=${encodeURIComponent(explicitRoomId)}`;

    const roomMatch = normalized.match(/^\/chat\/(?:rooms|room)\/([^/]+)/i);
    if (roomMatch?.[1]) return `/chat/room?roomId=${encodeURIComponent(decodeURIComponent(roomMatch[1]))}`;
    return '/chat';
  }

  if (
    lowerPath === '/case' ||
    lowerPath.startsWith('/case/') ||
    lowerPath === '/cases' ||
    lowerPath.startsWith('/cases/') ||
    lowerPath === '/judgment' ||
    lowerPath.startsWith('/judgment') ||
    lowerPath.startsWith('/judgments')
  ) {
    return '/case';
  }

  if (
    lowerPath === '/repair' ||
    lowerPath.startsWith('/repair/') ||
    lowerPath === '/execution' ||
    lowerPath.startsWith('/execution/') ||
    lowerPath === '/reconciliation' ||
    lowerPath.startsWith('/reconciliation/') ||
    lowerPath.startsWith('/repair-tracks/')
  ) {
    return '/repair';
  }

  return '/notifications';
}
