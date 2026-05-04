import { PrismaClient } from '../src/types/prisma-client';
import { getCaseProductFlow, isSessionBoundCase } from '../src/utils/case-classifier';
import type { CaseProductFlow } from '../src/utils/case-classifier';

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
  sampleDetails: AuditSampleDetail[];
  recoveryProposal: RecoveryProposal | null;
  recoveryTasks: RecoveryTask[];
};

const DEFAULT_STUCK_MINUTES = 30;

type AuditSampleDetail = {
  id: string;
  entityType: 'case' | 'chat_room' | 'chat_to_case_link' | 'repair_track';
  productFlow?: CaseProductFlow;
  mode?: string;
  status?: string;
  sessionBound?: boolean;
  roomId?: string;
  caseId?: string;
  judgmentId?: string | null;
  planId?: string;
  latestStreamId?: string | null;
  latestStreamStatus?: string | null;
  latestStreamUpdatedAt?: Date | null;
  linkedCaseIds?: string[];
  updatedAt?: Date;
  createdAt?: Date;
};

type RecoveryProposal = {
  id: string;
  severity: 'warning' | 'critical';
  entityType: 'case' | 'chat_room' | 'chat_to_case_link' | 'repair_track';
  entityIds: string[];
  recommendedAction: string;
  automaticFixAvailable: false;
  requiresHumanApproval: true;
  verificationCommands: string[];
  notes: string[];
};

type RecoveryTask = {
  id: string;
  proposalId: string;
  status: 'manual_review_required';
  severity: RecoveryProposal['severity'];
  entityType: RecoveryProposal['entityType'];
  entityId: string;
  productFlow?: CaseProductFlow;
  linkedEntityIds: {
    roomId?: string;
    caseId?: string;
    linkedCaseIds?: string[];
    judgmentId?: string | null;
    planId?: string;
    latestStreamId?: string | null;
  };
  recommendedAction: string;
  verificationCommands: string[];
  guardrails: string[];
  automaticFixAvailable: false;
  requiresHumanApproval: true;
  source: 'ops:product-state:audit';
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

function buildRecoveryTasks(
  proposal: RecoveryProposal | null,
  sampleDetails: AuditSampleDetail[],
): RecoveryTask[] {
  if (!proposal) {
    return [];
  }

  return sampleDetails.map((detail) => ({
    id: `${proposal.id}:${detail.id}`,
    proposalId: proposal.id,
    status: 'manual_review_required',
    severity: proposal.severity,
    entityType: proposal.entityType,
    entityId: detail.id,
    productFlow: detail.productFlow,
    linkedEntityIds: {
      roomId: detail.roomId,
      caseId: detail.caseId,
      linkedCaseIds: detail.linkedCaseIds,
      judgmentId: detail.judgmentId,
      planId: detail.planId,
      latestStreamId: detail.latestStreamId,
    },
    recommendedAction: proposal.recommendedAction,
    verificationCommands: proposal.verificationCommands,
    guardrails: proposal.notes,
    automaticFixAvailable: false,
    requiresHumanApproval: true,
    source: 'ops:product-state:audit',
  }));
}

function buildCaseSampleDetail(case_: {
  id: string;
  mode: string;
  status?: string;
  session_id?: string | null;
  updated_at?: Date;
  chat_to_case_links?: unknown[] | null;
}): AuditSampleDetail {
  return {
    id: case_.id,
    entityType: 'case',
    productFlow: getCaseProductFlow(case_),
    mode: case_.mode,
    status: case_.status,
    sessionBound: isSessionBoundCase(case_),
    updatedAt: case_.updated_at,
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
  const stuckRepairTracksWhere = {
    status: 'replanning',
    updated_at: { lt: cutoff },
  } as const;

  const [
    stuckCasesCount,
    stuckCases,
    stuckChatRoomsCount,
    stuckChatRooms,
    incompleteChatLinksCount,
    incompleteChatLinks,
    stuckRepairTracksCount,
    stuckRepairTracks,
  ] = await Promise.all([
    prisma.case.count({ where: stuckCasesWhere }),
    prisma.case.findMany({
      where: stuckCasesWhere,
      select: {
        id: true,
        mode: true,
        status: true,
        session_id: true,
        updated_at: true,
        chat_to_case_links: { select: { id: true }, take: 1 },
      },
      take: 20,
      orderBy: { updated_at: 'asc' },
    }),
    prisma.chatRoom.count({ where: stuckChatRoomsWhere }),
    prisma.chatRoom.findMany({
      where: stuckChatRoomsWhere,
      select: {
        id: true,
        status: true,
        session_id: true,
        updated_at: true,
        case_links: {
          select: {
            id: true,
            case_id: true,
            judgment_id: true,
          },
          take: 5,
          orderBy: { created_at: 'asc' },
        },
      },
      take: 20,
      orderBy: { updated_at: 'asc' },
    }),
    prisma.chatToCaseLink.count({ where: incompleteChatLinksWhere }),
    prisma.chatToCaseLink.findMany({
      where: incompleteChatLinksWhere,
      select: {
        id: true,
        room_id: true,
        case_id: true,
        judgment_id: true,
        created_at: true,
        case: {
          select: {
            id: true,
            mode: true,
            status: true,
            session_id: true,
          },
        },
      },
      take: 20,
      orderBy: { created_at: 'asc' },
    }),
    prisma.repairTrack.count({ where: stuckRepairTracksWhere }),
    prisma.repairTrack.findMany({
      where: stuckRepairTracksWhere,
      select: {
        id: true,
        plan_id: true,
        status: true,
        status_reason: true,
        updated_at: true,
        last_replan_at: true,
        plan: {
          select: {
            judgment_id: true,
            judgment: {
              select: {
                case_id: true,
              },
            },
          },
        },
      },
      take: 20,
      orderBy: { updated_at: 'asc' },
    }),
  ]);

  const stuckRepairTrackIds = stuckRepairTracks.map((item) => item.id);
  const latestRepairTrackStreams = stuckRepairTrackIds.length > 0
    ? await prisma.aIStreamSession.findMany({
        where: {
          scope_type: 'repair_track',
          scope_id: { in: stuckRepairTrackIds },
        },
        select: {
          scope_id: true,
          stream_id: true,
          request_id: true,
          status: true,
          last_event_type: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: stuckRepairTrackIds.length * 3,
      })
    : [];
  const latestStreamByTrackId = new Map<string, (typeof latestRepairTrackStreams)[number]>();
  for (const stream of latestRepairTrackStreams) {
    if (!latestStreamByTrackId.has(stream.scope_id)) {
      latestStreamByTrackId.set(stream.scope_id, stream);
    }
  }

  const stuckCaseDetails = stuckCases.map(buildCaseSampleDetail);
  const stuckCaseProposal = buildRecoveryProposal({
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
  });

  const stuckChatRoomDetails = stuckChatRooms.map((item) => ({
    id: item.id,
    entityType: 'chat_room' as const,
    productFlow: 'chat_to_case' as const,
    status: item.status,
    sessionBound: Boolean(item.session_id),
    linkedCaseIds: item.case_links.map((link) => link.case_id),
    judgmentId: item.case_links[0]?.judgment_id ?? null,
    updatedAt: item.updated_at,
  }));
  const stuckChatRoomProposal = buildRecoveryProposal({
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
  });

  const incompleteChatLinkDetails = incompleteChatLinks.map((item) => ({
    id: item.id,
    entityType: 'chat_to_case_link' as const,
    productFlow: getCaseProductFlow({
      ...item.case,
      chat_to_case_links: [{ id: item.id }],
    }),
    mode: item.case.mode,
    status: item.case.status,
    sessionBound: Boolean(item.case.session_id),
    roomId: item.room_id,
    caseId: item.case_id,
    judgmentId: item.judgment_id,
    createdAt: item.created_at,
  }));
  const incompleteChatLinkProposal = buildRecoveryProposal({
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
  });

  const stuckRepairTrackDetails = stuckRepairTracks.map((item) => {
    const latestStream = latestStreamByTrackId.get(item.id);
    return {
      id: item.id,
      entityType: 'repair_track' as const,
      status: item.status,
      planId: item.plan_id,
      caseId: item.plan.judgment.case_id,
      judgmentId: item.plan.judgment_id,
      latestStreamId: latestStream?.stream_id ?? null,
      latestStreamStatus: latestStream?.status ?? null,
      latestStreamUpdatedAt: latestStream?.updated_at ?? null,
      updatedAt: item.updated_at,
    };
  });
  const stuckRepairTrackProposal = buildRecoveryProposal({
    id: 'recover-stuck-repair-track-replan',
    severity: 'warning',
    entityType: 'repair_track',
    entityIds: stuckRepairTracks.map((item) => item.id),
    recommendedAction: '人工核對 repair_track 對應最新 AI stream；若 stream 已 failed/cancelled 或不存在，允許用既有 replan retry 流程重試，或按最後可用方案恢復到 solo_active/co_active。',
    verificationCommands: [
      'cd backend && npm run ops:product-state:audit',
      '查詢 repair_tracks、reconciliation_plans、ai_stream_sessions、ai_stream_events 對應 row',
      '完成人工恢復後再次執行 cd backend && npm run ops:product-state:audit',
    ],
    notes: [
      '不要直接把 replanning track 改回 active；必須先核對最新 stream 狀態與是否已生成 superseded_by_plan_id。',
      '如果最新 stream 仍為 created/queued/started/streaming/completed，先確認是否仍在有效窗口內或可從 snapshot 恢復。',
      '如果 stream 已 persisted 但 track 仍卡在 replanning，優先核對新 plan version、step_progresses 與 repair_track_events 是否已寫完。',
    ],
  });

  return [
    {
      check: `cases stuck in_progress over ${stuckMinutes}m`,
      count: stuckCasesCount,
      sampleIds: stuckCases.map((item) => item.id),
      sampleDetails: stuckCaseDetails,
      recoveryProposal: stuckCaseProposal,
      recoveryTasks: buildRecoveryTasks(stuckCaseProposal, stuckCaseDetails),
    },
    {
      check: `chat rooms stuck judgment_requested over ${stuckMinutes}m`,
      count: stuckChatRoomsCount,
      sampleIds: stuckChatRooms.map((item) => item.id),
      sampleDetails: stuckChatRoomDetails,
      recoveryProposal: stuckChatRoomProposal,
      recoveryTasks: buildRecoveryTasks(stuckChatRoomProposal, stuckChatRoomDetails),
    },
    {
      check: 'chat_to_case_links missing judgment_id while case completed',
      count: incompleteChatLinksCount,
      sampleIds: incompleteChatLinks.map((item) => item.id),
      sampleDetails: incompleteChatLinkDetails,
      recoveryProposal: incompleteChatLinkProposal,
      recoveryTasks: buildRecoveryTasks(incompleteChatLinkProposal, incompleteChatLinkDetails),
    },
    {
      check: `repair tracks stuck replanning over ${stuckMinutes}m`,
      count: stuckRepairTracksCount,
      sampleIds: stuckRepairTracks.map((item) => item.id),
      sampleDetails: stuckRepairTrackDetails,
      recoveryProposal: stuckRepairTrackProposal,
      recoveryTasks: buildRecoveryTasks(stuckRepairTrackProposal, stuckRepairTrackDetails),
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
