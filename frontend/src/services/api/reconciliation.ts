/**
 * 和好方案API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';

export interface ReconciliationPlan {
  id: string;
  judgment_id: string;
  plan_content: string;
  plan_type: 'activity' | 'communication' | 'intimacy';
  difficulty_level: 'easy' | 'medium' | 'hard';
  estimated_duration?: number;
  time_cost: number;
  money_cost: number;
  emotion_cost: number;
  skill_requirement: number;
  user1_selected: boolean;
  user2_selected: boolean;
  created_at: string;
}

export interface PlanPreferences {
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: number;
  types?: ('activity' | 'communication' | 'intimacy')[];
}

/**
 * 生成和好方案
 */
export const generatePlans = async (
  judgmentId: string,
  preferences?: PlanPreferences
): Promise<ReconciliationPlan[]> => {
  const response = await request.post<ApiResponse<{ plans: ReconciliationPlan[] }>>(
    `/judgments/${judgmentId}/reconciliation-plans`,
    { preferences }
  );
  return (response.data as ApiResponse<{ plans: ReconciliationPlan[] }>).data.plans;
};

/**
 * 獲取和好方案列表
 */
export const getPlans = async (
  judgmentId: string,
  filters?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    type?: 'activity' | 'communication' | 'intimacy';
  }
): Promise<ReconciliationPlan[]> => {
  const params = new URLSearchParams();
  if (filters?.difficulty) {
    params.append('difficulty', filters.difficulty);
  }
  if (filters?.type) {
    params.append('type', filters.type);
  }

  const queryString = params.toString();
  const url = `/judgments/${judgmentId}/reconciliation-plans${queryString ? `?${queryString}` : ''}`;

  const response = await request.get<ApiResponse<{ plans: ReconciliationPlan[] }>>(url);
  return (response.data as ApiResponse<{ plans: ReconciliationPlan[] }>).data.plans;
};

/**
 * 獲取和好方案詳情
 */
export const getPlanById = async (planId: string): Promise<ReconciliationPlan & { judgment: { case_id: string } }> => {
  const response = await request.get<ApiResponse<{ plan: ReconciliationPlan & { judgment: { case_id: string } } }>>(
    `/reconciliation-plans/${planId}`
  );
  return (response.data as ApiResponse<{ plan: ReconciliationPlan & { judgment: { case_id: string } } }>).data.plan;
};

/**
 * 選擇和好方案
 */
export const selectPlan = async (planId: string): Promise<ReconciliationPlan> => {
  const response = await request.post<ApiResponse<{ plan: ReconciliationPlan }>>(
    `/reconciliation-plans/${planId}/select`
  );
  return (response.data as ApiResponse<{ plan: ReconciliationPlan }>).data.plan;
};

