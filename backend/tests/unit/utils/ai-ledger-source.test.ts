import {
  buildRuntimeAILedgerSourceTracking,
  getAIRequestLedgerProductFlow,
  UNKNOWN_AI_LEDGER_PRODUCT_FLOW,
} from '../../../src/utils/ai-ledger-source';

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

  it('應集中管理 AI request ledger product flow fallback', () => {
    expect(getAIRequestLedgerProductFlow('formal_remote')).toBe('formal_remote');
    expect(getAIRequestLedgerProductFlow('  chat_first  ')).toBe('chat_first');
    expect(getAIRequestLedgerProductFlow(null)).toBe(UNKNOWN_AI_LEDGER_PRODUCT_FLOW);
    expect(getAIRequestLedgerProductFlow('')).toBe(UNKNOWN_AI_LEDGER_PRODUCT_FLOW);
  });
});
