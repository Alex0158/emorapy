/**
 * 判決狀態管理
 */

import { create } from 'zustand';
import { getErrorMessage } from '@/utils/apiError';
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

let _reqSeq = 0;

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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.generateJudgmentFail'), isLoading: false });
      throw error;
    }
  },

  getJudgment: async (id: string) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });

    try {
      const judgment = await getJudgment(id);
      if (seq !== _reqSeq) return judgment;
      set({ currentJudgment: judgment, isLoading: false });
      return judgment;
    } catch (error: unknown) {
      if (seq !== _reqSeq) throw error;
      set({ error: getErrorMessage(error, 'message.getJudgmentFail'), isLoading: false });
      throw error;
    }
  },

  getJudgmentByCaseId: async (caseId: string) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });

    try {
      const judgment = await getJudgmentByCaseId(caseId);
      if (seq !== _reqSeq) return judgment;
      set({ currentJudgment: judgment, isLoading: false });
      return judgment;
    } catch (error: unknown) {
      if (seq !== _reqSeq) return null;
      set({ error: getErrorMessage(error, 'message.getJudgmentFail'), isLoading: false });
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

