/**
 * 心理畫像 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { psychProfileApi } from './psychProfile';

const mockGetProfile = vi.fn();
const mockGetFeedbackHistory = vi.fn();
const mockGiveConsent = vi.fn();
const mockDeleteAllData = vi.fn();

vi.mock('../request', () => ({
  default: { __request: true },
}));

vi.mock('@cj/api-client', () => ({
  createM2ApiClient: (http: unknown) => {
    expect(http).toEqual({ __request: true });
    return {
      psychProfile: {
        getProfile: (...args: unknown[]) => mockGetProfile(...args),
        getFeedbackHistory: (...args: unknown[]) => mockGetFeedbackHistory(...args),
        giveConsent: (...args: unknown[]) => mockGiveConsent(...args),
        deleteAllData: (...args: unknown[]) => mockDeleteAllData(...args),
      },
    };
  },
}));

describe('psychProfileApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getProfile 應 GET /psych-profile', async () => {
    mockGetProfile.mockResolvedValue({ consent_given: true });
    const res = await psychProfileApi.getProfile();
    expect(mockGetProfile).toHaveBeenCalledWith();
    expect(res.consent_given).toBe(true);
  });

  it('getProfile shared client 回傳 null 時應正常返回不拋錯（F06 邊界：API 回傳不完整時由 store 防禦）', async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await psychProfileApi.getProfile();
    expect(res).toBeNull();
  });

  it('getFeedbackHistory 應透過 shared client 讀取 feedback history', async () => {
    mockGetFeedbackHistory.mockResolvedValue({ history: [] });
    await psychProfileApi.getFeedbackHistory();
    expect(mockGetFeedbackHistory).toHaveBeenCalledWith();
  });

  it('getFeedbackHistory shared client 回傳空 history 時應正常返回', async () => {
    mockGetFeedbackHistory.mockResolvedValue({ history: [] });
    const res = await psychProfileApi.getFeedbackHistory();
    expect(res.history).toEqual([]);
  });

  it('giveConsent 應透過 shared client 提交 consent', async () => {
    mockGiveConsent.mockResolvedValue(undefined);
    await psychProfileApi.giveConsent();
    expect(mockGiveConsent).toHaveBeenCalledWith();
  });

  it('deleteAllData 應透過 shared client 刪除資料', async () => {
    mockDeleteAllData.mockResolvedValue(undefined);
    await psychProfileApi.deleteAllData();
    expect(mockDeleteAllData).toHaveBeenCalledWith();
  });
});
