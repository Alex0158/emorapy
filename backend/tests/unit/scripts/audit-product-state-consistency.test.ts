const prismaMock = {
  case: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  chatRoom: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  chatToCaseLink: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  repairTrack: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  aIStreamSession: {
    findMany: jest.fn(),
  },
  productStateRecoveryTask: {
    upsert: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

import {
  persistProductStateRecoveryTasks,
  runProductStateConsistencyAudit,
} from '../../../scripts/audit-product-state-consistency';

describe('audit-product-state-consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('返回四類只讀一致性檢查結果', async () => {
    prismaMock.case.count.mockResolvedValueOnce(2);
    prismaMock.case.findMany.mockResolvedValueOnce([
      {
        id: 'case-a',
        mode: 'quick',
        status: 'in_progress',
        session_id: null,
        updated_at: new Date('2026-05-03T00:00:00.000Z'),
        chat_to_case_links: [],
      },
      {
        id: 'case-b',
        mode: 'collaborative',
        status: 'in_progress',
        session_id: null,
        updated_at: new Date('2026-05-03T00:01:00.000Z'),
        chat_to_case_links: [],
      },
    ]);
    prismaMock.chatRoom.count.mockResolvedValueOnce(1);
    prismaMock.chatRoom.findMany.mockResolvedValueOnce([
      {
        id: 'room-a',
        status: 'judgment_requested',
        session_id: null,
        updated_at: new Date('2026-05-03T00:02:00.000Z'),
        case_links: [{ id: 'link-room-a', case_id: 'case-chat-a', judgment_id: null }],
      },
    ]);
    prismaMock.chatToCaseLink.count.mockResolvedValueOnce(1);
    prismaMock.chatToCaseLink.findMany.mockResolvedValueOnce([
      {
        id: 'link-a',
        room_id: 'room-a',
        case_id: 'case-chat-a',
        judgment_id: null,
        created_at: new Date('2026-05-03T00:03:00.000Z'),
        case: {
          id: 'case-chat-a',
          mode: 'quick',
          status: 'completed',
          session_id: null,
        },
      },
    ]);
    prismaMock.repairTrack.count.mockResolvedValueOnce(1);
    prismaMock.repairTrack.findMany.mockResolvedValueOnce([
      {
        id: 'track-a',
        plan_id: 'plan-a',
        status: 'replanning',
        status_reason: 'manual',
        updated_at: new Date('2026-05-03T00:04:00.000Z'),
        last_replan_at: new Date('2026-05-03T00:04:00.000Z'),
        plan: {
          judgment_id: 'judgment-a',
          judgment: {
            case_id: 'case-a',
          },
        },
      },
    ]);
    prismaMock.aIStreamSession.findMany.mockResolvedValueOnce([
      {
        scope_id: 'track-a',
        stream_id: 'stream-a',
        request_id: 'request-a',
        status: 'failed',
        last_event_type: 'stream.failed',
        updated_at: new Date('2026-05-03T00:05:00.000Z'),
      },
    ]);

    const result = await runProductStateConsistencyAudit(15);

    expect(result).toEqual([
      expect.objectContaining({
        check: 'cases stuck in_progress over 15m',
        count: 2,
        sampleIds: ['case-a', 'case-b'],
        sampleDetails: [
          expect.objectContaining({
            id: 'case-a',
            entityType: 'case',
            productFlow: 'quick_single',
            mode: 'quick',
            status: 'in_progress',
            sessionBound: true,
          }),
          expect.objectContaining({
            id: 'case-b',
            entityType: 'case',
            productFlow: 'formal_collaborative',
            mode: 'collaborative',
            status: 'in_progress',
            sessionBound: false,
          }),
        ],
        recoveryProposal: expect.objectContaining({
          id: 'recover-stuck-case-judgment-generation',
          entityType: 'case',
          entityIds: ['case-a', 'case-b'],
          automaticFixAvailable: false,
          requiresHumanApproval: true,
        }),
        recoveryTasks: [
          expect.objectContaining({
            id: 'recover-stuck-case-judgment-generation:case-a',
            proposalId: 'recover-stuck-case-judgment-generation',
            status: 'manual_review_required',
            entityType: 'case',
            entityId: 'case-a',
            productFlow: 'quick_single',
            automaticFixAvailable: false,
            requiresHumanApproval: true,
            source: 'ops:product-state:audit',
          }),
          expect.objectContaining({
            id: 'recover-stuck-case-judgment-generation:case-b',
            proposalId: 'recover-stuck-case-judgment-generation',
            status: 'manual_review_required',
            entityType: 'case',
            entityId: 'case-b',
            productFlow: 'formal_collaborative',
            automaticFixAvailable: false,
            requiresHumanApproval: true,
            source: 'ops:product-state:audit',
          }),
        ],
      }),
      expect.objectContaining({
        check: 'chat rooms stuck judgment_requested over 15m',
        count: 1,
        sampleIds: ['room-a'],
        sampleDetails: [
          expect.objectContaining({
            id: 'room-a',
            entityType: 'chat_room',
            productFlow: 'chat_to_case',
            status: 'judgment_requested',
            linkedCaseIds: ['case-chat-a'],
            judgmentId: null,
          }),
        ],
        recoveryProposal: expect.objectContaining({
          id: 'recover-stuck-chat-judgment-request',
          entityType: 'chat_room',
          entityIds: ['room-a'],
          automaticFixAvailable: false,
          requiresHumanApproval: true,
        }),
        recoveryTasks: [
          expect.objectContaining({
            id: 'recover-stuck-chat-judgment-request:room-a',
            proposalId: 'recover-stuck-chat-judgment-request',
            status: 'manual_review_required',
            entityType: 'chat_room',
            entityId: 'room-a',
            productFlow: 'chat_to_case',
            linkedEntityIds: expect.objectContaining({
              linkedCaseIds: ['case-chat-a'],
              judgmentId: null,
            }),
            automaticFixAvailable: false,
            requiresHumanApproval: true,
            source: 'ops:product-state:audit',
          }),
        ],
      }),
      expect.objectContaining({
        check: 'chat_to_case_links missing judgment_id while case completed',
        count: 1,
        sampleIds: ['link-a'],
        sampleDetails: [
          expect.objectContaining({
            id: 'link-a',
            entityType: 'chat_to_case_link',
            productFlow: 'chat_to_case',
            mode: 'quick',
            status: 'completed',
            sessionBound: true,
            roomId: 'room-a',
            caseId: 'case-chat-a',
            judgmentId: null,
          }),
        ],
        recoveryProposal: expect.objectContaining({
          id: 'repair-chat-to-case-link-missing-judgment',
          entityType: 'chat_to_case_link',
          entityIds: ['link-a'],
          automaticFixAvailable: false,
          requiresHumanApproval: true,
        }),
        recoveryTasks: [
          expect.objectContaining({
            id: 'repair-chat-to-case-link-missing-judgment:link-a',
            proposalId: 'repair-chat-to-case-link-missing-judgment',
            status: 'manual_review_required',
            entityType: 'chat_to_case_link',
            entityId: 'link-a',
            productFlow: 'chat_to_case',
            linkedEntityIds: expect.objectContaining({
              roomId: 'room-a',
              caseId: 'case-chat-a',
              judgmentId: null,
            }),
            automaticFixAvailable: false,
            requiresHumanApproval: true,
            source: 'ops:product-state:audit',
          }),
        ],
      }),
      expect.objectContaining({
        check: 'repair tracks stuck replanning over 15m',
        count: 1,
        sampleIds: ['track-a'],
        sampleDetails: [
          expect.objectContaining({
            id: 'track-a',
            entityType: 'repair_track',
            status: 'replanning',
            planId: 'plan-a',
            caseId: 'case-a',
            judgmentId: 'judgment-a',
            latestStreamId: 'stream-a',
            latestStreamStatus: 'failed',
          }),
        ],
        recoveryProposal: expect.objectContaining({
          id: 'recover-stuck-repair-track-replan',
          entityType: 'repair_track',
          entityIds: ['track-a'],
          automaticFixAvailable: false,
          requiresHumanApproval: true,
        }),
        recoveryTasks: [
          expect.objectContaining({
            id: 'recover-stuck-repair-track-replan:track-a',
            proposalId: 'recover-stuck-repair-track-replan',
            status: 'manual_review_required',
            entityType: 'repair_track',
            entityId: 'track-a',
            linkedEntityIds: expect.objectContaining({
              caseId: 'case-a',
              judgmentId: 'judgment-a',
              planId: 'plan-a',
              latestStreamId: 'stream-a',
            }),
            automaticFixAvailable: false,
            requiresHumanApproval: true,
            source: 'ops:product-state:audit',
          }),
        ],
      }),
    ]);
    expect(prismaMock.case.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'in_progress' }),
    });
    expect(prismaMock.repairTrack.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'replanning' }),
    });
    expect(prismaMock.aIStreamSession.findMany).toHaveBeenCalledWith({
      where: {
        scope_type: 'repair_track',
        scope_id: { in: ['track-a'] },
      },
      select: expect.objectContaining({
        stream_id: true,
        status: true,
      }),
      orderBy: { updated_at: 'desc' },
      take: 3,
    });
  });

  it('沒有 findings 時不產生 recovery proposal', async () => {
    prismaMock.case.count.mockResolvedValueOnce(0);
    prismaMock.case.findMany.mockResolvedValueOnce([]);
    prismaMock.chatRoom.count.mockResolvedValueOnce(0);
    prismaMock.chatRoom.findMany.mockResolvedValueOnce([]);
    prismaMock.chatToCaseLink.count.mockResolvedValueOnce(0);
    prismaMock.chatToCaseLink.findMany.mockResolvedValueOnce([]);
    prismaMock.repairTrack.count.mockResolvedValueOnce(0);
    prismaMock.repairTrack.findMany.mockResolvedValueOnce([]);

    const result = await runProductStateConsistencyAudit(30);

    expect(result.every((item) => item.recoveryProposal === null)).toBe(true);
    expect(result.every((item) => item.sampleDetails.length === 0)).toBe(true);
    expect(result.every((item) => item.recoveryTasks.length === 0)).toBe(true);
    expect(prismaMock.aIStreamSession.findMany).not.toHaveBeenCalled();
  });

  it('可將人工 recovery task 候選 upsert 成 DB-backed 任務', async () => {
    const detectedAt = new Date('2026-05-04T10:00:00.000Z');
    prismaMock.productStateRecoveryTask.upsert.mockResolvedValue({});

    const result = await persistProductStateRecoveryTasks([
      {
        check: 'cases stuck in_progress over 30m',
        count: 1,
        sampleIds: ['case-a'],
        sampleDetails: [],
        recoveryProposal: null,
        recoveryTasks: [
          {
            id: 'recover-stuck-case-judgment-generation:case-a',
            proposalId: 'recover-stuck-case-judgment-generation',
            status: 'manual_review_required',
            severity: 'critical',
            entityType: 'case',
            entityId: 'case-a',
            productFlow: 'quick_single',
            linkedEntityIds: { caseId: 'case-a', judgmentId: null },
            recommendedAction: '人工核對是否仍有 active AI stream',
            verificationCommands: ['cd backend && npm run ops:product-state:audit'],
            guardrails: ['不要直接把 in_progress case 更新為 completed。'],
            automaticFixAvailable: false,
            requiresHumanApproval: true,
            source: 'ops:product-state:audit',
          },
        ],
      },
    ] as any, detectedAt);

    expect(result).toEqual({
      foundTaskCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
    });
    expect(prismaMock.productStateRecoveryTask.upsert).toHaveBeenCalledWith({
      where: { source_task_id: 'recover-stuck-case-judgment-generation:case-a' },
      create: expect.objectContaining({
        source: 'ops:product-state:audit',
        source_task_id: 'recover-stuck-case-judgment-generation:case-a',
        proposal_id: 'recover-stuck-case-judgment-generation',
        status: 'manual_review_required',
        severity: 'critical',
        entity_type: 'case',
        entity_id: 'case-a',
        product_flow: 'quick_single',
        linked_entity_ids: { caseId: 'case-a', judgmentId: null },
        first_detected_at: detectedAt,
        last_detected_at: detectedAt,
      }),
      update: expect.objectContaining({
        severity: 'critical',
        product_flow: 'quick_single',
        linked_entity_ids: { caseId: 'case-a', judgmentId: null },
        occurrence_count: { increment: 1 },
        last_detected_at: detectedAt,
      }),
    });
  });

  it('release audit 頂層查詢保持串行，避免耗盡 production session pool', async () => {
    let activeQueries = 0;
    let maxActiveQueries = 0;
    const trackedResult = <T>(value: T) => () => {
      activeQueries += 1;
      maxActiveQueries = Math.max(maxActiveQueries, activeQueries);
      return new Promise<T>((resolve) => {
        queueMicrotask(() => {
          activeQueries -= 1;
          resolve(value);
        });
      });
    };

    prismaMock.case.count.mockImplementation(trackedResult(0));
    prismaMock.case.findMany.mockImplementation(trackedResult([]));
    prismaMock.chatRoom.count.mockImplementation(trackedResult(0));
    prismaMock.chatRoom.findMany.mockImplementation(trackedResult([]));
    prismaMock.chatToCaseLink.count.mockImplementation(trackedResult(0));
    prismaMock.chatToCaseLink.findMany.mockImplementation(trackedResult([]));
    prismaMock.repairTrack.count.mockImplementation(trackedResult(0));
    prismaMock.repairTrack.findMany.mockImplementation(trackedResult([]));

    await runProductStateConsistencyAudit(30);

    expect(maxActiveQueries).toBe(1);
  });
});
