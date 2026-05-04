export type RuntimeAILedgerProductFlow =
  | 'chat_first'
  | 'profile_interview'
  | 'repair_journey';

export interface AILedgerSourceTracking {
  productFlow: RuntimeAILedgerProductFlow;
  sourceChannel: string;
  entryPoint: string;
}

const RUNTIME_AI_LEDGER_SOURCE: Record<RuntimeAILedgerProductFlow, Omit<AILedgerSourceTracking, 'productFlow'>> = {
  chat_first: {
    sourceChannel: 'chat_room',
    entryPoint: 'chat_room_ai_response',
  },
  profile_interview: {
    sourceChannel: 'profile_interview',
    entryPoint: 'interview_ai_response',
  },
  repair_journey: {
    sourceChannel: 'repair_journey',
    entryPoint: 'repair_replan_generation',
  },
};

export function buildRuntimeAILedgerSourceTracking(
  productFlow: RuntimeAILedgerProductFlow
): AILedgerSourceTracking {
  return {
    productFlow,
    ...RUNTIME_AI_LEDGER_SOURCE[productFlow],
  };
}
