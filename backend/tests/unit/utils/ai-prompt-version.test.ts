import {
  AI_PROMPT_VERSIONS,
  getAIPromptVersion,
  getStoredJudgmentPromptVersion,
} from '../../../src/utils/ai-prompt-version';

describe('ai-prompt-version', () => {
  it('應集中管理主要 AI runtime prompt version', () => {
    expect(getAIPromptVersion('judgment_draft')).toBe('judgment-draft@v4.0');
    expect(getStoredJudgmentPromptVersion()).toBe('v4.0');
    expect(getAIPromptVersion('chat_room_ai_response')).toBe('chat-room-ai-response@v1.0');
    expect(getAIPromptVersion('interview_ai_response')).toBe('interview-ai-response@v1.0');
    expect(getAIPromptVersion('repair_replan_generation')).toBe('repair-replan-generation@v1.0');
    expect(Object.keys(AI_PROMPT_VERSIONS).sort()).toEqual([
      'chat_room_ai_response',
      'interview_ai_response',
      'judgment_draft',
      'judgment_emotional_analysis',
      'judgment_responsibility_ratio',
      'judgment_summary',
      'reconciliation_plan_generation',
      'repair_replan_generation',
    ]);
  });
});
