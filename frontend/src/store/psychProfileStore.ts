/**
 * 心理畫像狀態管理
 */

import { create } from 'zustand';
import { psychProfileApi } from '@/services/api/psychProfile';
import { getErrorMessage } from '@/utils/apiError';
import { useInterviewStore } from './interviewStore';
import type {
  PsychProfile,
  FeedbackHistoryItem,
} from '@/types/interview';

interface PsychProfileState {
  profile: PsychProfile | null;
  feedbackHistory: FeedbackHistoryItem[];
  loading: boolean;
  error: string | null;
  consentLoading: boolean;

  fetchProfile: () => Promise<void>;
  fetchFeedbackHistory: () => Promise<void>;
  giveConsent: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  reset: () => void;
}

export const usePsychProfileStore = create<PsychProfileState>((set) => ({
  profile: null,
  feedbackHistory: [],
  loading: false,
  error: null,
  consentLoading: false,

  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await psychProfileApi.getProfile();
      set({ profile: profile ?? null, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'psychProfile.loadFail'), loading: false });
    }
  },

  fetchFeedbackHistory: async () => {
    set({ loading: true, error: null });
    try {
      const history = (await psychProfileApi.getFeedbackHistory()).history;
      set({ feedbackHistory: Array.isArray(history) ? history : [], loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'psychProfile.loadHistoryFail'), loading: false });
    }
  },

  giveConsent: async () => {
    set({ consentLoading: true, error: null });
    try {
      await psychProfileApi.giveConsent();
      set((state) => ({
        profile: state.profile
          ? {
              ...state.profile,
              consent_given: true,
              consent_at: new Date().toISOString(),
            }
          : {
              consent_given: true,
              consent_at: new Date().toISOString(),
              narratives: [],
              insights: [],
              richness_score: 0,
            },
        consentLoading: false,
      }));
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'psychProfile.consentFail'), consentLoading: false });
      throw err;
    }
  },

  deleteAllData: async () => {
    set({ loading: true, error: null });
    try {
      await psychProfileApi.deleteAllData();
      useInterviewStore.getState().reset();
      set({
        profile: null,
        feedbackHistory: [],
        loading: false,
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'psychProfile.deleteFail'), loading: false });
      throw err;
    }
  },

  reset: () => {
    set({
      profile: null,
      feedbackHistory: [],
      loading: false,
      error: null,
      consentLoading: false,
    });
  },
}));
