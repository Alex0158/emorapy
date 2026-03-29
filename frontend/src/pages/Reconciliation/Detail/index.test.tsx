/**
 * Reconciliation Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetPlanById = vi.fn();
const mockGetPlans = vi.fn();
const mockSelectPlan = vi.fn();
const mockConfirmExecution = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/reconciliation', () => ({
  getPlanById: (...args: unknown[]) => mockGetPlanById(...args),
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
}));
vi.mock('@/services/api/execution', () => ({
  confirmExecution: (...args: unknown[]) => mockConfirmExecution(...args),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

import ReconciliationDetail from './index';

const mockPlan = {
  id: 'plan-1',
  judgment_id: 'j1',
  plan_content: '方案一內容',
  plan_type: 'activity' as const,
  difficulty_level: 'easy' as const,
  time_cost: 2,
  money_cost: 1,
  emotion_cost: 3,
  skill_requirement: 2,
  user1_selected: false,
  user2_selected: false,
  created_at: '2025-01-01T00:00:00Z',
};

function renderPage(judgmentId = 'j1', id = 'plan-1') {
  return render(
    <MemoryRouter initialEntries={[`/reconciliation/${judgmentId}/${id}`]}>
      <Routes>
        <Route path="/reconciliation/:judgmentId/:id" element={<ReconciliationDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReconciliationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanById.mockResolvedValue(mockPlan);
  });

  it('掛載時應呼叫 getPlanById', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
    });
  });

  it('getPlanById 回傳 plan 的 plan_content 為 null 時應不崩潰並顯示方案詳情（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    const planWithNullContent = { ...mockPlan, plan_content: null as unknown as string };
    mockGetPlanById.mockResolvedValueOnce(planWithNullContent);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
    });
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    expect(screen.getByText('reconDetail.back')).toBeInTheDocument();
  });

  it('getPlanById 回傳 plan 的 time_cost/money_cost/emotion_cost 為 undefined 時應不崩潰並顯示方案詳情（F05 邊界：API 回傳不完整時防禦）', async () => {
    const planWithUndefinedCosts = {
      ...mockPlan,
      time_cost: undefined as unknown as number,
      money_cost: undefined as unknown as number,
      emotion_cost: undefined as unknown as number,
    };
    mockGetPlanById.mockResolvedValueOnce(planWithUndefinedCosts);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
    });
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    expect(screen.getByText('reconDetail.back')).toBeInTheDocument();
  });

  it('getPlanById 失敗時應 fallback 到 getPlans', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockResolvedValue([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1');
    });
  });

  it('getPlanById 與 getPlans 皆失敗時應顯示 getPlanDetailFail', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlanDetailFail');
    });
    expect(await screen.findByText('message.getPlanDetailFail')).toBeInTheDocument();
  });

  it('getPlanById 與 getPlans 皆失敗時應仍可點擊返回或 retry（F05 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.planNotFound')).toBeInTheDocument();
    });
    const backBtn = screen.getByText('reconDetail.back');
    const retryBtn = screen.getByRole('button', { name: 'common.retry' });
    expect(backBtn).toBeInTheDocument();
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('getPlanById 與 getPlans 皆失敗時應仍可點擊返回判決導向 /judgment/:judgmentId（F05-OPT-002 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue(new Error('網絡錯誤'));
    renderPage('j1', 'plan-1');
    await waitFor(() => {
      expect(screen.getByText('message.planNotFound')).toBeInTheDocument();
    });
    const backToJudgmentBtn = screen.getByRole('button', { name: 'reconList.backToJudgment' });
    expect(backToJudgmentBtn).toBeInTheDocument();
    fireEvent.click(backToJudgmentBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/judgment/j1');
  });

  it('getPlanById 與 getPlans 皆失敗時點擊 retry 應重新呼叫 fetchPlan（F05 重試分支）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans
      .mockRejectedValueOnce({ code: 'UNKNOWN' })
      .mockResolvedValueOnce([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.planNotFound')).toBeInTheDocument();
    });
    expect(mockGetPlanById).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
  });

  it('getPlanById 與 getPlans 皆失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示方案詳情（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce([mockPlan]);
    renderPage();
    await waitFor(() => expect(screen.getByText('message.planNotFound')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('第二次仍失敗'));
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledTimes(3);
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
  });

  it('getPlanById 與 getPlans 皆失敗時 retry 再次失敗應顯示該次錯誤訊息（F05 重試錯誤反饋）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockRejectedValueOnce(new Error('重試時服務不可用'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.planNotFound')).toBeInTheDocument();
    });
    expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    mockMessageError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試時服務不可用');
    });
  });

  it('getPlanById 與 getPlans 皆失敗時 retry 再次失敗且 message 為空字串應使用 getPlanDetailFail（F10 邊界）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans
      .mockRejectedValueOnce(new Error('初次失敗'))
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.planNotFound')).toBeInTheDocument();
    });
    mockMessageError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlanDetailFail');
    });
  });

  it('getPlanById 與 getPlans 皆失敗時 retry 快速連點只會送出一次 fetchPlan 請求（F05 重試節流）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    let resolveGetPlans: (value: unknown) => void;
    const getPlansPromise = new Promise((resolve) => { resolveGetPlans = resolve; });
    mockGetPlans
      .mockRejectedValueOnce({ code: 'UNKNOWN' })
      .mockImplementation(() => getPlansPromise);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.planNotFound')).toBeInTheDocument();
    });
    expect(mockGetPlanById).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByRole('button', { name: 'common.retry' });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    expect(mockGetPlanById).toHaveBeenCalledTimes(2); // 僅多一次，連點被防護（F05 重試節流）
    resolveGetPlans!([mockPlan]);
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
  });

  it('getPlanById 失敗且 getPlans 失敗且 message 為空字串時應使用 getPlanDetailFail（F10 邊界：空 message 視為無）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlanDetailFail');
    });
  });

  it('getPlanById 失敗且 getPlans 失敗但有 message 時應顯示該 message', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '伺服器暫時錯誤' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('伺服器暫時錯誤');
    });
    expect(screen.getByText('伺服器暫時錯誤')).toBeInTheDocument();
  });

  it('getPlanById 失敗且 getPlans FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看此判決的和好方案' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('無權限查看此判決的和好方案');
    });
    expect(screen.getByText('無權限查看此判決的和好方案')).toBeInTheDocument();
  });

  it('getPlanById 失敗且 getPlans FORBIDDEN 且無 message 時應使用 getPlanDetailFail（F05 權限邊界 fallback：fetchPlan 雙 API 皆失敗）', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlanDetailFail');
    });
  });

  it('方案不存在時應顯示 planNotFound', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.planNotFound');
    });
  });

  it('方案載入成功後應顯示方案詳情', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
  });

  it('方案已選（user1_selected 或 user2_selected）時不應顯示選擇方案按鈕，應顯示開始執行按鈕（F05 業務規則：已選不可重選，與 List 對齊）', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
      expect(screen.queryByText('reconDetail.selectThisPlan')).not.toBeInTheDocument();
    });
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: false, user2_selected: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
      expect(screen.queryByText('reconDetail.selectThisPlan')).not.toBeInTheDocument();
    });
  });

  it('selectPlan 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveSelect: (v: unknown) => void;
    mockSelectPlan.mockImplementation(
      () => new Promise((resolve) => { resolveSelect = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('plan-1');
    });
    unmount();
    resolveSelect!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('selectPlan 失敗但組件已卸載時不應呼叫 message.error（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    let rejectSelect: (reason?: unknown) => void;
    mockSelectPlan.mockImplementation(
      () => new Promise((_, reject) => { rejectSelect = reject; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('plan-1');
    });
    unmount();
    await act(async () => {
      rejectSelect!(new Error('選擇失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('confirmExecution 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    let resolveConfirm: (v: unknown) => void;
    mockConfirmExecution.mockImplementation(
      () => new Promise((resolve) => { resolveConfirm = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    await waitFor(() => {
      expect(mockConfirmExecution).toHaveBeenCalledWith('plan-1');
    });
    unmount();
    resolveConfirm!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('confirmExecution 失敗但組件已卸載時不應呼叫 message.error 或 navigate（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    let rejectConfirm: (reason?: unknown) => void;
    mockConfirmExecution.mockImplementation(
      () => new Promise((_, reject) => { rejectConfirm = reject; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    await waitFor(() => {
      expect(mockConfirmExecution).toHaveBeenCalledWith('plan-1');
    });
    unmount();
    await act(async () => {
      rejectConfirm!(new Error('啟動執行失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handleSelect: 點擊選擇方案應呼叫 selectPlan', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('plan-1');
    });
  });

  it('handleSelect: 快速連點只會送出一次 selectPlan 請求', async () => {
    mockSelectPlan.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(undefined), 100)));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ });
    await act(async () => {
      btn.click();
      btn.click();
      btn.click();
    });
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledTimes(1);
    });
  });

  it('handleSelect: selectPlan 失敗且無 message 時應顯示 selectPlanFail', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.selectPlanFail');
    });
  });

  it('handleSelect: selectPlan 失敗且 message 為空字串時應使用 selectPlanFail（F10 邊界）', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'CONFLICT', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.selectPlanFail');
    });
  });

  it('handleSelect: selectPlan 失敗後應仍可再次點擊選擇方案，成功後應顯示成功並重新拉取（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockSelectPlan
      .mockRejectedValueOnce(new Error('服務暫時不可用'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ });
    await act(async () => { btn.click(); });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('服務暫時不可用');
    });
    await act(async () => { btn.click(); });
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.selectPlanSuccess');
    });
    expect(mockGetPlanById.mock.calls.length).toBeGreaterThanOrEqual(2); // 初載 + 成功後 fetchPlan 重新拉取
  });

  it('handleSelect: selectPlan 失敗但有 message 時應顯示該 message', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'CONFLICT', message: '方案已被選擇' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('方案已被選擇');
    });
  });

  it('handleStartExecution: 方案已選擇時點擊開始執行應呼叫 confirmExecution', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => expect(mockConfirmExecution).toHaveBeenCalledWith('plan-1'));
  });

  it('handleStartExecution: confirmExecution 失敗且無 message 時應顯示 startExecutionFail', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.startExecutionFail');
    });
  });

  it('handleStartExecution: confirmExecution 失敗且 message 為空字串時應使用 startExecutionFail（F10 邊界）', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.startExecutionFail');
    });
  });

  it('handleStartExecution: confirmExecution 失敗但有 message 時應顯示該 message', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution.mockRejectedValue({ code: 'FORBIDDEN', message: '執行已開始' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('執行已開始');
    });
  });

  it('handleStartExecution: confirmExecution FORBIDDEN 且無 message 時應使用 startExecutionFail（F05 權限邊界 fallback）', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.startExecutionFail');
    });
  });

  it('confirmExecution 失敗後應仍可再次點擊開始執行，成功後應導向 checkin（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution
      .mockRejectedValueOnce(new Error('暫時無法啟動執行'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /reconDetail\.startExecution/ });
    await act(async () => { btn.click(); });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法啟動執行');
    });
    await act(async () => { btn.click(); });
    await waitFor(() => {
      expect(mockConfirmExecution).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.startExecutionSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-1/checkin');
    });
  });

  it('handleSelect: selectPlan 成功時應顯示 message.selectPlanSuccess 並重新拉取方案', async () => {
    mockSelectPlan.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    expect(mockGetPlanById).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.selectPlanSuccess');
    });
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledTimes(2);
    });
  });

  it('selectPlan 成功後 fetchPlan 失敗應保留 plan 並顯示錯誤提示，不應顯示 planNotFound（F05 刷新失敗不覆蓋成功）', async () => {
    mockGetPlanById
      .mockResolvedValueOnce(mockPlan)
      .mockRejectedValueOnce(new Error('網絡錯誤'));
    mockGetPlans.mockRejectedValue(new Error('fallback 也失敗'));
    mockSelectPlan.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.selectPlanSuccess');
    });
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('fallback 也失敗');
    });
    expect(screen.queryByText('message.planNotFound')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ })).toBeInTheDocument();
    });
  });

  it('handleSelect: selectPlan FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'FORBIDDEN', message: '此方案已被他人選擇' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此方案已被他人選擇');
    });
  });

  it('handleSelect: selectPlan FORBIDDEN 且無 message 時應使用 selectPlanFail（F05 權限邊界 fallback）', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.selectPlanFail');
    });
  });

  it('handleStartExecution: confirmExecution 成功時應顯示 message.startExecutionSuccess 並導向 checkin', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.startExecutionSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-1/checkin');
    });
  });

  it('handleStartExecution: confirmExecution 快速連點只會送出一次請求', async () => {
    let resolveConfirm: (v: unknown) => void;
    const confirmPromise = new Promise((resolve) => { resolveConfirm = resolve; });
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    mockConfirmExecution.mockReturnValue(confirmPromise);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /reconDetail\.startExecution/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockConfirmExecution).toHaveBeenCalledTimes(1);
    });
    resolveConfirm!(undefined);
  });

  it('點擊返回按鈕應呼叫 navigate(-1)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.back/ }).click();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
