const mockGenerateText = jest.fn();
const mockWarn = jest.fn();

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: { generateText: mockGenerateText },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { warn: mockWarn },
}));

import {
  MediationStrategyService,
  mediationStrategyInternals,
} from '../../../src/services/mediation-strategy.service';

const VALID_CONTROLS = {
  pace: 'slower' as const,
  ask_permission_before_depth: true,
  offer_pause: true,
  question_style: 'gentle' as const,
  max_questions: 1 as const,
};

describe('MediationStrategyService privacy firewall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('只接受 exact strict JSON contract', () => {
    expect(mediationStrategyInternals.parseStrictControls(JSON.stringify(VALID_CONTROLS))).toEqual(
      VALID_CONTROLS
    );
  });

  it.each([
    ['extra key', JSON.stringify({ ...VALID_CONTROLS, private_reason: 'childhood trauma' })],
    ['Markdown fence', `\`\`\`json\n${JSON.stringify(VALID_CONTROLS)}\n\`\`\``],
    ['out-of-bounds value', JSON.stringify({ ...VALID_CONTROLS, max_questions: 3 })],
    ['type coercion attempt', JSON.stringify({ ...VALID_CONTROLS, offer_pause: 'true' })],
  ])('%s 必須 fail closed', (_label, raw) => {
    expect(mediationStrategyInternals.parseStrictControls(raw)).toBeNull();
  });

  it('AI 回傳越界輸出時不提供 controls，亦不把原文寫入 log metadata', async () => {
    const privateRaw = 'PRIVATE-CANARY: childhood trauma';
    mockGenerateText.mockResolvedValue(JSON.stringify({ ...VALID_CONTROLS, reason: privateRaw }));

    const result = await new MediationStrategyService().extractAggregatedControls('room-1', [
      { participantId: 'participant-a', messages: [privateRaw] },
    ]);

    expect(result).toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      'Mediation controls rejected by strict schema',
      expect.objectContaining({ roomId: 'room-1' })
    );
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain(privateRaw);
  });

  it('distinguishes provider failure for the append-only outcome audit', async () => {
    mockGenerateText.mockRejectedValue(new Error('provider unavailable'));

    const result = await new MediationStrategyService().extractAggregatedControlsWithOutcome(
      'room-1',
      [{ participantId: 'participant-a', messages: ['private input'] }],
    );

    expect(result).toEqual({ controls: null, outcome: 'provider_failed' });
  });
});
