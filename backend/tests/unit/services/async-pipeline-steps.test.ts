import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { update: jest.fn() },
};
const mockBatchClassify = jest.fn<(sessionId: string) => Promise<void>>();
const mockExtractNarratives = jest.fn<(sessionId: string) => Promise<void>>();
const mockSummarizeNarratives = jest.fn<(userId: string) => Promise<void>>();
const mockExtractInsights = jest.fn<(userId: string, sessionId: string) => Promise<void>>();
const mockCalculateRichness = jest.fn<(userId: string) => Promise<number>>();
const mockGeneratePipelineFeedbackCard = jest.fn<
  (options: { userId: string; sessionId: string }) => Promise<string>
>();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/domain-classification.service', () => ({
  domainClassificationService: {
    batchClassify: (sessionId: string) => mockBatchClassify(sessionId),
  },
}));
jest.mock('../../../src/services/narrative.service', () => ({
  narrativeService: {
    extractNarratives: (sessionId: string) => mockExtractNarratives(sessionId),
    summarizeNarratives: (userId: string) => mockSummarizeNarratives(userId),
  },
}));
jest.mock('../../../src/services/insight-extraction.service', () => ({
  insightExtractionService: {
    extractInsights: (userId: string, sessionId: string) => mockExtractInsights(userId, sessionId),
  },
}));
jest.mock('../../../src/services/profile-richness.service', () => ({
  profileRichnessService: {
    calculateRichness: (userId: string) => mockCalculateRichness(userId),
  },
}));
jest.mock('../../../src/services/async-pipeline-feedback-card', () => ({
  generatePipelineFeedbackCard: (options: { userId: string; sessionId: string }) =>
    mockGeneratePipelineFeedbackCard(options),
}));

import { buildAsyncPipelineSteps } from '../../../src/services/async-pipeline-steps';

describe('buildAsyncPipelineSteps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.interviewSession.update.mockResolvedValue({});
    mockBatchClassify.mockResolvedValue(undefined);
    mockExtractNarratives.mockResolvedValue(undefined);
    mockSummarizeNarratives.mockResolvedValue(undefined);
    mockExtractInsights.mockResolvedValue(undefined);
    mockCalculateRichness.mockResolvedValue(0.56);
    mockGeneratePipelineFeedbackCard.mockResolvedValue('{"summary":"ok"}');
  });

  it('應固定 pipeline step 順序與 skippable policy', () => {
    const steps = buildAsyncPipelineSteps({ sessionId: 'session-1', userId: 'user-1' });

    expect(steps.map(({ step, skippable }) => ({ step, skippable }))).toEqual([
      { step: PipelineStep.NARRATIVE_EXTRACTION, skippable: false },
      { step: PipelineStep.NARRATIVE_SUMMARY, skippable: true },
      { step: PipelineStep.INSIGHT_EXTRACTION, skippable: true },
      { step: PipelineStep.RICHNESS_CALCULATION, skippable: false },
      { step: PipelineStep.FEEDBACK_GENERATION, skippable: true },
    ]);
  });

  it('NARRATIVE_EXTRACTION 應先分類 domain，再抽取 narratives', async () => {
    const [narrativeExtraction] = buildAsyncPipelineSteps({
      sessionId: 'session-1',
      userId: 'user-1',
    });

    await narrativeExtraction.run();

    expect(mockBatchClassify).toHaveBeenCalledWith('session-1');
    expect(mockExtractNarratives).toHaveBeenCalledWith('session-1');
    expect(mockBatchClassify.mock.invocationCallOrder[0]).toBeLessThan(
      mockExtractNarratives.mock.invocationCallOrder[0]
    );
  });

  it('NARRATIVE_SUMMARY 應以 userId 產生摘要', async () => {
    const steps = buildAsyncPipelineSteps({ sessionId: 'session-1', userId: 'user-1' });

    await steps[1].run();

    expect(mockSummarizeNarratives).toHaveBeenCalledWith('user-1');
  });

  it('INSIGHT_EXTRACTION 應帶入 userId 與 sessionId', async () => {
    const steps = buildAsyncPipelineSteps({ sessionId: 'session-1', userId: 'user-1' });

    await steps[2].run();

    expect(mockExtractInsights).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('RICHNESS_CALCULATION 應以 userId 重算豐富度', async () => {
    const steps = buildAsyncPipelineSteps({ sessionId: 'session-1', userId: 'user-1' });

    await steps[3].run();

    expect(mockCalculateRichness).toHaveBeenCalledWith('user-1');
  });

  it('FEEDBACK_GENERATION 應生成 feedback card 並寫回 session', async () => {
    const steps = buildAsyncPipelineSteps({ sessionId: 'session-1', userId: 'user-1' });

    await steps[4].run();

    expect(mockGeneratePipelineFeedbackCard).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { feedback_card: '{"summary":"ok"}' },
    });
  });
});
