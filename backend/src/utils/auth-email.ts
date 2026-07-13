import crypto from 'crypto';

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Stable, non-PII rate-limit subject shared by every email-based auth limiter.
 * The fallback is used only when validation has not yet established an email.
 */
export function getAuthEmailRateLimitSubject(
  email: unknown,
  fallback: string
): string {
  if (typeof email !== 'string') return fallback;
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return fallback;
  return crypto.createHash('sha256').update(normalizedEmail).digest('hex');
}
