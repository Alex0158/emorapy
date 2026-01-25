/**
 * 和好方案狀態管理
 */

import { create } from 'zustand';
import type { ReconciliationPlan } from '@/services/api/reconciliation';
import { getPlans, selectPlan, generatePlans } from '@/services/api/reconciliation';

interface ReconciliationState {
  plans: ReconciliationPlan[];
  selectedPlan: ReconciliationPlan | null;
  isLoading: boolean;
  error: string | null;
  getPlans: (judgmentId: string, filters?: any) => Promise<ReconciliationPlan[]>;
  generatePlans: (judgmentId: string, preferences?: any) => Promise<ReconciliationPlan[]>;
  selectPlan: (planId: string) => Promise<void>;
  setSelectedPlan: (plan: ReconciliationPlan | null) => void;
  clearError: () => void;
}

export const useReconciliationStore = create<ReconciliationState>((set) => ({
  plans: [],
  selectedPlan: null,
  isLoading: false,
  error: null,

  getPlans: async (judgmentId: string, filters?: any) => {
    set({ isLoading: true, error: null });
    try {
      const plans = await getPlans(judgmentId, filters);
      set({ plans, isLoading: false });
      return plans;
    } catch (error: any) {
      set({ error: error.message || '獲取和好方案失敗', isLoading: false });
      throw error;
    }
  },

  generatePlans: async (judgmentId: string, preferences?: any) => {
    set({ isLoading: true, error: null });
    try {
      const plans = await generatePlans(judgmentId, preferences);
      set({ plans, isLoading: false });
      return plans;
    } catch (error: any) {
      set({ error: error.message || '生成和好方案失敗', isLoading: false });
      throw error;
    }
  },

  selectPlan: async (planId: string) => {
    set({ isLoading: true, error: null });
    try {
      const plan = await selectPlan(planId);
      set({ selectedPlan: plan, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || '選擇方案失敗', isLoading: false });
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

