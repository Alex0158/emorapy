import prisma from '../config/database';
import logger from '../config/logger';
import { Errors } from '../utils/errors';
import { domainClassificationService } from './domain-classification.service';
import { narrativeService } from './narrative.service';
import { insightExtractionService } from './insight-extraction.service';
import { profileRichnessService } from './profile-richness.service';
import { aiService } from './ai.service';
import { ANALYSIS_AI_CONFIG } from '../config/openai';
import { PipelineStep } from '../types/interview.types';
import type { FeedbackCard } from '../types/interview.types';
import { INTERVIEW_STATUS } from '../utils/constants';
import { lockService } from '../utils/lock';
import { PsychDomain } from '@prisma/client';

const STEP_MAX_RETRIES = 2;
const STEP_RETRY_DELAYS_MS = [2000, 4000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AsyncPipelineService {
  /**
   * 從頭執行管道（fire-and-forget 場景；若已有管道在跑則靜默返回）
   */
  async process(sessionId: string): Promise<void> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== INTERVIEW_STATUS.PROCESSING) {
      logger.warn('Pipeline process: session not found or not in processing', { sessionId });
      return;
    }

    const lockKey = `pipeline:session:${sessionId}`;
    const acquired = await lockService.acquire(lockKey, 300);
    if (!acquired) {
      logger.info('Pipeline already running, skipping duplicate', { sessionId });
      return;
    }
    try {
      await this.runPipeline(sessionId, session.user_id, PipelineStep.NOT_STARTED);
    } finally {
      await lockService.release(lockKey);
    }
  }

  /**
   * 從指定步驟繼續執行（用於 retry failed；若已有管道在跑則拋 CONFLICT）
   */
  async resume(sessionId: string, fromStep: number): Promise<void> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || (session.status !== INTERVIEW_STATUS.PROCESSING_FAILED && session.status !== INTERVIEW_STATUS.PROCESSING)) {
      throw Errors.VALIDATION_ERROR('僅可重試處理失敗的訪談');
    }
    if (session.status === INTERVIEW_STATUS.PROCESSING_FAILED) {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: INTERVIEW_STATUS.PROCESSING },
      });
    }
    await lockService.withLock(
      `pipeline:session:${sessionId}`,
      () => this.runPipeline(sessionId, session.user_id, fromStep),
      300
    );
  }

  private async runPipeline(
    sessionId: string,
    userId: string,
    fromStep: number
  ): Promise<void> {
    const steps = this.buildSteps(sessionId, userId);
    const skippedSteps: PipelineStep[] = [];

    try {
      for (const { step, run, skippable } of steps) {
        if (step < fromStep) continue;
        const exists = await prisma.interviewSession.findUnique({ where: { id: sessionId }, select: { id: true } });
        if (!exists) {
          logger.info('Pipeline aborted: session deleted mid-pipeline', { sessionId });
          return;
        }
        const success = await this.runStepWithRetry(sessionId, step, run, skippable);
        if (!success) {
          skippedSteps.push(step);
        }
      }

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: INTERVIEW_STATUS.COMPLETED, pipeline_step: PipelineStep.COMPLETED },
      }).catch((e: unknown) => {
        const code = (e as { code?: string })?.code;
        if (code === 'P2025') {
          logger.info('Pipeline completion skipped: session deleted', { sessionId });
          return;
        }
        throw e;
      });
      if (skippedSteps.length > 0) {
        logger.warn('Pipeline completed with skipped steps', { sessionId, skippedSteps });
      }
      logger.info('Pipeline completed', { sessionId });
    } catch (err) {
      logger.error('Pipeline failed (non-skippable step)', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: INTERVIEW_STATUS.PROCESSING_FAILED },
      }).catch((e: unknown) => {
        const code = (e as { code?: string })?.code;
        if (code === 'P2025') {
          logger.info('Pipeline failure status skipped: session deleted', { sessionId });
          return;
        }
        throw e;
      });
      throw Errors.PROCESSING_FAILED(err instanceof Error ? err.message : String(err));
    }
  }

  private buildSteps(
    sessionId: string,
    userId: string
  ): Array<{ step: PipelineStep; run: () => Promise<void>; skippable: boolean }> {
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
          const card = await this.generateFeedbackCard(userId, sessionId);
          await prisma.interviewSession.update({
            where: { id: sessionId },
            data: { feedback_card: typeof card === 'string' ? card : JSON.stringify(card) },
          });
        },
        skippable: true,
      },
    ];
  }

  private async runStepWithRetry(
    sessionId: string,
    step: PipelineStep,
    fn: () => Promise<void>,
    skippable: boolean
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= STEP_MAX_RETRIES; attempt++) {
      try {
        await fn();
        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { pipeline_step: step },
        });
        return true;
      } catch (err) {
        logger.warn('Pipeline step failed', {
          sessionId,
          step,
          attempt: attempt + 1,
          error: err instanceof Error ? err.message : String(err),
        });
        if (attempt < STEP_MAX_RETRIES) {
          await sleep(STEP_RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    if (skippable) {
      logger.warn('Pipeline step skipped after retries', { sessionId, step });
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { pipeline_step: step },
      });
      return false;
    }
    throw Errors.PROCESSING_FAILED(`Pipeline step ${step} failed after ${STEP_MAX_RETRIES + 1} attempts`);
  }

  private async generateFeedbackCard(userId: string, sessionId: string): Promise<string> {
    const ALL_DOMAINS: PsychDomain[] = [
      PsychDomain.attachment, PsychDomain.family_origin, PsychDomain.life_events,
      PsychDomain.relationship_history, PsychDomain.belief_values,
      PsychDomain.cultural_background, PsychDomain.personality, PsychDomain.education_cognition,
    ];

    const DOMAIN_LABEL: Record<string, string> = {
      attachment: '依附與親密關係',
      family_origin: '原生家庭',
      life_events: '重要人生經歷',
      relationship_history: '感情經歷',
      belief_values: '價值觀與信念',
      cultural_background: '文化背景',
      personality: '個性特質',
      education_cognition: '教育與認知',
    };

    const [session, richnessScore] = await Promise.all([
      prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: { turns: true },
      }),
      profileRichnessService.calculateRichness(userId),
    ]);
    const insights = await prisma.profileInsight.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { confidence: 'desc' },
      take: 5,
    });

    const domainsExplored = session?.domains_touched ?? [];
    const domainsUnexplored = ALL_DOMAINS.filter(d => !domainsExplored.includes(d));
    const turnCount = session?.turns?.length ?? 0;

    const richnessDescription = richnessScore >= 0.7
      ? '用戶分享了很多面向，資料相當豐富'
      : richnessScore >= 0.4
        ? '用戶分享了一些重要面向，還有更多可以探索'
        : '這是一個初步的開始，用戶還在慢慢打開自己';

    const unexploredLabels = domainsUnexplored.slice(0, 3).map(d => DOMAIN_LABEL[d] || d);
    const continuationHint = domainsUnexplored.length > 0
      ? `下次我們可以聊聊${unexploredLabels.join('、')}的部分，讓我更完整地認識你。`
      : '你已經分享了所有面向的故事，這真的很了不起。下次可以更深入聊聊你特別在意的部分。';

    const summaryPrompt = `你是一位溫暖而專業的關係諮詢師。請用 2～3 句話寫出這次對話的溫暖摘要。

對話情況：
- 探索了以下面向：${domainsExplored.join('、') || '一般對話'}
- 共進行了 ${turnCount} 輪對話
- 整體情況：${richnessDescription}

要求：
1. 提到用戶分享了哪些面向（不要使用專業術語，用日常語言描述）
2. 肯定用戶投入的情感勞動——不只是「願意分享的勇氣」，更要看見分享過程中承受的情緒重量（例如：「把這些事情說出來其實不容易，謝謝你願意信任這個過程」）
3. 不要使用「您」，使用「你」
4. 如果分享還不多，不要讓用戶覺得「做得不夠」——用「這是一個很好的開始」「每個人有自己的節奏」來溫柔地表達
5. 用觀察、描述的方式表達，避免診斷或標籤化（例如：「你很重視家人之間的連結」而非「你有焦慮型依附」）
6. 結尾帶一點向前看的溫暖——讓用戶覺得這次對話有價值，而且未來的對話會更好

請只回傳摘要與鼓勵，不要標題。`;

    try {
      const summary = await aiService.generateText(summaryPrompt, {
        model: ANALYSIS_AI_CONFIG.model,
        maxTokens: 300,
        temperature: 0.7,
        systemPrompt: '你是一位溫暖的關係諮詢師，善於給予簡潔而有力的鼓勵回饋。',
      });
      const card: FeedbackCard = {
        summary: summary.trim(),
        domains_explored: domainsExplored,
        domains_unexplored: domainsUnexplored,
        key_insights: insights.slice(0, 3).map((i: { value: string }) => i.value),
        richness_score: richnessScore,
        encouragement: '你今天分享的每一段故事，都讓我們更懂得如何陪伴你。謝謝你的信任。',
        continuation_hint: continuationHint,
      };
      return JSON.stringify(card);
    } catch (err) {
      logger.warn('Feedback card AI failed, using fallback', { sessionId, userId, error: err });
      return JSON.stringify({
        summary: '感謝你今天花時間和我們聊天，你分享的每一句話都是有意義的。',
        domains_explored: domainsExplored,
        domains_unexplored: domainsUnexplored,
        key_insights: [] as string[],
        richness_score: richnessScore,
        encouragement: '每一次願意打開自己的對話，都是認識自己的好開始。我們下次再聊。',
        continuation_hint: continuationHint,
      } as FeedbackCard);
    }
  }
}

export const asyncPipelineService = new AsyncPipelineService();
