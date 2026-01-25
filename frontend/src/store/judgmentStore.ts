/**
 * 判決狀態管理
 */

import { create } from 'zustand';
import type { Judgment } from '@/types/judgment';
import { generateJudgment, getJudgment, getJudgmentByCaseId } from '@/services/api/judgment';

interface JudgmentState {
  currentJudgment: Judgment | null;
  isLoading: boolean;
  error: string | null;
  generateJudgment: (caseId: string) => Promise<Judgment>;
  getJudgment: (id: string) => Promise<Judgment>;
  getJudgmentByCaseId: (caseId: string) => Promise<Judgment | null>;
  setCurrentJudgment: (judgment: Judgment | null) => void;
  clearError: () => void;
}

export const useJudgmentStore = create<JudgmentState>((set) => ({
  currentJudgment: null,
  isLoading: false,
  error: null,

  generateJudgment: async (caseId: string) => {
    set({ isLoading: true, error: null });

    try {
      const judgment = await generateJudgment(caseId);
      set({ currentJudgment: judgment, isLoading: false });
      return judgment;
    } catch (error: any) {
      set({
        error: error.message || '生成判決失敗',
        isLoading: false,
      });
      throw error;
    }
  },

  getJudgment: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const judgment = await getJudgment(id);
      set({ currentJudgment: judgment, isLoading: false });
      return judgment;
    } catch (error: any) {
      set({
        error: error.message || '獲取判決失敗',
        isLoading: false,
      });
      throw error;
    }
  },

  getJudgmentByCaseId: async (caseId: string) => {
    set({ isLoading: true, error: null });

    try {
      const judgment = await getJudgmentByCaseId(caseId);
      set({ currentJudgment: judgment, isLoading: false });
      return judgment;
    } catch (error: any) {
      set({
        error: error.message || '獲取判決失敗',
        isLoading: false,
      });
      return null;
    }
  },

  setCurrentJudgment: (judgment: Judgment | null) => {
    set({ currentJudgment: judgment });
  },

  clearError: () => {
    set({ error: null });
  },
}));

