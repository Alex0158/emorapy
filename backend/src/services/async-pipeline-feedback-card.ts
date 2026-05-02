import { PsychDomain } from '@prisma/client';
import prisma from '../config/database';
import logger from '../config/logger';
import { ANALYSIS_AI_CONFIG } from '../config/openai';
import type { FeedbackCard } from '../types/interview.types';
import { aiService } from './ai.service';
import { profileRichnessService } from './profile-richness.service';

const FEEDBACK_CARD_DOMAINS: PsychDomain[] = [
  PsychDomain.attachment,
  PsychDomain.family_origin,
  PsychDomain.life_events,
  PsychDomain.relationship_history,
  PsychDomain.belief_values,
  PsychDomain.cultural_background,
  PsychDomain.personality,
  PsychDomain.education_cognition,
];

const FEEDBACK_CARD_DOMAIN_LABELS: Record<PsychDomain, string> = {
  [PsychDomain.attachment]: '依附與親密關係',
  [PsychDomain.family_origin]: '原生家庭',
  [PsychDomain.life_events]: '重要人生經歷',
  [PsychDomain.relationship_history]: '感情經歷',
  [PsychDomain.belief_values]: '價值觀與信念',
  [PsychDomain.cultural_background]: '文化背景',
  [PsychDomain.personality]: '個性特質',
  [PsychDomain.education_cognition]: '教育與認知',
};

interface GeneratePipelineFeedbackCardOptions {
  userId: string;
  sessionId: string;
}

function getRichnessDescription(richnessScore: number): string {
  if (richnessScore >= 0.7) {
    return '用戶分享了很多面向，資料相當豐富';
  }
  if (richnessScore >= 0.4) {
    return '用戶分享了一些重要面向，還有更多可以探索';
  }
  return '這是一個初步的開始，用戶還在慢慢打開自己';
}

function buildContinuationHint(domainsUnexplored: PsychDomain[]): string {
  if (domainsUnexplored.length === 0) {
    return '你已經分享了所有面向的故事，這真的很了不起。下次可以更深入聊聊你特別在意的部分。';
  }

  const unexploredLabels = domainsUnexplored
    .slice(0, 3)
    .map((domain) => FEEDBACK_CARD_DOMAIN_LABELS[domain] || domain);
  return `下次我們可以聊聊${unexploredLabels.join('、')}的部分，讓我更完整地認識你。`;
}

function buildSummaryPrompt(
  domainsExplored: PsychDomain[],
  turnCount: number,
  richnessDescription: string
): string {
  return `你是一位溫暖而專業的關係諮詢師。請用 2～3 句話寫出這次對話的溫暖摘要。

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
}

export async function generatePipelineFeedbackCard({
  userId,
  sessionId,
}: GeneratePipelineFeedbackCardOptions): Promise<string> {
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
  const domainsUnexplored = FEEDBACK_CARD_DOMAINS.filter((domain) => !domainsExplored.includes(domain));
  const turnCount = session?.turns?.length ?? 0;
  const richnessDescription = getRichnessDescription(richnessScore);
  const continuationHint = buildContinuationHint(domainsUnexplored);
  const summaryPrompt = buildSummaryPrompt(domainsExplored, turnCount, richnessDescription);

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
      key_insights: insights.slice(0, 3).map((insight: { value: string }) => insight.value),
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
