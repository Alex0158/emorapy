/**
 * psychProfileStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePsychProfileStore } from './psychProfileStore';

const mockGetProfile = vi.fn();
const mockGetFeedbackHistory = vi.fn();
const mockGiveConsent = vi.fn();
const mockDeleteAllData = vi.fn();

vi.mock('@/services/api/psychProfile', () => ({
  psychProfileApi: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    getFeedbackHistory: (...args: unknown[]) => mockGetFeedbackHistory(...args),
    giveConsent: (...args: unknown[]) => mockGiveConsent(...args),
    deleteAllData: (...args: unknown[]) => mockDeleteAllData(...args),
  },
}));

vi.mock('@/utils/apiError', () => ({
  getErrorMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

const mockInterviewReset = vi.fn();
vi.mock('./interviewStore', () => ({
  useInterviewStore: {
    getState: () => ({ reset: mockInterviewReset }),
  },
}));

describe('psychProfileStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePsychProfileStore.setState({
      profile: null,
      feedbackHistory: [],
      loading: false,
      error: null,
      consentLoading: false,
    });
  });

  describe('fetchProfile', () => {
    it('成功時應設置 profile', async () => {
      const profileData = { consent_given: true, richness_score: 50, narratives: [], insights: [] };
      mockGetProfile.mockResolvedValue({ data: { data: profileData } });
      await usePsychProfileStore.getState().fetchProfile();
      const state = usePsychProfileStore.getState();
      expect(state.profile).toEqual(profileData);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('失敗時應設置 error', async () => {
      mockGetProfile.mockRejectedValue(new Error('network'));
      await usePsychProfileStore.getState().fetchProfile();
      const state = usePsychProfileStore.getState();
      expect(state.error).toBe('network');
      expect(state.loading).toBe(false);
      expect(state.profile).toBeNull();
    });

    it('失敗且錯誤無 message 時應使用 psychProfile.loadFail fallback', async () => {
      mockGetProfile.mockRejectedValue({ code: 'FORBIDDEN' });
      await usePsychProfileStore.getState().fetchProfile();
      expect(usePsychProfileStore.getState().error).toBe('psychProfile.loadFail');
    });

    it('API 返回空 data 時 profile 應為 null', async () => {
      mockGetProfile.mockResolvedValue({ data: {} });
      await usePsychProfileStore.getState().fetchProfile();
      expect(usePsychProfileStore.getState().profile).toBeNull();
    });

    it('失敗且錯誤無 message 時應使用 psychProfile.loadFail 作為 error', async () => {
      mockGetProfile.mockRejectedValue({ code: 'FORBIDDEN' });
      await usePsychProfileStore.getState().fetchProfile();
      expect(usePsychProfileStore.getState().error).toBe('psychProfile.loadFail');
    });
  });

  describe('fetchFeedbackHistory', () => {
    it('成功時應設置 feedbackHistory', async () => {
      const history = [{ session_id: 's1', created_at: '2025-01-01', domains_touched: [] }];
      mockGetFeedbackHistory.mockResolvedValue({ data: { data: { history } } });
      await usePsychProfileStore.getState().fetchFeedbackHistory();
      expect(usePsychProfileStore.getState().feedbackHistory).toEqual(history);
    });

    it('失敗時應設置 error', async () => {
      mockGetFeedbackHistory.mockRejectedValue(new Error('fail'));
      await usePsychProfileStore.getState().fetchFeedbackHistory();
      expect(usePsychProfileStore.getState().error).toBe('fail');
    });

    it('API 回傳 history 為非陣列時應設置空陣列（F06 邊界：API 回傳不完整時防禦）', async () => {
      mockGetFeedbackHistory.mockResolvedValue({ data: { data: { history: { items: [] } } } });
      await usePsychProfileStore.getState().fetchFeedbackHistory();
      expect(usePsychProfileStore.getState().feedbackHistory).toEqual([]);
    });
  });

  describe('giveConsent', () => {
    it('成功且有 profile 時應更新 consent_given', async () => {
      usePsychProfileStore.setState({
        profile: { consent_given: false, richness_score: 0, narratives: [], insights: [] } as never,
      });
      mockGiveConsent.mockResolvedValue({});
      await usePsychProfileStore.getState().giveConsent();
      const state = usePsychProfileStore.getState();
      expect(state.profile?.consent_given).toBe(true);
      expect(state.profile?.consent_at).toBeDefined();
      expect(state.consentLoading).toBe(false);
    });

    it('成功且無 profile 時應建立新 profile', async () => {
      mockGiveConsent.mockResolvedValue({});
      await usePsychProfileStore.getState().giveConsent();
      const state = usePsychProfileStore.getState();
      expect(state.profile?.consent_given).toBe(true);
      expect(state.profile?.richness_score).toBe(0);
    });

    it('失敗時應設置 error 並拋出', async () => {
      mockGiveConsent.mockRejectedValue(new Error('consent fail'));
      await expect(usePsychProfileStore.getState().giveConsent()).rejects.toThrow('consent fail');
      expect(usePsychProfileStore.getState().error).toBe('consent fail');
      expect(usePsychProfileStore.getState().consentLoading).toBe(false);
    });
  });

  describe('deleteAllData', () => {
    it('成功時應清空 profile 及 feedbackHistory 並重置 interviewStore', async () => {
      usePsychProfileStore.setState({
        profile: { consent_given: true } as never,
        feedbackHistory: [{ session_id: 's1' }] as never,
      });
      mockDeleteAllData.mockResolvedValue({});
      await usePsychProfileStore.getState().deleteAllData();
      const state = usePsychProfileStore.getState();
      expect(state.profile).toBeNull();
      expect(state.feedbackHistory).toEqual([]);
      expect(mockInterviewReset).toHaveBeenCalledOnce();
    });

    it('失敗時應設置 error 並拋出', async () => {
      mockDeleteAllData.mockRejectedValue(new Error('del fail'));
      await expect(usePsychProfileStore.getState().deleteAllData()).rejects.toThrow('del fail');
      expect(usePsychProfileStore.getState().error).toBe('del fail');
    });
  });

  describe('reset', () => {
    it('應還原所有狀態', () => {
      usePsychProfileStore.setState({
        profile: { consent_given: true } as never,
        feedbackHistory: [{ session_id: 's1' }] as never,
        loading: true,
        error: 'some-error',
        consentLoading: true,
      });
      usePsychProfileStore.getState().reset();
      const state = usePsychProfileStore.getState();
      expect(state.profile).toBeNull();
      expect(state.feedbackHistory).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.consentLoading).toBe(false);
    });
  });
});
