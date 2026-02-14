/**
 * 執行追蹤狀態管理
 */

import { create } from 'zustand';
import type { ExecutionStatus } from '@/services/api/execution';
import { getErrorMessage } from '@/utils/apiError';
import { confirmExecution, checkin, getExecutionStatus } from '@/services/api/execution';

interface ExecutionState {
  executions: ExecutionStatus[];
  currentExecution: ExecutionStatus | null;
  isLoading: boolean;
  error: string | null;
  confirmExecution: (planId: string) => Promise<void>;
  checkin: (data: { plan_id: string; notes?: string; photos?: string[] }) => Promise<void>;
  getExecutionStatus: (planId: string) => Promise<ExecutionStatus>;
  setCurrentExecution: (execution: ExecutionStatus | null) => void;
  clearError: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executions: [],
  currentExecution: null,
  isLoading: false,
  error: null,

  confirmExecution: async (planId: string) => {
    set({ isLoading: true, error: null });
    try {
      await confirmExecution(planId);
      set({ isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.confirmExecutionFail'), isLoading: false });
      throw error;
    }
  },

  checkin: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await checkin(data);
      set({ isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.checkinFail'), isLoading: false });
      throw error;
    }
  },

  getExecutionStatus: async (planId: string) => {
    set({ isLoading: true, error: null });
    try {
      const status = await getExecutionStatus(planId);
      set({ currentExecution: status, isLoading: false });
      return status;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.getExecutionStatusFail'), isLoading: false });
      throw error;
    }
  },

  setCurrentExecution: (execution: ExecutionStatus | null) => {
    set({ currentExecution: execution });
  },

  clearError: () => {
    set({ error: null });
  },
}));

