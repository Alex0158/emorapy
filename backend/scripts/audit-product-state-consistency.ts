import { PrismaClient } from '../src/types/prisma-client';

try {
  // Load DATABASE_URL for local ops scripts without importing app env validation.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
}

const prisma = new PrismaClient();

type AuditItem = {
  check: string;
  count: number;
  sampleIds: string[];
};

const DEFAULT_STUCK_MINUTES = 30;

function cutoffDate(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function collectAuditItems(stuckMinutes = DEFAULT_STUCK_MINUTES): Promise<AuditItem[]> {
  const cutoff = cutoffDate(stuckMinutes);

  const stuckCasesWhere = {
    status: 'in_progress',
    updated_at: { lt: cutoff },
  } as const;
  const stuckChatRoomsWhere = {
    status: 'judgment_requested',
    updated_at: { lt: cutoff },
  } as const;
  const incompleteChatLinksWhere = {
    judgment_id: null,
    case: { status: 'completed' },
  } as const;

  const [stuckCasesCount, stuckCases, stuckChatRoomsCount, stuckChatRooms, incompleteChatLinksCount, incompleteChatLinks] = await Promise.all([
    prisma.case.count({ where: stuckCasesWhere }),
    prisma.case.findMany({
      where: stuckCasesWhere,
      select: { id: true },
      take: 20,
      orderBy: { updated_at: 'asc' },
    }),
    prisma.chatRoom.count({ where: stuckChatRoomsWhere }),
    prisma.chatRoom.findMany({
      where: stuckChatRoomsWhere,
      select: { id: true },
      take: 20,
      orderBy: { updated_at: 'asc' },
    }),
    prisma.chatToCaseLink.count({ where: incompleteChatLinksWhere }),
    prisma.chatToCaseLink.findMany({
      where: incompleteChatLinksWhere,
      select: { id: true },
      take: 20,
      orderBy: { created_at: 'asc' },
    }),
  ]);

  return [
    {
      check: `cases stuck in_progress over ${stuckMinutes}m`,
      count: stuckCasesCount,
      sampleIds: stuckCases.map((item) => item.id),
    },
    {
      check: `chat rooms stuck judgment_requested over ${stuckMinutes}m`,
      count: stuckChatRoomsCount,
      sampleIds: stuckChatRooms.map((item) => item.id),
    },
    {
      check: 'chat_to_case_links missing judgment_id while case completed',
      count: incompleteChatLinksCount,
      sampleIds: incompleteChatLinks.map((item) => item.id),
    },
  ];
}

export async function runProductStateConsistencyAudit(stuckMinutes = DEFAULT_STUCK_MINUTES): Promise<AuditItem[]> {
  return collectAuditItems(stuckMinutes);
}

async function main() {
  const stuckMinutes = Number(process.env.PRODUCT_STATE_AUDIT_STUCK_MINUTES || DEFAULT_STUCK_MINUTES);
  const items = await runProductStateConsistencyAudit(Number.isFinite(stuckMinutes) && stuckMinutes > 0 ? stuckMinutes : DEFAULT_STUCK_MINUTES);
  const hasFindings = items.some((item) => item.count > 0);

  console.log(JSON.stringify({ ok: !hasFindings, checks: items }, null, 2));
  process.exitCode = hasFindings ? 1 : 0;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[product-state-audit] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
