import { PrismaClient } from '../src/types/prisma-client';
import {
  GENERATED_SMOKE_USER_EMAIL_PATTERNS,
  SMOKE_ADMIN_EMAILS_TO_DISABLE,
  SMOKE_USER_EMAILS_TO_DISABLE,
  type SmokeAccountCandidate,
  buildSmokeAccountHygieneReport,
  collectSmokeAccountCandidates,
} from '../src/utils/smoke-account-hygiene';

try {
  // Load DATABASE_URL for local ops scripts without importing app env validation.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
}

const prisma = new PrismaClient();

const shouldDisable = process.env.SMOKE_ACCOUNT_HYGIENE_DISABLE === 'true';

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
  const candidates = await collectSmokeAccountCandidates(prisma);
  const report = buildSmokeAccountHygieneReport(candidates);

  if (shouldDisable && !report.ok) {
    const disabled = await disableFindings(report.findings);
    const postDisableReport = buildSmokeAccountHygieneReport(
      await collectSmokeAccountCandidates(prisma)
    );
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
