/**
 * 和好方案狀態管理
 */

import { create } from 'zustand';
import { getErrorMessage } from '@/utils/apiError';
import type { ReconciliationPlan, PlanPreferences, ReconciliationIntent } from '@/services/api/reconciliation';
import { getPlans, selectPlan, generatePlans } from '@/services/api/reconciliation';

export type PlanFilters = {
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
  intent?: ReconciliationIntent;
};

interface ReconciliationState {
  plans: ReconciliationPlan[];
  selectedPlan: ReconciliationPlan | null;
  isLoading: boolean;
  error: string | null;
  getPlans: (judgmentId: string, filters?: PlanFilters) => Promise<ReconciliationPlan[]>;
  generatePlans: (judgmentId: string, input?: {
    intent?: ReconciliationIntent;
    preferences?: PlanPreferences;
    force_regenerate?: boolean;
  }) => Promise<ReconciliationPlan[]>;
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
      const bundle = await getPlans(judgmentId, filters);
      const plans = bundle.plans;
      if (seq !== _reqSeq) return plans;
      set({ plans, isLoading: false });
      return plans;
    } catch (error: unknown) {
      if (seq !== _reqSeq) throw error;
      set({ error: getErrorMessage(error, 'message.getPlansFail'), isLoading: false });
      throw error;
    }
  },

  generatePlans: async (judgmentId: string, input) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });
    try {
      const bundle = await generatePlans(judgmentId, input);
      const plans = bundle.plans;
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
      if (seq !== _reqSeq) throw error;
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
