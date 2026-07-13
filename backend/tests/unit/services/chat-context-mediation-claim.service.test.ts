import type { Prisma } from '@prisma/client';

const safetyRouterMock = {
  assertSharedMessagingAllowed: jest.fn(),
};

const transactionClient = {
  $queryRaw: jest.fn(),
  chatRoom: { findUnique: jest.fn() },
  contextCapsule: { findMany: jest.fn() },
  contextUseAudit: { create: jest.fn() },
};

const prismaMock = {
  $transaction: jest.fn(
    async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(transactionClient as unknown as Prisma.TransactionClient),
  ),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../src/services/chat-safety-router.service', () => ({
  chatSafetyRouterService: safetyRouterMock,
}));

import { ChatContextMediationClaimService } from '../../../src/services/chat-context-mediation-claim.service';

describe('ChatContextMediationClaimService safety claim ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionClient.$queryRaw.mockResolvedValue([]);
    safetyRouterMock.assertSharedMessagingAllowed.mockResolvedValue(undefined);
  });

  it('locks participants and checks safety in the same transaction even without private-derived context', async () => {
    const service = new ChatContextMediationClaimService();

    await expect(service.claimSharedMediationUses({
      roomId: 'room-1',
      adaptation: null,
      capsules: [],
    })).resolves.toEqual({ controls: null, capsules: [] });

    expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(safetyRouterMock.assertSharedMessagingAllowed).toHaveBeenCalledWith(
      'room-1',
      transactionClient,
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(transactionClient.contextUseAudit.create).not.toHaveBeenCalled();
  });

  it('reads committed Safety after the ordered participant lock wait before claiming shared provider use', async () => {
    let releaseParticipantLock!: () => void;
    transactionClient.$queryRaw.mockReturnValueOnce(new Promise<void>(resolve => {
      releaseParticipantLock = resolve;
    }));
    safetyRouterMock.assertSharedMessagingAllowed.mockRejectedValueOnce(Object.assign(
      new Error('共同對話目前暫停'),
      { code: 'CASE_NOT_EDITABLE' },
    ));
    const service = new ChatContextMediationClaimService();

    const claim = service.claimSharedMediationUses({
      roomId: 'room-1',
      adaptation: null,
      capsules: [],
    });

    await Promise.resolve();
    expect(safetyRouterMock.assertSharedMessagingAllowed).not.toHaveBeenCalled();

    releaseParticipantLock();
    await expect(claim).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });

    expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(safetyRouterMock.assertSharedMessagingAllowed).toHaveBeenCalledWith(
      'room-1',
      transactionClient,
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(transactionClient.contextUseAudit.create).not.toHaveBeenCalled();
  });

  it('fails the owner strategy provider claim closed when Safety commits during the lock wait', async () => {
    let releaseParticipantLock!: () => void;
    transactionClient.$queryRaw.mockReturnValueOnce(new Promise<void>(resolve => {
      releaseParticipantLock = resolve;
    }));
    safetyRouterMock.assertSharedMessagingAllowed.mockRejectedValueOnce(Object.assign(
      new Error('共同對話目前暫停'),
      { code: 'CASE_NOT_EDITABLE' },
    ));
    const service = new ChatContextMediationClaimService();

    const claim = service.claimOwnerStrategyCompilation({
      roomId: 'room-1',
      ownerParticipantId: 'participant-a',
      participantSnapshotHash: 'snapshot-hash',
      sourceRefs: ['private-message-1'],
      contentHashes: ['content-hash-1'],
    });

    await Promise.resolve();
    expect(safetyRouterMock.assertSharedMessagingAllowed).not.toHaveBeenCalled();

    releaseParticipantLock();
    await expect(claim).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });

    expect(safetyRouterMock.assertSharedMessagingAllowed).toHaveBeenCalledWith(
      'room-1',
      transactionClient,
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(transactionClient.chatRoom.findUnique).not.toHaveBeenCalled();
    expect(transactionClient.contextUseAudit.create).not.toHaveBeenCalled();
  });
});
