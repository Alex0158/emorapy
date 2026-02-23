/**
 * 心理畫像 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { psychProfileApi } from './psychProfile';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('psychProfileApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getProfile 應 GET /psych-profile', async () => {
    mockGet.mockResolvedValue({ data: { data: { consent_given: true } } });
    const res = await psychProfileApi.getProfile();
    expect(mockGet).toHaveBeenCalledWith('/psych-profile');
    expect(res.data.data.consent_given).toBe(true);
  });

  it('getFeedbackHistory 應 GET /psych-profile/feedback', async () => {
    mockGet.mockResolvedValue({ data: { data: { history: [] } } });
    await psychProfileApi.getFeedbackHistory();
    expect(mockGet).toHaveBeenCalledWith('/psych-profile/feedback');
  });

  it('giveConsent 應 POST /psych-profile/consent', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await psychProfileApi.giveConsent();
    expect(mockPost).toHaveBeenCalledWith('/psych-profile/consent');
  });

  it('deleteAllData 應 DELETE /psych-profile', async () => {
    mockDelete.mockResolvedValue({ data: {} });
    await psychProfileApi.deleteAllData();
    expect(mockDelete).toHaveBeenCalledWith('/psych-profile');
  });
});
