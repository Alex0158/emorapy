import { PsychDomain } from '@prisma/client';

const UNSAFE_SEED_SIGNAL_PATTERN = /自傷|自殺|暴力|威脅|創傷|受害/;
const SAFE_SEED_DOMAINS = new Set<PsychDomain>([
  PsychDomain.personality,
  PsychDomain.belief_values,
  PsychDomain.education_cognition,
  PsychDomain.cultural_background,
  PsychDomain.relationship_history,
  PsychDomain.life_events,
]);

export interface InterviewSeedInsight {
  domain: PsychDomain;
  insight_type: string;
  key: string;
  value: string;
}

export function sanitizeSeedInsightValue(value: string): string {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/[「」"'`]/g, '')
    .trim()
    .slice(0, 48);
}

export function isSafeSeedInsight(insight: InterviewSeedInsight): boolean {
  if (insight.insight_type === 'risk' || insight.insight_type === 'trigger') return false;
  if (UNSAFE_SEED_SIGNAL_PATTERN.test(`${insight.key} ${insight.value}`)) return false;
  return SAFE_SEED_DOMAINS.has(insight.domain);
}

export function buildSeedInsightHints(insights: InterviewSeedInsight[]): string[] {
  return insights
    .filter(isSafeSeedInsight)
    .slice(0, 3)
    .map((insight) => `${insight.key}：${sanitizeSeedInsightValue(insight.value)}`);
}

export function buildPersonalizedSeedQuestion(base: string, hints: string[]): string {
  if (hints.length === 0) return base;
  const hint = hints[0];
  return `嗨，歡迎回來。上次聊天裡我對你的一個印象是：${hint}。如果你願意，想先從這件事最近在你生活裡的變化聊起嗎？`;
}
