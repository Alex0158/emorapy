import prisma from '../config/database';
import logger from '../config/logger';
import { PsychDomain } from '@prisma/client';
import { aiService } from './ai.service';
import { ANALYSIS_AI_CONFIG } from '../config/openai';
import { Errors } from '../utils/errors';
import { fenceUserInput } from '../utils/prompt';

export class NarrativeService {
  /**
   * 從訪談輪次依領域萃取出 raw 敘事，寫入 ProfileNarrative（舊的 is_latest=false，新紀錄 is_latest=true）
   */
  async extractNarratives(sessionId: string): Promise<void> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { turns: { orderBy: { turn_order: 'asc' } } },
    });
    if (!session) {
      throw Errors.NOT_FOUND('訪談不存在');
    }
    const userId = session.user_id;
    const domainsTouched = session.domains_touched?.length
      ? session.domains_touched
      : ([] as PsychDomain[]);

    if (domainsTouched.length === 0) {
      const fromTurns = new Set<PsychDomain>();
      for (const t of session.turns) {
        for (const d of t.ai_target_domains || []) {
          fromTurns.add(d);
        }
      }
      domainsTouched.push(...fromTurns);
    }
    if (domainsTouched.length === 0) {
      domainsTouched.push(PsychDomain.personality);
    }

    const allTurnTexts = session.turns
      .map((t) => {
        const parts = [t.ai_message];
        if (t.user_response) parts.push(t.user_response);
        return parts.join('\n');
      })
      .join('\n\n');

    const RAW_NARRATIVE_LIMIT = 5000;

    const existingNarratives = await prisma.profileNarrative.findMany({
      where: { user_id: userId, domain: { in: domainsTouched }, is_latest: true },
      select: { domain: true, raw_narrative: true, ai_summary: true, source_sessions: true, completeness: true },
    });
    const existingByDomain = new Map(existingNarratives.map(n => [n.domain, n]));

    for (const domain of domainsTouched) {
      const existing = existingByDomain.get(domain) ?? null;

      const domainTurns = session.turns.filter(
        (t) => t.ai_target_domains && t.ai_target_domains.includes(domain)
      );
      const turnTexts = domainTurns.length > 0
        ? domainTurns
            .map((t) => {
              const parts = [t.ai_message];
              if (t.user_response) parts.push(t.user_response);
              return parts.join('\n');
            })
            .join('\n\n')
        : allTurnTexts;

      let rawNarrative: string;
      let sourceSessions: string[];
      if (existing && existing.raw_narrative) {
        const combined = existing.raw_narrative + '\n\n' + turnTexts;
        if (combined.length > RAW_NARRATIVE_LIMIT) {
          const summaryPart = existing.ai_summary
            ? `[先前摘要] ${existing.ai_summary}\n\n`
            : '';
          rawNarrative = (summaryPart + turnTexts).slice(0, RAW_NARRATIVE_LIMIT);
        } else {
          rawNarrative = combined;
        }
        const prev = Array.isArray(existing.source_sessions)
          ? (existing.source_sessions as string[])
          : [];
        sourceSessions = [...prev, sessionId];
      } else {
        rawNarrative = turnTexts.slice(0, RAW_NARRATIVE_LIMIT);
        sourceSessions = [sessionId];
      }

      const cjkChars = (rawNarrative.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
      const wordCount = cjkChars > 0
        ? cjkChars + Math.ceil((rawNarrative.length - cjkChars) / 4)
        : rawNarrative.split(/\s+/).filter(Boolean).length;
      const turnFactor = existing
        ? Math.min(1, sourceSessions.length * 0.3)
        : Math.min(1, session.turns.length / 10);
      const rawCompleteness = Math.min(1, wordCount / 200) * 0.5 + 0.5 * turnFactor;
      const completeness = existing?.completeness
        ? Math.max(existing.completeness, rawCompleteness)
        : rawCompleteness;

      await prisma.$transaction(async (tx) => {
        await tx.profileNarrative.updateMany({
          where: { user_id: userId, domain, is_latest: true },
          data: { is_latest: false },
        });
        await tx.profileNarrative.create({
          data: {
            user_id: userId,
            domain,
            raw_narrative: rawNarrative,
            ai_summary: null,
            word_count: wordCount,
            completeness,
            source_sessions: sourceSessions,
            is_latest: true,
          },
        });
      });
    }
    logger.info('Narrative extraction done', { sessionId, userId, domains: domainsTouched });
  }

  /**
   * 對每位用戶最新敘事呼叫 AI 生成摘要（使用 ANALYSIS_AI_CONFIG）
   */
  async summarizeNarratives(userId: string): Promise<void> {
    const latest = await prisma.profileNarrative.findMany({
      where: { user_id: userId, is_latest: true },
    });
    for (const n of latest) {
      try {
        const prompt = `以下是一位用戶在心理訪談中與「${n.domain}」相關的敘事內容。請用 2～4 句話寫出簡潔、中立的摘要，保留關鍵的情感模式、行為傾向和重要事件，不要加入評判。

${fenceUserInput('敘事內容', n.raw_narrative ?? '')}

請只回傳摘要文字，不要標題或編號。`;
        const summary = await aiService.generateText(prompt, {
          model: ANALYSIS_AI_CONFIG.model,
          maxTokens: 400,
          temperature: ANALYSIS_AI_CONFIG.temperature,
          topP: ANALYSIS_AI_CONFIG.topP,
          systemPrompt: '你是關係敘事與自我探索資料的整理助手，擅長從對話中萃取關鍵心理敘事，不自稱臨床心理師或治療師。',
        });
        await prisma.profileNarrative.update({
          where: { id: n.id },
          data: { ai_summary: summary.trim() },
        });
      } catch (err) {
        logger.warn('Narrative summary failed for narrative', { narrativeId: n.id, error: err });
      }
    }
  }
}

export const narrativeService = new NarrativeService();
