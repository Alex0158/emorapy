import prisma from '../config/database';
import logger from '../config/logger';
import { PsychDomain, InsightType } from '@prisma/client';
import { aiService } from './ai.service';
import { ANALYSIS_AI_CONFIG } from '../config/openai';
import type { InsightExtractionResult } from '../types/interview.types';
import { fenceUserInput } from '../utils/prompt';

const INSIGHT_TYPES = Object.values(InsightType).join('、');
const PSYCH_DOMAINS = Object.values(PsychDomain).join('、');

export class InsightExtractionService {
  /**
   * 依最新敘事用 AI 萃取出洞見，upsert ProfileInsight
   * 使用 ANALYSIS_AI_CONFIG (gpt-4o) 以確保整理品質
   */
  async extractInsights(userId: string, sessionId: string): Promise<void> {
    const narratives = await prisma.profileNarrative.findMany({
      where: { user_id: userId, is_latest: true },
    });
    if (narratives.length === 0) {
      logger.info('No narratives to extract insights', { userId });
      return;
    }

    const MIN_DOMAIN_CHARS = 100;
    const qualifiedNarratives = narratives.filter((n) => {
      const text = n.ai_summary || n.raw_narrative;
      return text && text.length >= MIN_DOMAIN_CHARS;
    });
    if (qualifiedNarratives.length === 0) {
      logger.info('All narratives below minimum length for insight extraction', { userId });
      return;
    }
    const combined = qualifiedNarratives
      .map((n) => `[領域: ${n.domain}]\n${n.ai_summary || n.raw_narrative}`)
      .join('\n\n');

    const prompt = `你是 Emorapy 的 AI 關係敘事整理助手。請根據以下自我探索敘事摘要，萃取出結構化心理洞見。

## 萃取規則
1. 每條洞見必須有明確的對話證據支撐，不可僅靠推測
2. confidence 分數標準：
   - 0.8-1.0：用戶明確陳述，多處佐證
   - 0.6-0.8：用戶間接表達，有上下文支持
   - 0.4-0.6：根據行為模式合理推論
   - 0.2-0.4：初步推論，需更多資料確認
3. 跨領域推論：若一段敘事同時涉及多個領域，每個相關領域各產生一條洞見
4. 如無法從敘事中確信某洞見，寧可不產出，也不要勉強填充低品質資料

## 洞見類型
${INSIGHT_TYPES}

## 領域範圍
${PSYCH_DOMAINS}

${fenceUserInput('敘事摘要', combined)}

請回傳一個 JSON 陣列，每個元素格式：
{"domain":"領域名","insight_type":"類型","key":"簡短關鍵字(≤8字)","value":"描述(≤200字)","confidence":0~1,"evidence":"原文中的一句關鍵證據","clinical_note":"臨床備註(可選)"}

最多產出 15 條，只回傳 JSON 陣列，不要其他說明。`;

    try {
      const raw = await aiService.generateText(prompt, {
        model: ANALYSIS_AI_CONFIG.model,
        maxTokens: ANALYSIS_AI_CONFIG.maxTokens,
        temperature: ANALYSIS_AI_CONFIG.temperature,
        topP: ANALYSIS_AI_CONFIG.topP,
        systemPrompt: '你是關係敘事與自我探索資料的整理助手。你只回傳 JSON，不附帶其他文字，不自稱臨床心理師或治療師。',
      });
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      let list: InsightExtractionResult[] = [];
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          list = Array.isArray(parsed) ? parsed : [];
        } catch (parseErr) {
          logger.warn('Insight extraction: AI returned malformed JSON', {
            userId, sessionId, error: parseErr,
          });
          return;
        }
      }
      if (list.length === 0) return;

      const domainSet = new Set(Object.values(PsychDomain));
      const typeSet = new Set(Object.values(InsightType));

      for (const item of list) {
        if (typeof item.confidence === 'number' && item.confidence < 0.2) {
          continue;
        }

        const domain = domainSet.has(item.domain as PsychDomain)
          ? (item.domain as PsychDomain)
          : PsychDomain.personality;
        const insightType = typeSet.has(item.insight_type as InsightType)
          ? (item.insight_type as InsightType)
          : InsightType.trait;
        const key = (item.key || 'unknown').slice(0, 100);
        const value = (item.value || '').slice(0, 2000);
        const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0.5));
        const narrative = qualifiedNarratives.find((n) => n.domain === domain);

        const existing = await prisma.profileInsight.findFirst({
          where: { user_id: userId, domain, key, is_active: true },
        });
        if (existing) {
          await prisma.profileInsight.update({
            where: { id: existing.id },
            data: {
              value,
              confidence,
              evidence: (item.evidence || '').slice(0, 500),
              clinical_note: item.clinical_note?.slice(0, 500),
              narrative_id: narrative?.id,
            },
          });
        } else {
          await prisma.profileInsight.create({
            data: {
              user_id: userId,
              narrative_id: narrative?.id,
              domain,
              insight_type: insightType,
              key,
              value,
              confidence,
              evidence: (item.evidence || '').slice(0, 500),
              clinical_note: item.clinical_note?.slice(0, 500),
              is_active: true,
            },
          });
        }
      }
      logger.info('Insight extraction done', { userId, sessionId, count: list.length });
    } catch (err) {
      logger.error('Insight extraction failed', { userId, sessionId, error: err });
      throw err;
    }
  }
}

export const insightExtractionService = new InsightExtractionService();
