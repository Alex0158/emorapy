/**
 * 案件狀態管理
 */

import { create } from 'zustand';
import { getErrorMessage } from '@/utils/apiError';
import type { Case, QuickCaseDto } from '@/types/case';
import { createQuickCase as createQuickCaseApi, submitCase, getCase } from '@/services/api/case';

interface CaseState {
  currentCase: Case | null;
  isLoading: boolean;
  error: string | null;
  createQuickCase: (data: QuickCaseDto) => Promise<{ case: Case; session_id?: string; session_expires_at?: string }>;
  submitCase: (id: string) => Promise<void>;
  getCase: (id: string) => Promise<Case>;
  setCurrentCase: (case_: Case | null) => void;
  clearError: () => void;
}

let _reqSeq = 0;

export const useCaseStore = create<CaseState>((set, get) => ({
  currentCase: null,
  isLoading: false,
  error: null,

  createQuickCase: async (data: QuickCaseDto) => {
    if (get().isLoading) return { case: null as unknown as Case, session_id: undefined, session_expires_at: undefined };
    set({ isLoading: true, error: null });

    try {
      const result = await createQuickCaseApi(data);
      set({ currentCase: result.case, isLoading: false });
      return result;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.createCaseFail'), isLoading: false });
      throw error;
    }
  },

  submitCase: async (id: string) => {
    if (get().isLoading) throw new Error();
    set({ isLoading: true, error: null });

    try {
      const updatedCase = await submitCase(id);
      set({ currentCase: updatedCase, isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.submitCaseFail'), isLoading: false });
      throw error;
    }
  },

  getCase: async (id: string) => {
    const seq = ++_reqSeq;
    set({ isLoading: true, error: null });

    try {
      const case_ = await getCase(id);
      if (seq !== _reqSeq) return case_;
      set({ currentCase: case_, isLoading: false });
      return case_;
    } catch (error: unknown) {
      if (seq !== _reqSeq) throw error;
      set({ error: getErrorMessage(error, 'message.getCaseFail'), isLoading: false });
      throw error;
    }
  },

  setCurrentCase: (case_: Case | null) => {
    set({ currentCase: case_ });
  },

  clearError: () => {
    set({ error: null });
  },
}));

