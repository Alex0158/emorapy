const mockGenerateText = jest.fn();

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: { generateText: mockGenerateText },
}));

import { MediationStrategyService } from '../../../src/services/mediation-strategy.service';

describe('MediationStrategyService Wave 0 containment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('never sends aggregated private sources to an external model', async () => {
    const privateRaw = 'PRIVATE-CANARY: childhood trauma';

    const result = await new MediationStrategyService().extractAggregatedControlsWithOutcome(
      'room-1',
      [
        { participantId: 'participant-a', messages: [privateRaw] },
        { participantId: 'participant-b', messages: ['SECOND-PRIVATE-CANARY'] },
      ],
    );

    expect(result).toEqual({ controls: null, outcome: 'containment_disabled' });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('legacy convenience API also fails closed', async () => {
    const result = await new MediationStrategyService().extractAggregatedControls(
      'room-1',
      [{ participantId: 'participant-a', messages: ['private input'] }],
    );

    expect(result).toBeNull();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
