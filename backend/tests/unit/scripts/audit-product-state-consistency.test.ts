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
    prismaMock.case.findMany.mockResolvedValueOnce([{ id: 'case-a' }, { id: 'case-b' }]);
    prismaMock.chatRoom.count.mockResolvedValueOnce(1);
    prismaMock.chatRoom.findMany.mockResolvedValueOnce([{ id: 'room-a' }]);
    prismaMock.chatToCaseLink.count.mockResolvedValueOnce(1);
    prismaMock.chatToCaseLink.findMany.mockResolvedValueOnce([{ id: 'link-a' }]);

    const result = await runProductStateConsistencyAudit(15);

    expect(result).toEqual([
      expect.objectContaining({
        check: 'cases stuck in_progress over 15m',
        count: 2,
        sampleIds: ['case-a', 'case-b'],
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
  });
});
