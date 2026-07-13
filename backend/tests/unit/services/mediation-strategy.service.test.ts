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

  it('compiles exactly one owner source through the strict control schema', async () => {
    mockGenerateText.mockResolvedValue(JSON.stringify({
      pace: 'slower',
      ask_permission_before_depth: true,
      offer_pause: true,
      question_style: 'gentle',
      max_questions: 1,
    }));

    const result = await new MediationStrategyService().extractOwnerControlsWithOutcome({
      roomId: 'room-1',
      ownerParticipantId: 'participant-a',
      messages: ['PRIVATE-A-CANARY'],
    });

    expect(result).toEqual({
      outcome: 'emitted',
      controls: {
        pace: 'slower',
        ask_permission_before_depth: true,
        offer_pause: true,
        question_style: 'gentle',
        max_questions: 1,
      },
    });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockGenerateText.mock.calls[0][1])).not.toContain('participant-a');
  });

  it('rejects output with reasons, attribution or extra keys', async () => {
    mockGenerateText.mockResolvedValue(JSON.stringify({
      pace: 'slower',
      ask_permission_before_depth: true,
      offer_pause: true,
      question_style: 'gentle',
      max_questions: 1,
      reason: 'because participant A disclosed trauma',
    }));

    const result = await new MediationStrategyService().extractOwnerControlsWithOutcome({
      roomId: 'room-1',
      ownerParticipantId: 'participant-a',
      messages: ['malicious private source'],
    });

    expect(result).toEqual({ controls: null, outcome: 'schema_rejected' });
  });
});
