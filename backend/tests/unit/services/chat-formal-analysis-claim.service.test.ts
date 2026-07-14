const txMock = {};
const prismaMock = {
  $transaction: jest.fn(),
};
const actorAccessMock = {
  lockActiveHumanParticipants: jest.fn(),
};
const safetyRouterMock = {
  assertFormalAnalysisAllowed: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: actorAccessMock,
}));
jest.mock('../../../src/services/chat-safety-router.service', () => ({
  chatSafetyRouterService: safetyRouterMock,
}));

import { ChatFormalAnalysisClaimService } from '../../../src/services/chat-formal-analysis-claim.service';

describe('ChatFormalAnalysisClaimService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async callback => callback(txMock));
    actorAccessMock.lockActiveHumanParticipants.mockResolvedValue(undefined);
    safetyRouterMock.assertFormalAnalysisAllowed.mockResolvedValue(undefined);
  });

  it('uses ReadCommitted and checks formal Safety after the ordered participant lock', async () => {
    const service = new ChatFormalAnalysisClaimService();

    await service.claimProviderUse('room-1');

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(actorAccessMock.lockActiveHumanParticipants).toHaveBeenCalledWith(
      txMock,
      'room-1',
    );
    expect(safetyRouterMock.assertFormalAnalysisAllowed).toHaveBeenCalledWith(
      'room-1',
      txMock,
    );
    expect(actorAccessMock.lockActiveHumanParticipants.mock.invocationCallOrder[0]).toBeLessThan(
      safetyRouterMock.assertFormalAnalysisAllowed.mock.invocationCallOrder[0],
    );
  });
});
