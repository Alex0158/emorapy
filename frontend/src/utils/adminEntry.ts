/**
 * 主前台到管理後台的入口解析工具。
 * 為避免主前台 /admin/* 自循環，這裡只接受絕對 URL。
 */

function normalizeAbsoluteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getAdminLoginUrl(): string | null {
  const raw = (import.meta.env.VITE_ADMIN_LOGIN_URL || '').trim();
  return normalizeAbsoluteUrl(raw);
}

export function hasAdminLoginUrl(): boolean {
  return getAdminLoginUrl() !== null;
}
