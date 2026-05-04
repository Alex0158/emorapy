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
  $disconnect: jest.fn(),
};

jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

import { runProductStateConsistencyAudit } from '../../../scripts/audit-product-state-consistency';

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
});
