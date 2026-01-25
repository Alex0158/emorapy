/**
 * 案件狀態管理
 */

import { create } from 'zustand';
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

export const useCaseStore = create<CaseState>((set, get) => ({
  currentCase: null,
  isLoading: false,
  error: null,

  createQuickCase: async (data: QuickCaseDto) => {
    set({ isLoading: true, error: null });

    try {
      const result = await createQuickCaseApi(data);
      set({ currentCase: result.case, isLoading: false });
      return result;
    } catch (error: any) {
      set({
        error: error.message || '創建案件失敗',
        isLoading: false,
      });
      throw error;
    }
  },

  submitCase: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      await submitCase(id);
      // 更新案件狀態
      const currentCase = get().currentCase;
      if (currentCase && currentCase.id === id) {
        set({
          currentCase: { ...currentCase, status: 'submitted' },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.message || '提交案件失敗',
        isLoading: false,
      });
      throw error;
    }
  },

  getCase: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const case_ = await getCase(id);
      set({ currentCase: case_, isLoading: false });
      return case_;
    } catch (error: any) {
      set({
        error: error.message || '獲取案件失敗',
        isLoading: false,
      });
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

