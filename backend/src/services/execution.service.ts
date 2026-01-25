import prisma from '../config/database';
import { Errors } from '../utils/errors';
import logger from '../config/logger';

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
   * 確認執行
   */
  async confirmExecution(userId: string, planId: string) {
    // 1. 驗證方案是否存在
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

    // 2. 驗證用戶權限
    const case_ = plan.judgment.case;
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限執行此方案');
    }

    // 3. 檢查當事人是否已選擇此方案
    const isUser1 = case_.plaintiff_id === userId;
    const isUser2 = case_.defendant_id === userId;
    const selected =
      (isUser1 && plan.user1_selected) ||
      (isUser2 && plan.user2_selected);
    if (!selected) {
      throw Errors.FORBIDDEN('請先在和好方案中選擇此方案再確認執行');
    }

    // 4. 檢查是否已有執行記錄
    const existing = await prisma.executionRecord.findFirst({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: 'confirm',
      },
    });

    if (existing) {
      return existing;
    }

    // 5. 創建執行記錄
    const execution = await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: planId,
        user_id: userId,
        action: 'confirm',
        status: 'in_progress',
      },
    });

    logger.info('Execution confirmed', { executionId: execution.id, userId, planId });

    return execution;
  }

  /**
   * 執行打卡
   */
  async checkin(userId: string, data: CheckinDto) {
    // 1. 驗證方案是否存在
    const plan = await prisma.reconciliationPlan.findUnique({
      where: { id: data.plan_id },
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

    // 2. 驗證用戶權限
    const case_ = plan.judgment.case;
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限執行此方案');
    }

    // 3. 檢查用戶是否已確認/選擇方案
    const isUser1 = case_.plaintiff_id === userId;
    const isUser2 = case_.defendant_id === userId;
    const selected =
      (isUser1 && plan.user1_selected) ||
      (isUser2 && plan.user2_selected);
    if (!selected) {
      throw Errors.FORBIDDEN('請先選擇並確認此方案後再打卡');
    }

    // 4. 創建打卡記錄
    const execution = await prisma.executionRecord.create({
      data: {
        reconciliation_plan_id: data.plan_id,
        user_id: userId,
        action: 'checkin',
        status: 'in_progress',
        notes: data.notes,
        photos_urls: data.photos || [],
      },
    });

    // 評估進度並可能標記完成
    await this.updatePlanStatusIfCompleted(data.plan_id, userId);

    logger.info('Execution checkin', { executionId: execution.id, userId, planId: data.plan_id });

    return execution;
  }

  /**
   * 獲取執行狀態
   */
  async getExecutionStatus(userId: string, planId: string) {
    // 1. 驗證方案是否存在
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

    // 2. 驗證用戶權限
    const case_ = plan.judgment.case;
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限查看此執行狀態');
    }

    // 3. 獲取執行記錄
    const records = await prisma.executionRecord.findMany({
      where: {
        reconciliation_plan_id: planId,
        user_id: userId,
      },
      orderBy: { created_at: 'desc' },
    });

    // 4. 計算進度與狀態
    const progressResult = this.calculateProgress(plan, records);
    // 同步最新狀態（只在內存計算，不寫回 DB）
    return {
      plan_id: planId,
      status: progressResult.status,
      records,
      progress: progressResult.progress,
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
      },
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
                },
              },
            },
          },
        },
      },
    });

    // 2. 提取所有已選擇的和好方案
    const allPlans: any[] = [];
    (cases as any[]).forEach((case_: any) => {
      if (case_.judgment) {
        case_.judgment.reconciliation_plans.forEach((plan: any) => {
          if (plan.user1_selected || plan.user2_selected) {
            allPlans.push({
              plan,
              records: plan.execution_records,
            });
          }
        });
      }
    });

    // 3. 構建執行狀態列表
    const executionStatuses = allPlans.map(({ plan, records }) => {
      const progressResult = this.calculateProgress(plan, records);
      return {
        plan_id: plan.id,
        status: progressResult.status,
        records,
        progress: progressResult.progress,
      };
    });

    return executionStatuses;
  }

  /**
   * 計算執行進度
   */
  private calculateProgress(plan: any, records: any[]): ExecutionProgressResult {
    if (records.length === 0) {
      return { status: 'pending', progress: 0 };
    }

    const estimatedDuration = plan.estimated_duration || 7;
    const checkinCount = records.filter(r => r.action === 'checkin').length;
    const progress = Math.min(100, Math.round((checkinCount / estimatedDuration) * 100));

    let status: ExecutionProgressResult['status'] = 'in_progress';
    if (progress >= 100) {
      status = 'completed';
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
    if (progress.status === 'completed') {
      // 寫入一條完成記錄（去重）
      const existingCompleted = plan.execution_records.find(
        r => r.action === 'complete' && r.user_id === userId
      );
      if (!existingCompleted) {
        await prisma.executionRecord.create({
          data: {
            reconciliation_plan_id: planId,
            user_id: userId,
            action: 'complete',
            status: 'completed',
            notes: '自動標記完成',
          },
        });
      }
    }
  }
}

export const executionService = new ExecutionService();
