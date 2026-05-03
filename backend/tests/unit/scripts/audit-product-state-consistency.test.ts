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

  it('返回三類只讀一致性檢查結果', async () => {
    prismaMock.case.count.mockResolvedValueOnce(2);
    prismaMock.case.findMany.mockResolvedValueOnce([
      {
        id: 'case-a',
        mode: 'quick',
        status: 'in_progress',
        session_id: 'session-a',
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
          mode: 'remote',
          status: 'completed',
          session_id: null,
        },
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
            mode: 'remote',
            status: 'completed',
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
      }),
    ]);
    expect(prismaMock.case.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'in_progress' }),
    });
  });

  it('沒有 findings 時不產生 recovery proposal', async () => {
    prismaMock.case.count.mockResolvedValueOnce(0);
    prismaMock.case.findMany.mockResolvedValueOnce([]);
    prismaMock.chatRoom.count.mockResolvedValueOnce(0);
    prismaMock.chatRoom.findMany.mockResolvedValueOnce([]);
    prismaMock.chatToCaseLink.count.mockResolvedValueOnce(0);
    prismaMock.chatToCaseLink.findMany.mockResolvedValueOnce([]);

    const result = await runProductStateConsistencyAudit(30);

    expect(result.every((item) => item.recoveryProposal === null)).toBe(true);
    expect(result.every((item) => item.sampleDetails.length === 0)).toBe(true);
  });
});
