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
  recoveryProposal: RecoveryProposal | null;
};

const DEFAULT_STUCK_MINUTES = 30;

type RecoveryProposal = {
  id: string;
  severity: 'warning' | 'critical';
  entityType: 'case' | 'chat_room' | 'chat_to_case_link';
  entityIds: string[];
  recommendedAction: string;
  automaticFixAvailable: false;
  requiresHumanApproval: true;
  verificationCommands: string[];
  notes: string[];
};

function cutoffDate(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function buildRecoveryProposal(input: {
  id: string;
  severity: RecoveryProposal['severity'];
  entityType: RecoveryProposal['entityType'];
  entityIds: string[];
  recommendedAction: string;
  verificationCommands: string[];
  notes: string[];
}): RecoveryProposal | null {
  if (input.entityIds.length === 0) {
    return null;
  }

  return {
    id: input.id,
    severity: input.severity,
    entityType: input.entityType,
    entityIds: input.entityIds,
    recommendedAction: input.recommendedAction,
    automaticFixAvailable: false,
    requiresHumanApproval: true,
    verificationCommands: input.verificationCommands,
    notes: [
      '此 proposal 只提供人工恢復建議，不會自動修改資料。',
      ...input.notes,
    ],
  };
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
      recoveryProposal: buildRecoveryProposal({
        id: 'recover-stuck-case-judgment-generation',
        severity: 'critical',
        entityType: 'case',
        entityIds: stuckCases.map((item) => item.id),
        recommendedAction: '人工核對是否仍有 active AI stream；若無 active stream，使用既有 judgment retry 流程重新生成或標記 judgment_failed。',
        verificationCommands: [
          'cd backend && npm run ops:product-state:audit',
          '查詢對應 case 的 judgment、ai_stream_sessions、ai_stream_events 狀態',
          '完成人工恢復後再次執行 cd backend && npm run ops:product-state:audit',
        ],
        notes: [
          '不要直接把 in_progress case 更新為 completed。',
          '如果已有 judgment row，優先核對 case status 是否應與 judgment 對齊。',
          '如果仍有 streaming / started AI stream，先等待或確認 stream 已失效再處理。',
        ],
      }),
    },
    {
      check: `chat rooms stuck judgment_requested over ${stuckMinutes}m`,
      count: stuckChatRoomsCount,
      sampleIds: stuckChatRooms.map((item) => item.id),
      recoveryProposal: buildRecoveryProposal({
        id: 'recover-stuck-chat-judgment-request',
        severity: 'critical',
        entityType: 'chat_room',
        entityIds: stuckChatRooms.map((item) => item.id),
        recommendedAction: '人工核對 room -> chat_to_case_link -> case -> judgment 鏈路；若 case 可重試，走 chat judgment retry/狀態恢復流程。',
        verificationCommands: [
          'cd backend && npm run ops:product-state:audit',
          '查詢 chat_rooms、chat_to_case_links、cases、judgments 對應 row',
          '完成人工恢復後再次執行 cd backend && npm run ops:product-state:audit',
        ],
        notes: [
          '不要只改 chat_rooms.status，必須同步核對 linked case 與 judgment。',
          '如果沒有 chat_to_case_link，先確認 requestJudgment 是否在建 case 前崩潰。',
          '如果 linked case 已 judgment_failed，可允許顯式重試而不是靜默自動重跑。',
        ],
      }),
    },
    {
      check: 'chat_to_case_links missing judgment_id while case completed',
      count: incompleteChatLinksCount,
      sampleIds: incompleteChatLinks.map((item) => item.id),
      recoveryProposal: buildRecoveryProposal({
        id: 'repair-chat-to-case-link-missing-judgment',
        severity: 'warning',
        entityType: 'chat_to_case_link',
        entityIds: incompleteChatLinks.map((item) => item.id),
        recommendedAction: '人工核對 linked case 的唯一 judgment；確認無歧義後補回 chat_to_case_links.judgment_id。',
        verificationCommands: [
          'cd backend && npm run ops:product-state:audit',
          '查詢 chat_to_case_links.case_id 對應 judgments.case_id',
          '完成人工補齊後再次執行 cd backend && npm run ops:product-state:audit',
        ],
        notes: [
          '只有在 case_id 對應唯一 judgment 時才可補 judgment_id。',
          '若 case completed 但無 judgment row，應先按 stuck case 恢復流程處理。',
          '此類修復涉及資料寫入，必須先記錄工單或待處理任務。',
        ],
      }),
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
