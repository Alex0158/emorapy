import {
  AI_PROMPT_VERSIONS,
  getAIPromptVersion,
  getJudgmentMetricsPromptVersion,
  getStoredJudgmentPromptVersion,
  UNKNOWN_JUDGMENT_PROMPT_VERSION,
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

  it('應集中管理判決品質指標 prompt version fallback', () => {
    expect(getJudgmentMetricsPromptVersion('v4.0')).toBe('v4.0');
    expect(getJudgmentMetricsPromptVersion('  v4.0  ')).toBe('v4.0');
    expect(getJudgmentMetricsPromptVersion(null)).toBe(UNKNOWN_JUDGMENT_PROMPT_VERSION);
    expect(getJudgmentMetricsPromptVersion('')).toBe(UNKNOWN_JUDGMENT_PROMPT_VERSION);
  });
});
