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
      { check: 'cases stuck in_progress over 15m', count: 2, sampleIds: ['case-a', 'case-b'] },
      { check: 'chat rooms stuck judgment_requested over 15m', count: 1, sampleIds: ['room-a'] },
      { check: 'chat_to_case_links missing judgment_id while case completed', count: 1, sampleIds: ['link-a'] },
    ]);
    expect(prismaMock.case.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'in_progress' }),
    });
  });
});
