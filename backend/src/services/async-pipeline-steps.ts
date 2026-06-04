import prisma from '../config/database';
import { PipelineStep } from '../types/interview.types';
import type { BackendLocale } from '../i18n';
import { domainClassificationService } from './domain-classification.service';
import { narrativeService } from './narrative.service';
import { insightExtractionService } from './insight-extraction.service';
import { profileRichnessService } from './profile-richness.service';
import { generatePipelineFeedbackCard } from './async-pipeline-feedback-card';

export interface AsyncPipelineStepDefinition {
  step: PipelineStep;
  run: () => Promise<void>;
  skippable: boolean;
}

export interface BuildAsyncPipelineStepsOptions {
  sessionId: string;
  userId: string;
  locale?: BackendLocale;
}

export function buildAsyncPipelineSteps({
  sessionId,
  userId,
  locale = 'zh-TW',
}: BuildAsyncPipelineStepsOptions): AsyncPipelineStepDefinition[] {
  return [
    {
      step: PipelineStep.NARRATIVE_EXTRACTION,
      run: async () => {
        await domainClassificationService.batchClassify(sessionId);
        await narrativeService.extractNarratives(sessionId);
      },
      skippable: false,
    },
    {
      step: PipelineStep.NARRATIVE_SUMMARY,
      run: () => narrativeService.summarizeNarratives(userId),
      skippable: true,
    },
    {
      step: PipelineStep.INSIGHT_EXTRACTION,
      run: () => insightExtractionService.extractInsights(userId, sessionId),
      skippable: true,
    },
    {
      step: PipelineStep.RICHNESS_CALCULATION,
      run: async () => {
        await profileRichnessService.calculateRichness(userId);
      },
      skippable: false,
    },
    {
      step: PipelineStep.FEEDBACK_GENERATION,
      run: async () => {
        const card = await generatePipelineFeedbackCard({ userId, sessionId, locale });
        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { feedback_card: card },
        });
      },
      skippable: true,
    },
  ];
}
