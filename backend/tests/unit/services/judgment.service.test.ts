/**
 * JudgmentService 單元測試（mock Prisma/AI/Lock，避免連接DB）
 */

const prismaMock: any = {
  judgment: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const aiServiceMock = {
  generateJudgment: jest.fn(),
};

const sessionServiceMock = {
  getSession: jest.fn(),
  markSessionCompleted: jest.fn(),
};

const lockServiceMock = {
  withLock: jest.fn(async (_key: string, fn: any) => fn()),
};

const loggerMock = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: aiServiceMock,
}));

jest.mock('../../../src/services/session.service', () => ({
  __esModule: true,
  sessionService: sessionServiceMock,
}));

jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: lockServiceMock,
}));

import { JudgmentService } from '../../../src/services/judgment.service';

describe('JudgmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  });

  it('generateJudgment：應允許 judgment_failed 重試，並設置 in_progress → completed', async () => {
    const caseId = 'case-1';
    const sessionId = 'guest_1704067200000_a1b2c3d4e5f6g7h8';

    prismaMock.judgment.findUnique
      .mockResolvedValueOnce(null) // existing
      .mockResolvedValueOnce(null); // existing2 in transaction

    prismaMock.case.findUnique.mockResolvedValueOnce({
      id: caseId,
      status: 'judgment_failed',
      mode: 'quick',
      session_id: sessionId,
      type: '其他衝突',
      plaintiff_statement: 'A'.repeat(60),
      defendant_statement: 'B'.repeat(60),
    });

    aiServiceMock.generateJudgment.mockResolvedValueOnce({
      content: 'judgment content',
      responsibilityRatio: { plaintiff: 60, defendant: 40 },
      summary: 'summary',
    });

    prismaMock.judgment.create.mockResolvedValueOnce({
      id: 'judgment-1',
      case_id: caseId,
      judgment_content: 'judgment content',
      summary: 'summary',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
    });

    prismaMock.case.update.mockResolvedValue({ id: caseId });
    sessionServiceMock.markSessionCompleted.mockResolvedValue(undefined);

    const service = new JudgmentService();
    const judgment = await service.generateJudgment(caseId);

    expect(lockServiceMock.withLock).toHaveBeenCalled();
    expect(aiServiceMock.generateJudgment).toHaveBeenCalled();

    // 先設為 in_progress
    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: caseId },
        data: expect.objectContaining({ status: 'in_progress' }),
      })
    );

    // transaction 內設為 completed
    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: caseId },
        data: expect.objectContaining({ status: 'completed' }),
      })
    );

    expect(sessionServiceMock.markSessionCompleted).toHaveBeenCalledWith(sessionId);
    expect(judgment).toMatchObject({ case_id: caseId, id: 'judgment-1' });
  });

  it('getJudgmentByCaseId：quick 且 judgment_failed 應拋出 JUDGMENT_FAILED', async () => {
    const caseId = 'case-2';
    const sessionId = 'guest_1704067200000_a1b2c3d4e5f6g7h8';

    prismaMock.case.findUnique.mockResolvedValueOnce({
      id: caseId,
      mode: 'quick',
      status: 'judgment_failed',
      session_id: sessionId,
      pairing: { user1_id: null, user2_id: null },
      plaintiff_id: null,
      defendant_id: null,
    });

    sessionServiceMock.getSession.mockResolvedValueOnce({
      id: sessionId,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    const service = new JudgmentService();

    await expect(service.getJudgmentByCaseId(caseId, undefined, sessionId)).rejects.toMatchObject({
      code: 'JUDGMENT_FAILED',
    });
  });
});
