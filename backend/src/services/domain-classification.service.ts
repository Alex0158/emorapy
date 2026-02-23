import prisma from '../config/database';
import logger from '../config/logger';
import { PsychDomain } from '@prisma/client';
import { aiService } from './ai.service';
import { INTERVIEW_AI_CONFIG } from '../config/openai';
import { fenceUserInput } from '../utils/prompt';

const VALID_DOMAINS = new Set<string>(Object.values(PsychDomain));

export class DomainClassificationService {
  /**
   * Session 結束後，用 1 次 AI call 批次校驗所有 user_response 的域分類。
   * 更新每個 turn 的 ai_target_domains 和 session 的 domains_touched。
   * （升級方案 5.1 ❸ step 1b）
   */
  async batchClassify(sessionId: string): Promise<void> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { turns: { orderBy: { turn_order: 'asc' } } },
    });
    if (!session) return;

    const turnsWithResponse = session.turns.filter(
      (t) => t.user_response && t.user_response.trim().length > 0 && !t.skipped
    );
    if (turnsWithResponse.length === 0) return;

    const turnList = turnsWithResponse
      .map((t, i) => `[${i + 1}] ${fenceUserInput(`回覆${i + 1}`, t.user_response!)}`)
      .join('\n\n');

    const domainList = Object.values(PsychDomain).join(', ');

    const prompt = `你是一位臨床心理師。以下是來訪者在一次對話中的多段回答。
請為每段回答判斷它實際涉及的心理學域。一段回答可能涉及多個域。

回答列表：
${turnList}

可選域：${domainList}

回應格式 JSON（只回傳陣列，不要其他文字）：
[
  {"turn": 1, "domains": ["attachment", "family_origin"]},
  {"turn": 2, "domains": ["personality"]},
  ...
]`;

    try {
      const raw = await aiService.generateText(prompt, {
        model: INTERVIEW_AI_CONFIG.model,
        maxTokens: 1000,
        temperature: 0.2,
        systemPrompt: '你是一位受過臨床心理學訓練的域分類專家。你只回傳 JSON，不附帶其他文字。',
      });

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('Domain classification: no JSON found in AI response', { sessionId });
        return;
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return;

      const allDomains = new Set<PsychDomain>();

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const turnNum = (item as Record<string, unknown>).turn;
        const domains = (item as Record<string, unknown>).domains;
        const idx = (typeof turnNum === 'number' ? turnNum : Number(turnNum) || 0) - 1;
        if (idx < 0 || idx >= turnsWithResponse.length) continue;

        const validDomains = (Array.isArray(domains) ? domains : [])
          .filter((d: unknown): d is PsychDomain => typeof d === 'string' && VALID_DOMAINS.has(d));
        if (validDomains.length === 0) continue;

        const matchedTurn = turnsWithResponse[idx];
        await prisma.interviewTurn.update({
          where: { id: matchedTurn.id },
          data: { ai_target_domains: validDomains },
        });
        for (const d of validDomains) allDomains.add(d);
      }

      if (allDomains.size > 0) {
        const existingDomains = new Set(session.domains_touched || []);
        for (const d of allDomains) existingDomains.add(d);

        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { domains_touched: [...existingDomains] },
        });
      }

      logger.info('Batch domain classification done', {
        sessionId,
        turnsClassified: parsed.length,
        domainsFound: [...allDomains],
      });
    } catch (err) {
      logger.warn('Batch domain classification failed, falling back to AI intent domains', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const domainClassificationService = new DomainClassificationService();
