import type { PrismaClient } from '../types/prisma-client';

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
  | 'web-p0-generated-user'
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

export const GENERATED_SMOKE_USER_EMAIL_PATTERNS = [
  {
    prefix: 'claim-smoke-',
    suffix: '@example.com',
    ruleId: 'claim-smoke-generated-user',
    reason: 'Active claim-session smoke user should be disabled after preflight.',
  },
  {
    prefix: 'web-p0-',
    suffix: '@example.com',
    ruleId: 'web-p0-generated-user',
    reason: 'Active Web P0 true-service smoke user should be disabled after verification.',
  },
] as const satisfies ReadonlyArray<{
  prefix: string;
  suffix: string;
  ruleId: SmokeAccountRuleId;
  reason: string;
}>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function classifySmokeAccount(candidate: SmokeAccountCandidate): SmokeAccountFinding | null {
  if (!candidate.is_active) return null;

  const email = normalizeEmail(candidate.email);

  if (candidate.kind === 'user') {
    const generatedRule = GENERATED_SMOKE_USER_EMAIL_PATTERNS.find(
      (rule) => email.startsWith(rule.prefix) && email.endsWith(rule.suffix)
    );
    if (generatedRule) {
      return {
        ...candidate,
        email,
        ruleId: generatedRule.ruleId,
        reason: generatedRule.reason,
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

type SmokeAccountHygieneClient = Pick<PrismaClient, 'user' | 'adminUser'>;

export async function collectSmokeAccountCandidates(
  prisma: SmokeAccountHygieneClient
): Promise<SmokeAccountCandidate[]> {
  const [users, adminUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        OR: [
          ...GENERATED_SMOKE_USER_EMAIL_PATTERNS.map((rule) => ({
            email: {
              startsWith: rule.prefix,
              endsWith: rule.suffix,
              mode: 'insensitive' as const,
            },
          })),
          { email: { in: SMOKE_USER_EMAILS_TO_DISABLE, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.adminUser.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        email: { in: SMOKE_ADMIN_EMAILS_TO_DISABLE, mode: 'insensitive' },
      },
      select: {
        id: true,
        email: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    }),
  ]);

  return [
    ...users.map((user) => ({ ...user, kind: 'user' as const })),
    ...adminUsers.map((adminUser) => ({ ...adminUser, kind: 'admin_user' as const })),
  ];
}
