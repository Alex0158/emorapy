const ROUTE_SEGMENT = '[A-Za-z0-9._:-]+';

const ALLOWED_NOTIFICATION_DEEP_LINKS = [
  /^\/notifications$/,
  /^\/case\/(?:list|create)$/,
  new RegExp(`^/case/${ROUTE_SEGMENT}(?:/review)?$`),
  new RegExp(`^/judgment/${ROUTE_SEGMENT}$`),
  new RegExp(`^/reconciliation/${ROUTE_SEGMENT}(?:/${ROUTE_SEGMENT})?$`),
  /^\/execution\/dashboard$/,
  new RegExp(`^/execution/${ROUTE_SEGMENT}/(?:checkin|replan)$`),
  /^\/profile\/(?:index|settings|pairing|my-story)$/,
  new RegExp(`^/interview/${ROUTE_SEGMENT}(?:/result)?$`),
  new RegExp(`^/chat/room(?:/${ROUTE_SEGMENT})?$`),
  new RegExp(`^/chat/invites?/${ROUTE_SEGMENT}$`),
  /^\/quick-experience\/(?:create|collaborative)$/,
  new RegExp(`^/quick-experience/result/${ROUTE_SEGMENT}$`),
];

function hasUnsafePathCharacters(path: string): boolean {
  return /[\u0000-\u001F\u007F\\]/u.test(path)
    || path.includes('..')
    || /%(?:2f|5c)/iu.test(path);
}

export function normalizeNotificationDeepLinkPath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const path = input.trim();
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.length > 300 || hasUnsafePathCharacters(path)) return null;
  if (!ALLOWED_NOTIFICATION_DEEP_LINKS.some((rule) => rule.test(path))) return null;
  return path;
}

export function isNotificationDeepLinkPathAllowed(input: unknown): boolean {
  return normalizeNotificationDeepLinkPath(input) !== null;
}
