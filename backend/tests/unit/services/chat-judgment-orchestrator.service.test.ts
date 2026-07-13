const prismaMock = {
  chatRoom: {
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  chatToCaseLink: { update: jest.fn() },
  $transaction: jest.fn(),
};
const judgmentServiceMock = { generateJudgment: jest.fn() };
const evidenceServiceMock = {
  markCompleted: jest.fn(),
  claimCaseGenerationInTransaction: jest.fn(),
  claimSubmittedForProcessingInTransaction: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/judgment.service', () => ({
  judgmentService: judgmentServiceMock,
}));
jest.mock('../../../src/services/chat-analysis-evidence.service', () => ({
  chatAnalysisEvidenceService: evidenceServiceMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { ChatJudgmentOrchestrator } from '../../../src/services/chat-judgment-orchestrator.service';

type JudgmentLifecycleAccess = {
  finalizeJudgment(input: {
    roomId: string;
    caseId: string;
    linkId: string;
    evidence: {
      requestId: string;
      selectionHash: string;
      policyVersion: string;
      requiredParticipantIds: string[];
      approvalIds: string[];
      messages: never[];
      capsules: never[];
    } | null;
    actor: { userId?: string; sessionId?: string };
    locale?: 'en-US' | 'zh-TW';
  }): Promise<string | undefined>;
  markJudgmentFailed(
    roomId: string,
    options?: { onlyIfRequested?: boolean },
  ): Promise<void>;
};

describe('ChatJudgmentOrchestrator lifecycle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async callback => callback(prismaMock));
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-1' });
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-1' });
    evidenceServiceMock.markCompleted.mockResolvedValue(undefined);
  });

  it('directly uses one finalize boundary for judgment, room, link and exact evidence', async () => {
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: 'judgment-1' });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;
    const evidence = {
      requestId: 'request-1',
      selectionHash: 'selection-hash',
      policyVersion: 'policy-v1',
      requiredParticipantIds: ['participant-a'],
      approvalIds: ['approval-a'],
      messages: [] as never[],
      capsules: [] as never[],
    };

    await expect(service.finalizeJudgment({
      roomId: 'room-1',
      caseId: 'case-1',
      linkId: 'link-1',
      evidence,
      actor: { userId: 'user-a' },
      locale: 'en-US',
    })).resolves.toBe('judgment-1');

    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith('case-1', {
      userId: 'user-a',
      sessionId: undefined,
      locale: 'en-US',
      expectedChatAnalysisRequestId: 'request-1',
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatRoom.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { status: 'judgment_completed' },
    });
    expect(prismaMock.chatToCaseLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { judgment_id: 'judgment-1' },
    });
    expect(evidenceServiceMock.markCompleted).toHaveBeenCalledWith('request-1', prismaMock);
  });

  it('directly keeps recovery failure transition conditional on requested state', async () => {
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await service.markJudgmentFailed('room-1', { onlyIfRequested: true });

    expect(prismaMock.chatRoom.updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', status: 'judgment_requested' },
      data: { status: 'judgment_failed' },
    });
    expect(prismaMock.chatRoom.update).not.toHaveBeenCalled();
  });

  it('directly retries Chat state finalization once after Judgment persistence', async () => {
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: 'judgment-retry-finalize' });
    prismaMock.$transaction
      .mockRejectedValueOnce(new Error('outer transaction unavailable'))
      .mockImplementationOnce(async callback => callback(prismaMock));
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.finalizeJudgment({
      roomId: 'room-1',
      caseId: 'case-1',
      linkId: 'link-1',
      evidence: null,
      actor: { userId: 'user-a' },
    })).resolves.toBe('judgment-retry-finalize');

    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.chatRoom.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { status: 'judgment_completed' },
    });
    expect(prismaMock.chatToCaseLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { judgment_id: 'judgment-retry-finalize' },
    });
  });
});
