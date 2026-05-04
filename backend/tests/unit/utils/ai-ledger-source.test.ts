import { buildRuntimeAILedgerSourceTracking } from '../../../src/utils/ai-ledger-source';

describe('ai-ledger-source', () => {
  it('應集中產生 runtime AI ledger source tracking', () => {
    expect(buildRuntimeAILedgerSourceTracking('chat_first')).toEqual({
      productFlow: 'chat_first',
      sourceChannel: 'chat_room',
      entryPoint: 'chat_room_ai_response',
    });
    expect(buildRuntimeAILedgerSourceTracking('profile_interview')).toEqual({
      productFlow: 'profile_interview',
      sourceChannel: 'profile_interview',
      entryPoint: 'interview_ai_response',
    });
    expect(buildRuntimeAILedgerSourceTracking('repair_journey')).toEqual({
      productFlow: 'repair_journey',
      sourceChannel: 'repair_journey',
      entryPoint: 'repair_replan_generation',
    });
  });
});
