import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { CASE_MODE } from '../utils/constants';
import { aiService, ReconciliationPlan, SAFETY_SIGNAL_REGEX, IPV_SIGNAL_REGEX, CRISIS_SIGNAL_REGEX } from './ai.service';
import { isReconciliationPlanContent } from '../types/ai.types';
import { caseContextService } from './case-context.service';

function sanitizePlanStrings<T>(obj: T): T {
  if (typeof obj === 'string') {
    return obj
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .slice(0, 10000) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizePlanStrings) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = sanitizePlanStrings(v);
    }
    return result as T;
  }
  return obj;
}

export interface PlanPreferences {
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: number;
  types?: ('activity' | 'communication' | 'intimacy' | 'gift' | 'service')[];
}

export class ReconciliationService {
  /**
   * 生成和好方案
   */
  async generatePlans(judgmentId: string, preferences?: PlanPreferences, userId?: string) {
    // 1. 獲取判決信息（優化查詢，一次性獲取所有需要的数据）
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: {
        case: {
          include: {
            pairing: {
              select: {
                user1_id: true,
                user2_id: true,
              },
            },
          },
        },
      },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('判決不存在');
    }

    // 權限校驗：僅案件當事人可生成方案
    if (userId) {
      if (judgment.case.plaintiff_id !== userId && judgment.case.defendant_id !== userId) {
        throw Errors.FORBIDDEN('無權限生成和好方案');
      }
    }

    // 2. 檢查是否已有方案
    const existingPlans = await prisma.reconciliationPlan.findMany({
      where: { judgment_id: judgmentId },
    });

    if (existingPlans.length > 0) {
      return existingPlans;
    }

    // 2.5 載入個性化背景（用戶心理畫像 + 關係資料）
    let personalizationContext: string | undefined;
    let diagnosticContext: string | undefined;
    const caseRecord = judgment.case;
    if (caseRecord.mode !== CASE_MODE.QUICK) {
      try {
        const caseCtx = await caseContextService.loadCaseContext(caseRecord.id);
        if (caseCtx) {
          personalizationContext = caseContextService.formatForReconciliationPlans(caseCtx) || undefined;
        }
      } catch (err) {
        logger.warn('Failed to load case context for reconciliation', { judgmentId, error: err });
      }

      if (judgment.emotional_analysis && typeof judgment.emotional_analysis === 'object') {
        try {
          diagnosticContext = caseContextService.formatDiagnosticContext(
            judgment.emotional_analysis as Record<string, unknown>
          ) || undefined;
        } catch (err) {
          logger.warn('Failed to format diagnostic context for reconciliation', { judgmentId, error: err });
        }
      }
    }

    // 2.6 從判決內容中提取安全標記，區分 IPV 與自傷/自殺以適配不同介入策略
    let safetyContext: string | undefined;
    if (judgment.judgment_content) {
      const content = judgment.judgment_content;
      const hasIPV = IPV_SIGNAL_REGEX.test(content);
      const hasCrisis = CRISIS_SIGNAL_REGEX.test(content);

      if (hasIPV && hasCrisis) {
        safetyContext = '本案件同時偵測到親密暴力信號（控制、威脅或權力不對等模式）和自傷/自殺風險信號。請嚴格遵守下方「安全優先原則」中的兩個分支：針對親密暴力部分設計個人安全規劃，針對自傷風險部分優先設計危機支持方案並提供具體求助資源。生命安全是最高優先。';
      } else if (hasCrisis) {
        safetyContext = '本案件偵測到自傷/自殺風險信號。請嚴格遵守下方「安全優先原則」中的「自傷/自殺風險信號」分支：第一個方案必須是個人危機支持（含具體求助熱線），其餘方案應避免增加心理壓力，但可包含低壓力的社交連結活動（社交連結是重要的保護因子）。生命安全是最高優先。';
      } else if (hasIPV) {
        safetyContext = '本案件偵測到親密暴力相關信號（可能涉及控制、威脅或權力不對等模式）。請嚴格遵守下方「安全優先原則」中的「親密暴力信號」分支：不要設計需要雙方共同進行的方案，改為設計個人安全規劃和自我照顧方案。';
      } else if (SAFETY_SIGNAL_REGEX.test(content)) {
        safetyContext = '本案件的溝通回應中提及了安全相關議題。請格外留意下方「安全優先原則」，根據具體情況選擇適當的介入策略。';
      }
    }

    // 3. 調用AI生成方案
    let plans: ReconciliationPlan[];
    try {
      plans = await aiService.generateReconciliationPlans(
        judgment.case.type,
        {
          plaintiff: judgment.plaintiff_ratio ?? 0,
          defendant: judgment.defendant_ratio ?? 0,
        },
        judgment.summary || '',
        personalizationContext,
        safetyContext,
        diagnosticContext
      );
    } catch (error) {
      logger.error('Failed to generate reconciliation plans', { judgmentId, error });
      throw Errors.AI_SERVICE_ERROR('和好方案生成失敗');
    }

    // 4. 過濾方案（根據偏好）
    let filteredPlans = plans;
    if (preferences) {
      if (preferences.difficulty) {
        filteredPlans = filteredPlans.filter(
          plan => plan.difficulty_level === preferences.difficulty
        );
      }
      if (preferences.types && preferences.types.length > 0) {
        filteredPlans = filteredPlans.filter(plan =>
          preferences.types!.includes(plan.plan_type)
        );
      }
    }

    // 5. 驗證並保存方案（使用事務批量創建，確保錯誤回滾）
    const savedPlans = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const plan of filteredPlans) {
        // 驗證方案內容
        if (!isReconciliationPlanContent(plan)) {
          throw Errors.VALIDATION_ERROR('無效的和好方案格式');
        }

        const safePlan = sanitizePlanStrings(plan);
        const saved = await tx.reconciliationPlan.create({
          data: {
            judgment_id: judgmentId,
            plan_content: JSON.stringify(safePlan),
            plan_type: plan.plan_type,
            difficulty_level: plan.difficulty_level || 'medium',
            estimated_duration: plan.estimated_duration || 7,
            time_cost: plan.time_cost,
            money_cost: plan.money_cost,
            emotion_cost: plan.emotion_cost,
            skill_requirement: plan.skill_requirement,
          },
        });
        results.push(saved);
      }
      return results;
    });

    logger.info('Reconciliation plans generated', { judgmentId, count: savedPlans.length });

    return savedPlans;
  }

  /**
   * 獲取和好方案列表（含權限校驗）
   */
  async getPlansByJudgmentId(judgmentId: string, userId: string, filters?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    type?: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
  }) {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: { case: { select: { plaintiff_id: true, defendant_id: true, session_id: true } } },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('判決不存在');
    }

    const c = judgment.case;
    if (c.plaintiff_id !== userId && c.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限查看此判決的和好方案');
    }

    const where: Prisma.ReconciliationPlanWhereInput = { judgment_id: judgmentId };

    if (filters) {
      if (filters.difficulty) {
        where.difficulty_level = filters.difficulty;
      }
      if (filters.type) {
        where.plan_type = filters.type;
      }
    }

    const plans = await prisma.reconciliationPlan.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return plans;
  }

  /**
   * 獲取和好方案詳情（包含judgment和case信息）
   */
  async getPlanById(planId: string, userId: string) {
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: planId },
      include: {
        judgment: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!plan) {
      throw Errors.NOT_FOUND('和好方案不存在');
    }

    const case_ = plan.judgment.case;
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限查看此方案');
    }

    const { emotional_analysis: _ea, ...safeJudgment } = plan.judgment;
    return { ...plan, judgment: safeJudgment };
  }

  /**
   * 選擇和好方案
   */
  async selectPlan(planId: string, userId: string) {
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: planId },
      include: {
        judgment: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!plan) {
      throw Errors.NOT_FOUND('和好方案不存在');
    }

    // 驗證用戶權限
    const case_ = plan.judgment.case;
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限選擇此方案');
    }

    // 確定是user1還是user2
    const isUser1 = case_.plaintiff_id === userId;

    // 更新方案選擇狀態
    const updatedPlan = await prisma.reconciliationPlan.update({
      where: { id: planId },
      data: {
        ...(isUser1
          ? { user1_selected: true }
          : { user2_selected: true }),
      },
    });

    return updatedPlan;
  }
}

export const reconciliationService = new ReconciliationService();
