/**
 * 訪談 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interviewApi } from './interview';

const mockStartSession = vi.fn();
const mockCheckResume = vi.fn();
const mockGetSession = vi.fn();
const mockRespond = vi.fn();
const mockSkip = vi.fn();
const mockCancel = vi.fn();
const mockEndSession = vi.fn();
const mockRetryFailed = vi.fn();

vi.mock('../request', () => ({
  default: { __request: true },
}));

vi.mock('@cj/api-client', () => ({
  createM2ApiClient: (http: unknown) => {
    expect(http).toEqual({ __request: true });
    return {
      interview: {
        startSession: (...args: unknown[]) => mockStartSession(...args),
        checkResume: (...args: unknown[]) => mockCheckResume(...args),
        getSession: (...args: unknown[]) => mockGetSession(...args),
        respond: (...args: unknown[]) => mockRespond(...args),
        skip: (...args: unknown[]) => mockSkip(...args),
        cancel: (...args: unknown[]) => mockCancel(...args),
        endSession: (...args: unknown[]) => mockEndSession(...args),
        retryFailed: (...args: unknown[]) => mockRetryFailed(...args),
      },
    };
  },
}));

describe('interviewApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    it('應以 trigger 參數 POST /interview/start', async () => {
      mockStartSession.mockResolvedValue({ id: 's1' });
      const res = await interviewApi.startSession('organic');
      expect(mockStartSession).toHaveBeenCalledWith('organic');
      expect(res).toEqual({ id: 's1' });
    });

    it('預設 trigger 為 organic', async () => {
      mockStartSession.mockResolvedValue({ id: 's-default' });
      await interviewApi.startSession();
      expect(mockStartSession).toHaveBeenCalledWith('organic');
    });
  });

  describe('checkResume', () => {
    it('應透過 shared client 讀取 resume', async () => {
      mockCheckResume.mockResolvedValue({ has_pending: true, session_id: 's2' });
      const res = await interviewApi.checkResume();
      expect(mockCheckResume).toHaveBeenCalledWith();
      expect(res?.has_pending).toBe(true);
    });

    it('shared client 回傳 null 時應正常返回不拋錯（F06 邊界：API 回傳不完整時由 store 防禦）', async () => {
      mockCheckResume.mockResolvedValue(null);
      const res = await interviewApi.checkResume();
      expect(res).toBeNull();
    });
  });

  describe('getSession', () => {
    it('應透過 shared client 讀取 session', async () => {
      mockGetSession.mockResolvedValue({ id: 's3', status: 'completed' });
      await interviewApi.getSession('s3');
      expect(mockGetSession).toHaveBeenCalledWith('s3');
    });

    it('shared client 回傳 null 時應正常返回不拋錯（F06 邊界：API 回傳不完整時由 store 防禦）', async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await interviewApi.getSession('s1');
      expect(res).toBeNull();
    });
  });

  describe('endSession', () => {
    it('應透過 shared client end session', async () => {
      mockEndSession.mockResolvedValue(undefined);
      await interviewApi.endSession('s4');
      expect(mockEndSession).toHaveBeenCalledWith('s4');
    });
  });

  describe('retryFailed', () => {
    it('應透過 shared client retry failed session', async () => {
      mockRetryFailed.mockResolvedValue(undefined);
      await interviewApi.retryFailed('s5');
      expect(mockRetryFailed).toHaveBeenCalledWith('s5');
    });
  });

  it('respond / skip / cancel 應透過 shared client 保留參數', async () => {
    mockRespond.mockResolvedValue({ accepted: true, session_id: 's6' });
    mockSkip.mockResolvedValue({ accepted: true, session_id: 's6' });
    mockCancel.mockResolvedValue({ cancelled: true, session_id: 's6' });

    await interviewApi.respond('s6', 'hello');
    await interviewApi.skip('s6');
    await interviewApi.cancel('s6');

    expect(mockRespond).toHaveBeenCalledWith('s6', 'hello');
    expect(mockSkip).toHaveBeenCalledWith('s6');
    expect(mockCancel).toHaveBeenCalledWith('s6');
  });
});
