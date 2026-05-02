import type { PsychDomain } from '@prisma/client';

import prisma from '../config/database';

export interface InterviewPreviousInsight {
  domain: PsychDomain | string;
  key: string;
  value: string;
  confidence: number;
}

export interface InterviewPreviousNarrative {
  domain: PsychDomain | string;
  ai_summary: string | null;
  completeness: number | null;
}

export interface InterviewPreviousContext {
  previousInsights: string;
  previousNarrativeHints: string;
}

export const EMPTY_INTERVIEW_PREVIOUS_CONTEXT: InterviewPreviousContext = {
  previousInsights: '',
  previousNarrativeHints: '',
};

export function formatInterviewPreviousInsights(insights: InterviewPreviousInsight[]): string {
  if (insights.length === 0) return '';
  return insights
    .map(
      (insight) =>
        `- ${insight.domain}：${insight.key} — ${insight.value}（${Math.round(insight.confidence * 100)}%）`
    )
    .join('\n');
}

export function formatInterviewPreviousNarrativeHints(
  narratives: InterviewPreviousNarrative[]
): string {
  return narratives
    .filter(
      (narrative) =>
        (narrative.ai_summary || '').trim().length > 0 &&
        (narrative.completeness ?? 0) >= 0.25
    )
    .slice(0, 3)
    .map((narrative) => `- ${narrative.domain}：${(narrative.ai_summary || '').trim().slice(0, 120)}`)
    .join('\n');
}

export function buildInterviewPreviousContext(params: {
  insights: InterviewPreviousInsight[];
  narratives: InterviewPreviousNarrative[];
}): InterviewPreviousContext {
  return {
    previousInsights: formatInterviewPreviousInsights(params.insights),
    previousNarrativeHints: formatInterviewPreviousNarrativeHints(params.narratives),
  };
}

export async function loadInterviewPreviousContext(userId: string): Promise<InterviewPreviousContext> {
  const [insights, narratives] = await Promise.all([
    prisma.profileInsight.findMany({
      where: { user_id: userId, is_active: true, confidence: { gte: 0.5 } },
      select: { domain: true, key: true, value: true, confidence: true },
      orderBy: { confidence: 'desc' },
      take: 15,
    }),
    prisma.profileNarrative.findMany({
      where: { user_id: userId, is_latest: true },
      select: { domain: true, ai_summary: true, completeness: true },
      orderBy: { completeness: 'desc' },
      take: 4,
    }),
  ]);

  return buildInterviewPreviousContext({ insights, narratives });
}
