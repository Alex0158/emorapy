import prisma from '../config/database';
import { PsychDomain } from '@prisma/client';
import logger from '../config/logger';
import { CASE_MODE } from '../utils/constants';

/**
 * 案件類型 → 相關心理域映射
 *
 * 不同衝突類型與不同心理域的相關性不同。
 * primary: 高度相關，優先注入
 * secondary: 中度相關，token 預算允許時注入
 */
const CASE_TYPE_DOMAIN_RELEVANCE: Record<string, { primary: string[]; secondary: string[] }> = {
  '生活習慣衝突': {
    primary: ['personality', 'family_origin'],
    secondary: ['attachment', 'cultural_background', 'education_cognition'],
  },
  '消費決策衝突': {
    primary: ['belief_values', 'family_origin'],
    secondary: ['personality', 'cultural_background', 'education_cognition'],
  },
  '社交關係衝突': {
    primary: ['attachment', 'personality'],
    secondary: ['family_origin', 'cultural_background', 'relationship_history'],
  },
  '價值觀衝突': {
    primary: ['belief_values', 'cultural_background'],
    secondary: ['family_origin', 'education_cognition', 'personality'],
  },
  '情感需求衝突': {
    primary: ['attachment', 'relationship_history'],
    secondary: ['personality', 'life_events', 'family_origin'],
  },
  '其他衝突': {
    primary: ['attachment', 'personality'],
    secondary: ['relationship_history', 'belief_values', 'family_origin'],
  },
};

export interface UserContextBrief {
  label: string;
  attachmentHint: string | null;
  communicationHint: string | null;
  keyInsights: string[];
  culturalHint: string | null;
}

export interface RelationshipContextBrief {
  duration: string | null;
  stage: string | null;
  isLongDistance: boolean;
  strengths: string[];
  challenges: string[];
  bottomLines: { userA: string[]; userB: string[] };
  conflictStyle: string | null;
  historicalPatterns: string | null;
  executionRate: number | null;
}

export interface CaseContextResult {
  userA: UserContextBrief | null;
  userB: UserContextBrief | null;
  relationship: RelationshipContextBrief | null;
  relevantDomains: string[];
  caseType: string;
}

export class CaseContextService {
  /**
   * 按案件類型智能載入相關用戶背景數據
   *
   * 設計原則：
   * 1. 只載入與案件類型相關的域（避免無關信息干擾 AI）
   * 2. 只使用高信心度的洞察（confidence ≥ 0.5）
   * 3. Quick 模式不載入（無用戶資料）
   * 4. 每個用戶最多返回 5 條 key insights
   */
  async loadCaseContext(
    caseId: string,
    preloadedCase?: {
      type: string;
      mode: string;
      plaintiff_id: string | null;
      defendant_id: string | null;
      pairing_id: string | null;
    }
  ): Promise<CaseContextResult | null> {
    const caseRecord = preloadedCase ?? await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        type: true,
        mode: true,
        plaintiff_id: true,
        defendant_id: true,
        pairing_id: true,
      },
    });

    if (!caseRecord || caseRecord.mode === CASE_MODE.QUICK || !caseRecord.plaintiff_id) {
      return null;
    }

    const relevance = CASE_TYPE_DOMAIN_RELEVANCE[caseRecord.type] || CASE_TYPE_DOMAIN_RELEVANCE['其他衝突'];
    const allRelevantDomains = [...relevance.primary, ...relevance.secondary] as PsychDomain[];

    try {
      const [userA, userB, relationship] = await Promise.all([
        this.loadUserBrief(caseRecord.plaintiff_id, '角色A', allRelevantDomains, relevance.primary),
        caseRecord.defendant_id
          ? this.loadUserBrief(caseRecord.defendant_id, '角色B', allRelevantDomains, relevance.primary)
          : null,
        caseRecord.pairing_id ? this.loadRelationshipBrief(caseRecord.pairing_id) : null,
      ]);

      return {
        userA,
        userB,
        relationship,
        relevantDomains: allRelevantDomains,
        caseType: caseRecord.type,
      };
    } catch (err) {
      logger.warn('Failed to load case context', { caseId, error: err });
      return null;
    }
  }

  private async loadUserBrief(
    userId: string,
    label: string,
    relevantDomains: PsychDomain[],
    primaryDomains: string[]
  ): Promise<UserContextBrief> {
    const insights = await prisma.profileInsight.findMany({
      where: {
        user_id: userId,
        is_active: true,
        confidence: { gte: 0.5 },
        domain: { in: relevantDomains },
      },
      orderBy: { confidence: 'desc' },
      take: 10,
    });

    const attachmentInsights = insights.filter(i => i.domain === 'attachment');
    const personalityInsights = insights.filter(i => i.domain === 'personality');
    const culturalInsights = insights.filter(i => i.domain === 'cultural_background');

    let attachmentHint: string | null = null;
    if (attachmentInsights.length > 0) {
      attachmentHint = attachmentInsights
        .slice(0, 2)
        .map(i => `${i.key}：${i.value}`)
        .join('；');
    }

    let communicationHint: string | null = null;
    const commInsight = personalityInsights.find(i =>
      i.key.includes('溝通') || i.key.includes('表達') || i.key.includes('communication')
    );
    if (commInsight) {
      communicationHint = `${commInsight.key}：${commInsight.value}`;
    }

    let culturalHint: string | null = null;
    if (culturalInsights.length > 0) {
      culturalHint = culturalInsights
        .slice(0, 2)
        .map(i => `${i.key}：${i.value}`)
        .join('；');
    }

    const keyInsights = insights
      .filter(i => primaryDomains.includes(i.domain))
      .slice(0, 5)
      .map(i => `[${i.domain}] ${i.key}：${i.value}`);

    return {
      label,
      attachmentHint,
      communicationHint,
      keyInsights,
      culturalHint,
    };
  }

  private async loadRelationshipBrief(pairingId: string): Promise<RelationshipContextBrief | null> {
    const rp = await prisma.relationshipProfile.findUnique({
      where: { pairing_id: pairingId },
    });

    if (!rp) return null;

    let historicalPatterns: string | null = null;
    if (rp.historical_case_types) {
      try {
        const types = rp.historical_case_types as Record<string, number>;
        const sorted = Object.entries(types).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          historicalPatterns = `歷史衝突類型：${sorted.map(([t, c]) => `${t}(${c}次)`).join('、')}`;
        }
      } catch { /* ignore malformed data */ }
    }

    return {
      duration: rp.relationship_duration_days ? `${rp.relationship_duration_days}天` : null,
      stage: rp.relationship_stage,
      isLongDistance: rp.is_long_distance,
      strengths: rp.relationship_strengths || [],
      challenges: rp.relationship_challenges || [],
      bottomLines: {
        userA: rp.user1_bottom_lines || [],
        userB: rp.user2_bottom_lines || [],
      },
      conflictStyle: rp.conflict_communication_style,
      historicalPatterns,
      executionRate: rp.reconciliation_plan_execution_rate,
    };
  }

  /**
   * 為情感動態分析生成輕量上下文
   *
   * 只提供依附模式和溝通風格提示，不提供完整背景
   * 避免偏見：明確告知 AI 這些是「參考信息」而非結論
   */
  formatForEmotionalAnalysis(ctx: CaseContextResult): string | null {
    const parts: string[] = [];

    if (ctx.userA?.attachmentHint) {
      parts.push(`${ctx.userA.label}的依附傾向：${ctx.userA.attachmentHint}`);
    }
    if (ctx.userB?.attachmentHint) {
      parts.push(`${ctx.userB.label}的依附傾向：${ctx.userB.attachmentHint}`);
    }
    if (ctx.userA?.communicationHint) {
      parts.push(`${ctx.userA.label}的溝通偏好：${ctx.userA.communicationHint}`);
    }
    if (ctx.userB?.communicationHint) {
      parts.push(`${ctx.userB.label}的溝通偏好：${ctx.userB.communicationHint}`);
    }

    if (parts.length === 0) return null;

    return `以下是雙方過往訪談中呈現的傾向（僅供參考，請以本次陳述為主要分析依據）：\n${parts.join('\n')}`;
  }

  /**
   * 為責任比評估生成關係歷史上下文
   */
  formatForResponsibilityRatio(ctx: CaseContextResult): string | null {
    const parts: string[] = [];

    if (ctx.relationship?.duration) {
      parts.push(`交往時間：${ctx.relationship.duration}`);
    }
    if (ctx.relationship?.stage) {
      parts.push(`關係階段：${ctx.relationship.stage}`);
    }
    if (ctx.relationship?.historicalPatterns) {
      parts.push(ctx.relationship.historicalPatterns);
    }
    if (ctx.relationship?.conflictStyle) {
      parts.push(`衝突溝通風格：${ctx.relationship.conflictStyle}`);
    }

    if (parts.length === 0) return null;
    return `關係背景（輔助評估）：${parts.join('；')}`;
  }

  /**
   * 為和好方案生成豐富的個性化上下文
   *
   * 這是最需要背景數據的環節：
   * - 溝通偏好 → 調整方案的溝通方式建議
   * - 興趣 → 設計有共鳴的活動
   * - 底線 → 避免觸碰雷區
   * - 歷史執行率 → 調整方案難度
   * - 關係優勢/挑戰 → 利用已有的好基礎
   */
  formatForReconciliationPlans(ctx: CaseContextResult): string | null {
    const parts: string[] = [];

    for (const user of [ctx.userA, ctx.userB]) {
      if (!user) continue;
      const userParts: string[] = [];
      if (user.communicationHint) userParts.push(`溝通偏好：${user.communicationHint}`);
      if (user.attachmentHint) userParts.push(`依附傾向：${user.attachmentHint}`);
      if (user.culturalHint) userParts.push(`文化背景：${user.culturalHint}`);
      if (user.keyInsights.length > 0) userParts.push(`關鍵特質：${user.keyInsights.join('；')}`);
      if (userParts.length > 0) {
        parts.push(`${user.label}：${userParts.join('。')}`);
      }
    }

    // 關係信息
    if (ctx.relationship) {
      const rp = ctx.relationship;
      const relParts: string[] = [];

      if (rp.duration) relParts.push(`交往 ${rp.duration}`);
      if (rp.stage) relParts.push(`關係階段：${rp.stage}`);
      if (rp.isLongDistance) relParts.push('遠距離關係（方案需考慮距離限制）');
      if (rp.strengths.length > 0) relParts.push(`關係優勢：${rp.strengths.join('、')}`);
      if (rp.challenges.length > 0) relParts.push(`關係挑戰：${rp.challenges.join('、')}`);

      if (rp.bottomLines.userA.length > 0 || rp.bottomLines.userB.length > 0) {
        const blParts: string[] = [];
        if (rp.bottomLines.userA.length > 0) blParts.push(`角色A底線：${rp.bottomLines.userA.join('、')}`);
        if (rp.bottomLines.userB.length > 0) blParts.push(`角色B底線：${rp.bottomLines.userB.join('、')}`);
        relParts.push(`注意底線：${blParts.join('；')}`);
      }

      if (rp.executionRate !== null && rp.executionRate !== undefined) {
        if (rp.executionRate < 0.3) {
          relParts.push('過往方案執行率偏低，請設計更低門檻、更容易堅持的方案');
        } else if (rp.executionRate > 0.7) {
          relParts.push('過往方案執行良好，可適度提高挑戰性');
        }
      }

      if (rp.historicalPatterns) relParts.push(rp.historicalPatterns);
      if (rp.conflictStyle) relParts.push(`衝突溝通風格：${rp.conflictStyle}`);

      if (relParts.length > 0) {
        parts.push(`關係背景：${relParts.join('；')}`);
      }
    }

    if (parts.length === 0) return null;
    return parts.join('\n\n');
  }

  /**
   * 為摘要生成簡要上下文（一句話）
   */
  formatForSummary(ctx: CaseContextResult): string | null {
    const hints: string[] = [];
    if (ctx.relationship?.duration) hints.push(`交往${ctx.relationship.duration}`);
    if (ctx.relationship?.stage) hints.push(ctx.relationship.stage);
    if (ctx.relationship?.isLongDistance) hints.push('遠距離');
    if (hints.length === 0) return null;
    return hints.join('、');
  }

  /**
   * 將判決階段的 EmotionalAnalysis 結構化結果格式化為和好方案可用的診斷上下文。
   *
   * 這些資料在判決生成時由 AI 產出並存儲於 judgment.emotional_analysis，
   * 包含互動循環、改變準備度、核心議題、觸發點等臨床關鍵資訊。
   * 和好方案需要這些「診斷結果」才能設計出有臨床精準度的介入方案。
   */
  formatDiagnosticContext(analysis: Record<string, unknown>): string | null {
    const parts: string[] = [];

    const severity = analysis.severity as string | undefined;
    if (severity) {
      parts.push(`嚴重程度：${severity}`);
    }

    const personA = analysis.personA as Record<string, string> | undefined;
    const personB = analysis.personB as Record<string, string> | undefined;

    if (personA) {
      const aParts: string[] = [];
      if (personA.primaryFeelings) aParts.push(`核心感受：${personA.primaryFeelings}`);
      if (personA.unmetNeeds) aParts.push(`未滿足需求：${personA.unmetNeeds}`);
      if (personA.communicationPattern) aParts.push(`溝通模式：${personA.communicationPattern}`);
      if (personA.readinessStage) aParts.push(`改變準備度：${personA.readinessStage}`);
      if (aParts.length > 0) parts.push(`角色 A 的情感狀態：\n- ${aParts.join('\n- ')}`);
    }

    if (personB) {
      const bParts: string[] = [];
      if (personB.primaryFeelings) bParts.push(`核心感受：${personB.primaryFeelings}`);
      if (personB.unmetNeeds) bParts.push(`未滿足需求：${personB.unmetNeeds}`);
      if (personB.communicationPattern) bParts.push(`溝通模式：${personB.communicationPattern}`);
      if (personB.readinessStage) bParts.push(`改變準備度：${personB.readinessStage}`);
      if (bParts.length > 0) parts.push(`角色 B 的情感狀態：\n- ${bParts.join('\n- ')}`);
    }

    const interactionCycle = analysis.interactionCycle as string | undefined;
    if (interactionCycle) {
      parts.push(`互動循環模式：${interactionCycle}`);
    }

    const triggerPattern = analysis.triggerPattern as string | undefined;
    if (triggerPattern) {
      parts.push(`循環觸發點：${triggerPattern}`);
    }

    const coreIssue = analysis.coreIssue as string | undefined;
    if (coreIssue) {
      const secondaryIssues = analysis.secondaryIssues as string[] | undefined;
      let issueText = `核心議題：${coreIssue}`;
      if (secondaryIssues && secondaryIssues.length > 0) {
        issueText += `\n其他相關議題：${secondaryIssues.join('、')}`;
      }
      parts.push(issueText);
    }

    const strengths = analysis.relationshipStrengths as string | undefined;
    if (strengths) {
      parts.push(`關係中仍在運作的力量：${strengths}`);
    }

    const suggestedApproach = analysis.suggestedApproach as string | undefined;
    if (suggestedApproach) {
      parts.push(`建議介入方向：${suggestedApproach}`);
    }

    const gottmanFlags = analysis.gottmanFlags as string[] | undefined;
    if (gottmanFlags && gottmanFlags.length > 0) {
      parts.push(`檢測到的互動危險信號（Gottman 四騎士）：${gottmanFlags.join('、')}`);
    }

    if (parts.length === 0) return null;
    return parts.join('\n\n');
  }
}

export const caseContextService = new CaseContextService();
