import prisma from '../config/database';
import logger from '../config/logger';
import { getSeedQuestion } from '../types/interview.types';
import type { BackendLocale } from '../i18n';
import type { InterviewStartTrigger } from './interview-start-session-utils';
import {
  buildPersonalizedSeedQuestion,
  buildSeedInsightHints,
} from './interview-seed-question-utils';

export async function loadPersonalizedInterviewSeedQuestion(
  userId: string,
  trigger: InterviewStartTrigger,
  locale: BackendLocale = 'zh-TW'
): Promise<string> {
  const baseQuestion = getSeedQuestion(trigger, locale);

  try {
    const seedInsights = await prisma.profileInsight.findMany({
      where: {
        user_id: userId,
        is_active: true,
        confidence: { gte: 0.7 },
      },
      select: {
        domain: true,
        insight_type: true,
        key: true,
        value: true,
        confidence: true,
      },
      orderBy: { confidence: 'desc' },
      take: 12,
    });

    return buildPersonalizedSeedQuestion(
      baseQuestion,
      buildSeedInsightHints(seedInsights),
      locale
    );
  } catch (error) {
    logger.debug('Non-critical: failed to build personalized seed', { userId, error });
    return baseQuestion;
  }
}
