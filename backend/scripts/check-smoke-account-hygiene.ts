import { PrismaClient } from '../src/types/prisma-client';
import {
  SMOKE_ADMIN_EMAILS_TO_DISABLE,
  SMOKE_USER_EMAILS_TO_DISABLE,
  type SmokeAccountCandidate,
  buildSmokeAccountHygieneReport,
} from '../src/utils/smoke-account-hygiene';

try {
  // Load DATABASE_URL for local ops scripts without importing app env validation.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
}

const prisma = new PrismaClient();

const shouldDisable = process.env.SMOKE_ACCOUNT_HYGIENE_DISABLE === 'true';

async function collectCandidates(): Promise<SmokeAccountCandidate[]> {
  const [users, adminUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        OR: [
          { email: { startsWith: 'claim-smoke-', endsWith: '@example.com', mode: 'insensitive' } },
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

async function disableFindings(candidates: SmokeAccountCandidate[]): Promise<{ disabledUsers: number; disabledAdmins: number }> {
  const userIds = candidates.filter((candidate) => candidate.kind === 'user').map((candidate) => candidate.id);
  const adminIds = candidates.filter((candidate) => candidate.kind === 'admin_user').map((candidate) => candidate.id);

  const [userResult, adminResult] = await Promise.all([
    userIds.length
      ? prisma.user.updateMany({
          where: {
            id: { in: userIds },
            is_active: true,
            OR: [
              { email: { startsWith: 'claim-smoke-', endsWith: '@example.com', mode: 'insensitive' } },
              { email: { in: SMOKE_USER_EMAILS_TO_DISABLE, mode: 'insensitive' } },
            ],
          },
          data: { is_active: false },
        })
      : Promise.resolve({ count: 0 }),
    adminIds.length
      ? prisma.adminUser.updateMany({
          where: {
            id: { in: adminIds },
            is_active: true,
            email: { in: SMOKE_ADMIN_EMAILS_TO_DISABLE, mode: 'insensitive' },
          },
          data: { is_active: false },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    disabledUsers: userResult.count,
    disabledAdmins: adminResult.count,
  };
}

async function main() {
  const candidates = await collectCandidates();
  const report = buildSmokeAccountHygieneReport(candidates);

  if (shouldDisable && !report.ok) {
    const disabled = await disableFindings(report.findings);
    const postDisableReport = buildSmokeAccountHygieneReport(await collectCandidates());
    console.log(JSON.stringify({ ...postDisableReport, disabled }, null, 2));
    process.exitCode = postDisableReport.ok ? 0 : 2;
    return;
  }

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 2;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[smoke-account-hygiene] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
