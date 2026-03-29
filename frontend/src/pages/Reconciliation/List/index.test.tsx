/**
 * Reconciliation List 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetPlans = vi.fn();
const mockSelectPlan = vi.fn();
const mockGeneratePlans = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/reconciliation', () => ({
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
  generatePlans: (...args: unknown[]) => mockGeneratePlans(...args),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <span data-testid="mediator-avatar">MediatorAvatar</span> }));
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

import ReconciliationList from './index';

const mockPlan = {
  id: 'p1',
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

function renderPage(judgmentId = 'j1') {
  return render(
    <MemoryRouter initialEntries={[`/reconciliation/${judgmentId}`]}>
      <Routes>
        <Route path="/reconciliation/:judgmentId" element={<ReconciliationList />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReconciliationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlans.mockResolvedValue([mockPlan]);
  });

  it('掛載時應呼叫 getPlans', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1', {});
    });
  });

  it('空列表時應顯示空狀態與生成按鈕', async () => {
    mockGetPlans.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
    });
    expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
  });

  it('getPlans NOT_FOUND 時應設空列表', async () => {
    mockGetPlans.mockRejectedValue({ code: 'NOT_FOUND', message: 'Not found' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('getPlans NOT_FOUND 時應顯示空狀態並可點擊生成方案，generatePlans 成功後應顯示方案列表（F05 錯誤恢復：NOT_FOUND 不阻塞生成入口）', async () => {
    mockGetPlans.mockRejectedValue({ code: 'NOT_FOUND' });
    mockGeneratePlans.mockResolvedValue([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1');
    });
    await waitFor(() => {
      expect(screen.queryByText('reconList.empty')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '方案一內容' })).toBeInTheDocument();
    });
  });

  it('getPlans 其他錯誤時應顯示 message.error', async () => {
    mockGetPlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '伺服器錯誤' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('伺服器錯誤');
    });
  });

  it('getPlans 錯誤且無 message 時應使用 getPlansFail', async () => {
    mockGetPlans.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlansFail');
    });
  });

  it('getPlans 錯誤且 message 為空字串時應使用 getPlansFail（F10 邊界：空 message 視為無）', async () => {
    mockGetPlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlansFail');
    });
  });

  it('getPlans FORBIDDEN 且無 message 時應使用 getPlansFail（F05 權限邊界 fallback）', async () => {
    mockGetPlans.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlansFail');
    });
  });

  it('getPlans FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockGetPlans.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看此判決的和好方案' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('無權限查看此判決的和好方案');
    });
  });

  it('getPlans 回傳 plan 的 plan_content 為 null 時應不崩潰並顯示方案卡片（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    const planWithNullContent = { ...mockPlan, plan_content: null as unknown as string };
    mockGetPlans.mockResolvedValue([planWithNullContent]);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1', {});
    });
    await waitFor(() => {
      expect(screen.getByText('reconList.viewDetail')).toBeInTheDocument();
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 4, name: 'reconList.heading' })).toBeInTheDocument();
  });

  it('getPlans 回傳 undefined 時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetPlans.mockResolvedValue(undefined as unknown as typeof mockPlan[]);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1', {});
    });
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
  });

  it('getPlans 失敗時應仍可點擊返回判決導向 /judgment/:judgmentId（F05 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetPlans.mockRejectedValue(new Error('網絡錯誤'));
    renderPage('judgment-abc');
    await waitFor(() => {
      expect(screen.getByText('網絡錯誤')).toBeInTheDocument();
    });
    const backBtn = screen.getByTestId('recon-list-back-judgment');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/judgment/judgment-abc');
  });

  it('getPlans 失敗時應仍可點擊 retry 重新呼叫 getPlans，成功後應顯示方案列表（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPlans
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '暫時不可用' })
      .mockResolvedValueOnce([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('暫時不可用')).toBeInTheDocument();
    });
    expect(mockGetPlans).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('recon-list-load-retry'));
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { name: '方案一內容' })).toBeInTheDocument();
    });
  });

  it('getPlans 失敗時 retry 快速連點只會送出一次 getPlans 請求（F05 重試節流）', async () => {
    let resolveFetch: (v: unknown) => void;
    mockGetPlans
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '暫時不可用' })
      .mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('暫時不可用')).toBeInTheDocument();
    });
    expect(mockGetPlans).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByTestId('recon-list-load-retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledTimes(2);
    });
    resolveFetch!([mockPlan]);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '方案一內容' })).toBeInTheDocument();
    });
  });

  it('getPlans 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示方案列表（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPlans
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '第一次失敗' })
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '第二次仍失敗' })
      .mockResolvedValueOnce([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('第一次失敗')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('recon-list-load-retry'));
    await waitFor(() => {
      expect(screen.getByText('第二次仍失敗')).toBeInTheDocument();
    });
    expect(mockGetPlans).toHaveBeenCalledTimes(2);
    const retryBtn = screen.getByTestId('recon-list-load-retry');
    await waitFor(() => {
      expect(retryBtn.closest('button')).not.toHaveClass('ant-btn-loading');
    });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('heading', { name: '方案一內容' })).toBeInTheDocument();
    });
  });

  it('getPlans 失敗時應仍可點擊生成方案按鈕，generatePlans 成功後應顯示方案列表（F05 錯誤恢復：失敗不阻塞生成入口）', async () => {
    mockGetPlans.mockRejectedValue({ code: 'SERVER_ERROR' });
    const generated = [mockPlan];
    mockGeneratePlans.mockResolvedValue(generated);
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getPlansFail');
    });
    const generateBtn = await screen.findByText('reconList.generatePlans');
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1');
    });
    await waitFor(() => {
      expect(screen.queryByText('reconList.empty')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '方案一內容' })).toBeInTheDocument();
    });
  });

  it('generatePlans 成功但組件已卸載時不應呼叫 message.success 或 setPlans（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockGetPlans.mockResolvedValue([]);
    let resolveGenerate: (v: unknown) => void;
    mockGeneratePlans.mockImplementation(
      () => new Promise((resolve) => { resolveGenerate = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1');
    });
    unmount();
    resolveGenerate!([mockPlan]);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('generatePlans 失敗但組件已卸載時不應呼叫 message.error（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    mockGetPlans.mockResolvedValue([]);
    let rejectGenerate: (reason?: unknown) => void;
    mockGeneratePlans.mockImplementation(
      () => new Promise((_, reject) => { rejectGenerate = reject; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1');
    });
    unmount();
    await act(async () => {
      rejectGenerate!(new Error('生成失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('selectPlan 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveSelect: (v: unknown) => void;
    mockSelectPlan.mockImplementation(
      () => new Promise((resolve) => { resolveSelect = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('p1');
    });
    unmount();
    resolveSelect!(mockPlan);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('selectPlan 失敗但組件已卸載時不應呼叫 message.error 或 navigate（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    let rejectSelect: (reason?: unknown) => void;
    mockSelectPlan.mockImplementation(
      () => new Promise((_, reject) => { rejectSelect = reject; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('p1');
    });
    unmount();
    await act(async () => {
      rejectSelect!(new Error('選擇失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('空列表時 generatePlans 成功應顯示 generatePlansSuccessCount 並顯示方案列表（F05 主流程）', async () => {
    mockGetPlans.mockResolvedValue([]);
    const generated = [mockPlan, { ...mockPlan, id: 'p2', plan_content: '方案二內容' }];
    mockGeneratePlans.mockResolvedValue(generated);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/message\.generatePlansSuccessCount/)
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('reconList.empty')).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
  });

  it('generatePlans 回傳 undefined 時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockResolvedValue(undefined as unknown);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
    });
  });

  it('generatePlans 回傳非陣列時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockResolvedValue({ plans: [] } as unknown);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
    });
  });

  it('空列表時點擊生成方案後 generatePlans 失敗時應顯示錯誤', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockRejectedValue(new Error('生成失敗'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('生成失敗');
    });
  });

  it('空列表時 generatePlans 失敗且無 message 時應使用 message.generatePlansFail', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.generatePlansFail');
    });
  });

  it('空列表時 generatePlans 失敗且 message 為空字串時應使用 message.generatePlansFail（F10 邊界）', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.generatePlansFail');
    });
  });

  it('空列表時 generatePlans FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限為此判決生成和好方案' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('無權限為此判決生成和好方案');
    });
  });

  it('空列表時 generatePlans FORBIDDEN 且無 message 時應使用 generatePlansFail（F05 權限邊界 fallback）', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.generatePlansFail');
    });
  });

  it('generatePlans 失敗後應仍可再次點擊生成方案，成功後應顯示方案列表（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPlans.mockResolvedValue([]);
    mockGeneratePlans
      .mockRejectedValueOnce(new Error('暫時無法生成'))
      .mockResolvedValueOnce([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法生成');
    });
    fireEvent.click(screen.getByText('reconList.generatePlans'));
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledTimes(2);
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
  });

  it('selectPlan 成功時應顯示 selectPlanSuccess 並導向方案詳情頁（F05 主流程）', async () => {
    mockSelectPlan.mockResolvedValue(mockPlan);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.selectPlanSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/reconciliation/j1/p1');
    });
  });

  it('方案已選（user1_selected）時選擇方案按鈕應 disabled 且點擊不應呼叫 selectPlan（F05 業務規則：已選不可重選）', async () => {
    mockGetPlans.mockResolvedValue([{ ...mockPlan, user1_selected: true }]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    const selectBtn = screen.getByRole('button', { name: 'reconList.planSelectedAria' });
    expect(selectBtn).toBeDisabled();
    fireEvent.click(selectBtn);
    expect(mockSelectPlan).not.toHaveBeenCalled();
  });

  it('方案已由對方選（user2_selected）時選擇方案按鈕應 disabled 且點擊不應呼叫 selectPlan（F05 業務規則：對方已選不可再選）', async () => {
    mockGetPlans.mockResolvedValue([{ ...mockPlan, user2_selected: true }]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    const selectBtn = screen.getByRole('button', { name: 'reconList.planSelectedAria' });
    expect(selectBtn).toBeDisabled();
    fireEvent.click(selectBtn);
    expect(mockSelectPlan).not.toHaveBeenCalled();
  });

  it('選擇方案後 selectPlan 失敗時應顯示錯誤', async () => {
    mockSelectPlan.mockRejectedValue(new Error('選擇失敗'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('選擇失敗');
    });
  });

  it('selectPlan 失敗且無 message 時應使用 message.selectPlanFail', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.selectPlanFail');
    });
  });

  it('selectPlan 失敗且 message 為空字串時應使用 message.selectPlanFail（F10 邊界）', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'CONFLICT', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.selectPlanFail');
    });
  });

  it('selectPlan FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockSelectPlan.mockRejectedValue({ code: 'FORBIDDEN', message: '此方案已被他人選擇' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此方案已被他人選擇');
    });
  });

  it('selectPlan 失敗後應仍可再次點擊選擇方案，成功後應導向詳情頁（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockSelectPlan
      .mockRejectedValueOnce(new Error('暫時無法選擇'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法選擇');
    });
    fireEvent.click(screen.getByText('reconList.selectPlan'));
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.selectPlanSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/reconciliation/j1/p1');
    });
  });

  it('handleGeneratePlans 快速連點只會送出一次 generatePlans 請求', async () => {
    mockGetPlans.mockResolvedValue([]);
    let resolveGen: (v: unknown) => void;
    const genPromise = new Promise((resolve) => { resolveGen = resolve; });
    mockGeneratePlans.mockImplementation(() => genPromise as Promise<unknown>);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
    });
    const btn = screen.getByText('reconList.generatePlans');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolveGen!([mockPlan]);
      await Promise.resolve();
    });
  });

  it('handleSelectPlan 快速連點只會送出一次 selectPlan 請求', async () => {
    let resolveSel: (v: unknown) => void;
    const selPromise = new Promise((resolve) => { resolveSel = resolve; });
    mockSelectPlan.mockImplementation(() => selPromise as Promise<unknown>);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.selectPlan')).toBeInTheDocument();
    });
    const btn = screen.getByText('reconList.selectPlan');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolveSel!(mockPlan);
      await Promise.resolve();
    });
  });

  it('點擊查看詳情應導向方案詳情頁（F05 列表→詳情導航）', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.viewDetail')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('reconList.viewDetail'));
    expect(mockNavigate).toHaveBeenCalledWith('/reconciliation/j1/p1');
  });

  it('getPlans 失敗後變更難度篩選應重新呼叫 getPlans，成功後應顯示方案列表（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    const user = userEvent.setup();
    mockGetPlans
      .mockRejectedValueOnce(new Error('服務暫時不可用'))
      .mockResolvedValueOnce([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('服務暫時不可用');
    });
    expect(mockGetPlans).toHaveBeenCalledTimes(1);
    const difficultySelect = screen.getByRole('combobox', { name: 'reconList.ariaDifficultyFilter' });
    await user.click(difficultySelect);
    const mediumOption = await screen.findByText('reconList.difficultyMedium');
    await user.click(mediumOption);
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledTimes(2);
      expect(mockGetPlans).toHaveBeenLastCalledWith('j1', { difficulty: 'medium' });
      expect(screen.getByRole('heading', { name: '方案一內容' })).toBeInTheDocument();
    });
  });

  it('變更難度篩選時應以新參數重新調用 getPlans', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1', {});
    });
    const difficultySelect = screen.getByRole('combobox', { name: 'reconList.ariaDifficultyFilter' });
    await user.click(difficultySelect);
    const mediumOption = await screen.findByText('reconList.difficultyMedium');
    await user.click(mediumOption);
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenLastCalledWith('j1', { difficulty: 'medium' });
    });
  });

  it('變更類型篩選時應以新參數重新調用 getPlans', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalled();
    });
    const typeSelect = screen.getByRole('combobox', { name: 'reconList.ariaTypeFilter' });
    await user.click(typeSelect);
    const communicationOption = await screen.findByText('reconList.typeCommunication');
    await user.click(communicationOption);
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenLastCalledWith('j1', { type: 'communication' });
    });
  });
});
