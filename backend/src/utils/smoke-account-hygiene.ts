export type SmokeAccountKind = 'user' | 'admin_user';

export type SmokeAccountCandidate = {
  kind: SmokeAccountKind;
  id: string;
  email: string;
  is_active: boolean;
  created_at?: Date | string | null;
};

export type SmokeAccountRuleId =
  | 'claim-smoke-generated-user'
  | 'default-dev-user'
  | 'default-smoke-admin'
  | 'default-dev-admin';

export type SmokeAccountFinding = SmokeAccountCandidate & {
  ruleId: SmokeAccountRuleId;
  reason: string;
};

export type SmokeAccountHygieneReport = {
  ok: boolean;
  check: 'smoke-account-hygiene';
  generatedAt: string;
  activeFindingCount: number;
  findings: SmokeAccountFinding[];
};

const DEFAULT_DEV_USER_EMAILS = new Set([
  'boyfriend@test.com',
  'girlfriend@test.com',
  'b1@gmail.com',
  'g1@gmail.com',
]);

const DEFAULT_SMOKE_ADMIN_EMAILS = new Set([
  'admin-smoke@example.com',
  'staging-smoke-admin@example.com',
]);

const DEFAULT_DEV_ADMIN_EMAILS = new Set([
  'admin1@gmail.com',
  'admin2@gmail.com',
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function classifySmokeAccount(candidate: SmokeAccountCandidate): SmokeAccountFinding | null {
  if (!candidate.is_active) return null;

  const email = normalizeEmail(candidate.email);

  if (candidate.kind === 'user') {
    if (email.startsWith('claim-smoke-') && email.endsWith('@example.com')) {
      return {
        ...candidate,
        email,
        ruleId: 'claim-smoke-generated-user',
        reason: 'Active claim-session smoke user should be disabled after preflight.',
      };
    }

    if (DEFAULT_DEV_USER_EMAILS.has(email)) {
      return {
        ...candidate,
        email,
        ruleId: 'default-dev-user',
        reason: 'Default development user account must not remain active in production-like databases.',
      };
    }
  }

  if (candidate.kind === 'admin_user') {
    if (DEFAULT_SMOKE_ADMIN_EMAILS.has(email)) {
      return {
        ...candidate,
        email,
        ruleId: 'default-smoke-admin',
        reason: 'Default smoke admin account must be disabled or replaced outside controlled staging checks.',
      };
    }

    if (DEFAULT_DEV_ADMIN_EMAILS.has(email)) {
      return {
        ...candidate,
        email,
        ruleId: 'default-dev-admin',
        reason: 'Default development admin account must not remain active in production-like databases.',
      };
    }
  }

  return null;
}

export function buildSmokeAccountHygieneReport(
  candidates: SmokeAccountCandidate[],
  generatedAt = new Date().toISOString()
): SmokeAccountHygieneReport {
  const findings = candidates
    .map((candidate) => classifySmokeAccount(candidate))
    .filter((finding): finding is SmokeAccountFinding => Boolean(finding))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.email.localeCompare(b.email));

  return {
    ok: findings.length === 0,
    check: 'smoke-account-hygiene',
    generatedAt,
    activeFindingCount: findings.length,
    findings,
  };
}

export const SMOKE_USER_EMAILS_TO_DISABLE = [...DEFAULT_DEV_USER_EMAILS];
export const SMOKE_ADMIN_EMAILS_TO_DISABLE = [
  ...DEFAULT_SMOKE_ADMIN_EMAILS,
  ...DEFAULT_DEV_ADMIN_EMAILS,
];
