import prisma from '../config/database';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import {
  CASE_STATUS,
  EXECUTION_ACTION,
  EXECUTION_STATUS,
  PAGINATION,
  CLEANUP_THRESHOLDS,
} from '../utils/constants';

export interface CheckinDto {
  plan_id: string;
  notes?: string;
  photos?: string[];
}

interface ExecutionProgressResult {
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
}

export class ExecutionService {
  /**
   * 載入方案並驗證用戶是案件當事人
   */
  private async loadPlanAndAssertParticipant(planId: string, userId: string) {
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: planId },
      include: { judgment: { include: { case: true } } },
    });
    if (!plan) throw Errors.NOT_FOUND('和好方案不存在');

    const case_ = plan.judgment.case;
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限執行此方案');
    }
    return { plan: plan as NonNullable<typeof plan>, case_ };
  }

  /**
   * 檢查用戶是否已選擇此方案
   */
  private assertPlanSelected(
    plan: { user1_selected: boolean; user2_selected: boolean },
    case_: { plaintiff_id: string | null; defendant_id: string | null },
    userId: string,
    errorMsg: string,
  ) {
    const isUser1 = case_.plaintiff_id === userId;
    const isUser2 = case_.defendant_id === userId;
    const selected = (isUser1 && plan.user1_selected) || (isUser2 && plan.user2_selected);
    if (!selected) throw Errors.FORBIDDEN(errorMsg);
  }

  /**
   * 確認執行
   */
  async confirmExecution(userId: string, planId: string) {
    const { plan, case_ } = await this.loadPlanAndAssertParticipant(planId, userId);
    this.assertPlanSelected(plan, case_, userId, '請先在和好方案中選擇此方案再確認執行');

    const existing = await prisma.executionRecord.findFirst({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: EXECUTION_ACTION.CONFIRM,
      },
    });

    if (existing) return existing;

    const execution = await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: EXECUTION_ACTION.CONFIRM,
        status: EXECUTION_STATUS.IN_PROGRESS,
      },
    });

    logger.info('Execution confirmed', { executionId: execution.id, userId, planId });

    return execution;
  }

  /**
   * 執行打卡
   */
  async checkin(userId: string, data: CheckinDto) {
    const { plan, case_ } = await this.loadPlanAndAssertParticipant(data.plan_id, userId);
    this.assertPlanSelected(plan, case_, userId, '請先選擇並確認此方案後再打卡');
    const safeNotes = data.notes
      ? data.notes
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
          .slice(0, 500)
      : undefined;

    const safePhotos = (data.photos || [])
      .filter(url => /^https?:\/\//i.test(url))
      .slice(0, 20);

    const execution = await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: data.plan_id,
        user_id: userId,
        action: EXECUTION_ACTION.CHECKIN,
        status: EXECUTION_STATUS.IN_PROGRESS,
        notes: safeNotes,
        photos_urls: safePhotos,
      },
    });

    // 評估進度並可能標記完成
    await this.updatePlanStatusIfCompleted(data.plan_id, userId);

    logger.info('Execution checkin', { executionId: execution.id, userId, planId: data.plan_id });

    return execution;
  }

  /**
   * 從 plan_content JSON 提取摘要
   */
  private extractPlanSummary(plan: {
    plan_content: string;
    plan_type: string;
    difficulty_level: string;
    estimated_duration: number | null;
  }) {
    try {
      const content = JSON.parse(plan.plan_content);
      return {
        title: content.title || '',
        plan_type: plan.plan_type,
        difficulty_level: plan.difficulty_level,
        estimated_duration: plan.estimated_duration ?? undefined,
      };
    } catch {
      return {
        title: '',
        plan_type: plan.plan_type,
        difficulty_level: plan.difficulty_level,
        estimated_duration: plan.estimated_duration ?? undefined,
      };
    }
  }

  /**
   * 獲取執行狀態
   */
  async getExecutionStatus(userId: string, planId: string) {
    const { plan } = await this.loadPlanAndAssertParticipant(planId, userId);
    const records = await prisma.executionRecord.findMany({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
      },
      orderBy: { created_at: 'desc' },
    });

    const progressResult = this.calculateProgress(plan, records);
    return {
      plan_id: planId,
      status: progressResult.status,
      records,
      progress: progressResult.progress,
      plan_summary: this.extractPlanSummary(plan),
    };
  }

  /**
   * 獲取用戶所有執行狀態（用於執行看板）
   */
  async getAllExecutionStatuses(userId: string) {
    // 1. 獲取用戶參與的所有案件
    const cases = await prisma.case.findMany({
      where: {
        OR: [
          { plaintiff_id: userId },
          { defendant_id: userId },
        ],
        status: { in: [CASE_STATUS.COMPLETED] },
      },
      take: PAGINATION.EXECUTION_LIST_TAKE,
      orderBy: { created_at: 'desc' },
      include: {
        judgment: {
          include: {
            reconciliation_plans: {
              include: {
                execution_records: {
                  where: {
                    user_id: userId,
                  },
                  orderBy: { created_at: 'desc' },
                  take: PAGINATION.EXECUTION_RECORDS_TAKE,
                },
              },
            },
          },
        },
      },
    });

    // 2. 提取所有已選擇的和好方案
    const allPlans = cases.flatMap((case_) => {
      if (!case_.judgment) return [];
      return case_.judgment.reconciliation_plans
        .filter((plan) => plan.user1_selected || plan.user2_selected)
        .map((plan) => ({ plan, records: plan.execution_records }));
    });

    // 3. 構建執行狀態列表
    const executionStatuses = allPlans.map(({ plan, records }) => {
      const progressResult = this.calculateProgress(plan, records);
      return {
        plan_id: plan.id,
        status: progressResult.status,
        records,
        progress: progressResult.progress,
        plan_summary: this.extractPlanSummary(plan),
      };
    });

    return executionStatuses;
  }

  /**
   * 計算執行進度
   */
  private calculateProgress(
    plan: { estimated_duration: number | null },
    records: Array<{ action: string }>,
  ): ExecutionProgressResult {
    if (records.length === 0) {
      return { status: EXECUTION_STATUS.PENDING as ExecutionProgressResult['status'], progress: 0 };
    }

    const estimatedDuration = plan.estimated_duration || CLEANUP_THRESHOLDS.DEFAULT_ESTIMATED_DURATION_DAYS;
    const checkinCount = records.filter(r => r.action === EXECUTION_ACTION.CHECKIN).length;
    const progress = Math.min(100, Math.round((checkinCount / estimatedDuration) * 100));

    let status: ExecutionProgressResult['status'] = EXECUTION_STATUS.IN_PROGRESS as ExecutionProgressResult['status'];
    if (progress >= 100) {
      status = EXECUTION_STATUS.COMPLETED as ExecutionProgressResult['status'];
    }

    return { status, progress };
  }

  /**
   * 如果達到完成條件，標記執行記錄與方案狀態
   */
  private async updatePlanStatusIfCompleted(planId: string, userId: string): Promise<void> {
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: planId },
      include: {
        execution_records: {
          where: { user_id: userId },
        },
      },
    });

    if (!plan) return;

    const progress = this.calculateProgress(plan, plan.execution_records);
    if (progress.status === EXECUTION_STATUS.COMPLETED) {
      // 寫入一條完成記錄（去重）
      const existingCompleted = plan.execution_records.find(
        r => r.action === EXECUTION_ACTION.COMPLETE && r.user_id === userId
      );
      if (!existingCompleted) {
        await prisma.executionRecord.create({
          data: {
            reconciliation_plan_id: planId,
            user_id: userId,
            action: EXECUTION_ACTION.COMPLETE,
            status: EXECUTION_STATUS.COMPLETED,
            notes: '自動標記完成',
          },
        });
      }
    }
  }
}

export const executionService = new ExecutionService();
