export type AIPromptVersionKey =
  | 'chat_room_ai_response'
  | 'chat_private_support_response'
  | 'chat_mediation_strategy'
  | 'interview_ai_response'
  | 'judgment_emotional_analysis'
  | 'judgment_draft'
  | 'judgment_responsibility_ratio'
  | 'judgment_summary'
  | 'reconciliation_plan_generation'
  | 'repair_replan_generation';

export const STORED_JUDGMENT_PROMPT_VERSION = 'v4.0';
export const UNKNOWN_JUDGMENT_PROMPT_VERSION = 'judgment-prompt-version-unknown';

export const AI_PROMPT_VERSIONS: Record<AIPromptVersionKey, string> = {
  chat_room_ai_response: 'chat-room-ai-response@v1.0',
  chat_private_support_response: 'chat-private-support-response@v1.0',
  chat_mediation_strategy: 'chat-mediation-strategy@v1.0',
  interview_ai_response: 'interview-ai-response@v1.0',
  judgment_emotional_analysis: 'judgment-emotional-analysis@v1.0',
  judgment_draft: `judgment-draft@${STORED_JUDGMENT_PROMPT_VERSION}`,
  judgment_responsibility_ratio: 'judgment-responsibility-ratio@v1.0',
  judgment_summary: 'judgment-summary@v1.0',
  reconciliation_plan_generation: 'reconciliation-plan-generation@v1.0',
  repair_replan_generation: 'repair-replan-generation@v1.0',
};

export function getAIPromptVersion(key: AIPromptVersionKey): string {
  return AI_PROMPT_VERSIONS[key];
}

export function getStoredJudgmentPromptVersion(): string {
  return STORED_JUDGMENT_PROMPT_VERSION;
}

export function getJudgmentMetricsPromptVersion(promptVersion?: string | null): string {
  const normalized = typeof promptVersion === 'string' ? promptVersion.trim() : '';
  return normalized || UNKNOWN_JUDGMENT_PROMPT_VERSION;
}
