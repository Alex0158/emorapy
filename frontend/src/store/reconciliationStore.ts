/**
 * 和好方案狀態管理
 */

import { create } from 'zustand';
import { getErrorMessage } from '@/utils/apiError';
import type { ReconciliationPlan, PlanPreferences } from '@/services/api/reconciliation';
import { getPlans, selectPlan, generatePlans } from '@/services/api/reconciliation';

export type PlanFilters = {
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'activity' | 'communication' | 'intimacy';
};

interface ReconciliationState {
  plans: ReconciliationPlan[];
  selectedPlan: ReconciliationPlan | null;
  isLoading: boolean;
  error: string | null;
  getPlans: (judgmentId: string, filters?: PlanFilters) => Promise<ReconciliationPlan[]>;
  generatePlans: (judgmentId: string, preferences?: PlanPreferences) => Promise<ReconciliationPlan[]>;
  selectPlan: (planId: string) => Promise<void>;
  setSelectedPlan: (plan: ReconciliationPlan | null) => void;
  clearError: () => void;
}

let _reqSeq = 0;

export const useReconciliationStore = create<ReconciliationState>((set) => ({
  plans: [],
  selectedPlan: null,
  isLoading: false,
  error: null,

  getPlans: async (judgmentId: string, filters?: PlanFilters) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });
    try {
      const plans = await getPlans(judgmentId, filters);
      if (seq !== _reqSeq) return plans;
      set({ plans, isLoading: false });
      return plans;
    } catch (error: unknown) {
      if (seq !== _reqSeq) throw error;
      set({ error: getErrorMessage(error, 'message.getPlansFail'), isLoading: false });
      throw error;
    }
  },

  generatePlans: async (judgmentId: string, preferences?: PlanPreferences) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });
    try {
      const plans = await generatePlans(judgmentId, preferences);
      if (seq !== _reqSeq) return plans;
      set({ plans, isLoading: false });
      return plans;
    } catch (error: unknown) {
      if (seq !== _reqSeq) throw error;
      set({ error: getErrorMessage(error, 'message.generatePlansFail'), isLoading: false });
      throw error;
    }
  },

  selectPlan: async (planId: string) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });
    try {
      const plan = await selectPlan(planId);
      if (seq !== _reqSeq) return;
      set({ selectedPlan: plan, isLoading: false });
    } catch (error: unknown) {
      if (seq !== _reqSeq) return;
      set({ error: getErrorMessage(error, 'message.selectPlanFail'), isLoading: false });
      throw error;
    }
  },

  setSelectedPlan: (plan: ReconciliationPlan | null) => {
    set({ selectedPlan: plan });
  },

  clearError: () => {
    set({ error: null });
  },
}));

