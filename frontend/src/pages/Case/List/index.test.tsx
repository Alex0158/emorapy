/**
 * Case List 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CaseList from './index';

const mockGetCaseList = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/services/api/case', () => ({
  getCaseList: (...args: unknown[]) => mockGetCaseList(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/EmptyState', () => ({
  EmptyState: ({ actionLabel, onAction }: { actionLabel?: string; onAction?: () => void }) => (
    <div>
      <p>caseList.empty</p>
      {actionLabel && onAction && (
        <button onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  ),
}));

vi.mock('@/hooks/usePerformance', () => ({
  useDebounce: (fn: () => void) => fn,
}));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('Case List', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCaseList.mockResolvedValue({
      cases: [],
      pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
    });
  });

  it('應顯示頁面標題「我的案件」', async () => {
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseList.heading')).toBeInTheDocument();
    });
  });

  it('應有案件列表頁面 role 與 aria-label', async () => {
    const { container } = render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      const main = container.querySelector('[role="main"][aria-label="caseList.pageLabel"]');
      expect(main).toBeInTheDocument();
    });
  });

  it('應調用 getCaseList 獲取列表', async () => {
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
  });

  it('getCaseList 錯誤時應處理錯誤', async () => {
    mockGetCaseList.mockRejectedValue(new Error('獲取失敗'));
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('獲取失敗');
    });
  });

  it('getCaseList 錯誤且 message 為空字串時應使用 getCaseListFail（F10 邊界）', async () => {
    mockGetCaseList.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getCaseListFail');
    });
  });

  it('getCaseList 錯誤且無 message 時應使用 getCaseListFail 文案', async () => {
    mockGetCaseList.mockRejectedValue({ code: 'UNKNOWN' });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getCaseListFail');
    });
  });

  it('getCaseList 回傳 cases 為 undefined 時應顯示空狀態不崩潰（F03 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetCaseList.mockResolvedValue({
      cases: undefined,
      pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('caseList.empty')).toBeInTheDocument();
    });
  });

  it('getCaseList 回傳 cases 為非陣列時應顯示空狀態不崩潰（F03 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetCaseList.mockResolvedValue({
      cases: { items: [] } as unknown,
      pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('caseList.empty')).toBeInTheDocument();
    });
  });

  it('getCaseList FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    mockGetCaseList.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看案件列表' });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('無權限查看案件列表');
    });
  });

  it('getCaseList FORBIDDEN 且無 message 時應使用 getCaseListFail（F03 權限邊界 fallback）', async () => {
    mockGetCaseList.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getCaseListFail');
    });
  });

  it('getCaseList 失敗時應仍可點擊 retry 重新呼叫 getCaseList，成功後應顯示案件列表（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCaseList
      .mockRejectedValueOnce(new Error('暫時不可用'))
      .mockResolvedValueOnce({
        cases: [{ id: 'c1', title: 'Retry Case', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('暫時不可用')).toBeInTheDocument();
    });
    expect(mockGetCaseList).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('case-list-load-retry'));
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Retry Case')).toBeInTheDocument();
    });
  });

  it('getCaseList 失敗時 retry 快速連點只會送出一次 getCaseList 請求（F03 重試節流）', async () => {
    let resolveFetch: (v: unknown) => void;
    mockGetCaseList
      .mockRejectedValueOnce(new Error('暫時不可用'))
      .mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));

    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('暫時不可用')).toBeInTheDocument();
    });
    expect(mockGetCaseList).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByTestId('case-list-load-retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalledTimes(2);
    });
    resolveFetch!({
      cases: [{ id: 'c1', title: 'Retry Case', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    await waitFor(() => {
      expect(screen.getByText('Retry Case')).toBeInTheDocument();
    });
  });

  it('getCaseList 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示案件列表（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCaseList
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce({
        cases: [{ id: 'c1', title: 'Retry Case', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('第一次失敗')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('case-list-load-retry'));
    await waitFor(() => {
      expect(screen.getByText('第二次仍失敗')).toBeInTheDocument();
    });
    expect(mockGetCaseList).toHaveBeenCalledTimes(2);
    const retryBtn = screen.getByTestId('case-list-load-retry');
    await waitFor(() => {
      expect(retryBtn).not.toBeDisabled();
    });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Retry Case')).toBeInTheDocument();
    });
  });

  it('getCaseList 失敗後變更狀態篩選應重新呼叫 getCaseList，成功後應顯示案件列表（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    const user = userEvent.setup();
    mockGetCaseList
      .mockRejectedValueOnce(new Error('網絡暫時不穩'))
      .mockResolvedValueOnce({
        cases: [{ id: 'c1', title: 'Retry Case', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('網絡暫時不穩')).toBeInTheDocument();
    });
    expect(mockGetCaseList).toHaveBeenCalledTimes(1);
    const statusFilterSelect = screen.getByRole('combobox', { name: 'caseList.ariaStatusFilter' });
    await user.click(statusFilterSelect);
    const draftOption = await screen.findByRole('option', { name: 'caseList.statusDraft' });
    await user.click(draftOption);
    await waitFor(
      () => {
        expect(mockGetCaseList).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Retry Case')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('getCaseList 失敗時應仍可點擊建立案件按鈕並導向 /case/create（F03 錯誤恢復：失敗不阻塞建立入口）', async () => {
    const user = userEvent.setup();
    mockGetCaseList.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(screen.getByTestId('case-list-load-retry')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const createBtn = await screen.findByRole('button', { name: 'caseList.createNew' });
    await user.click(createBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/create');
  });

  it('空列表時應顯示 Empty 與 createFirst 按鈕，點擊應導向 /case/create（F03 主流程）', async () => {
    mockGetCaseList.mockResolvedValue({
      cases: [],
      pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseList.empty')).toBeInTheDocument();
    });
    const createBtn = screen.getByText('caseList.createFirst');
    expect(createBtn).toBeInTheDocument();
    await user.click(createBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/create');
  });

  it('非空列表時應顯示案件標題', async () => {
    mockGetCaseList.mockResolvedValue({
      cases: [
        {
          id: 'c1',
          title: 'Test Case',
          status: 'draft',
          type: '生活習慣衝突',
          created_at: '2025-01-01',
        },
      ],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Test Case')).toBeInTheDocument();
    });
  });

  it('變更狀態篩選時應以新參數重新調用 getCaseList', async () => {
    const user = userEvent.setup();
    mockGetCaseList.mockResolvedValue({
      cases: [{ id: 'c1', title: 'Case 1', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
    const statusFilterSelect = screen.getByRole('combobox', { name: 'caseList.ariaStatusFilter' });
    await user.click(statusFilterSelect);
    const draftOption = await screen.findByRole('option', { name: 'caseList.statusDraft' });
    await user.click(draftOption);
    await waitFor(
      () => {
        expect(mockGetCaseList).toHaveBeenLastCalledWith(
          expect.objectContaining({ status: 'draft', page: 1 })
        );
      },
      { timeout: 3000 }
    );
  });

  it('變更類型篩選時應以新參數重新調用 getCaseList', async () => {
    const user = userEvent.setup();
    mockGetCaseList.mockResolvedValue({
      cases: [{ id: 'c1', title: 'Case 1', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
    const typeFilterSelect = screen.getByRole('combobox', { name: 'caseList.ariaTypeFilter' });
    await user.click(typeFilterSelect);
    const lifeOption = await screen.findByRole('option', { name: 'caseList.typeLife' });
    await user.click(lifeOption);
    await waitFor(
      () => {
        expect(mockGetCaseList).toHaveBeenLastCalledWith(
          expect.objectContaining({ type: '生活習慣衝突', page: 1 })
        );
      },
      { timeout: 3000 }
    );
  });

  it('變更排序時應以新參數重新調用 getCaseList', async () => {
    const user = userEvent.setup();
    mockGetCaseList.mockResolvedValue({
      cases: [{ id: 'c1', title: 'Case 1', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
    const sortSelect = screen.getByRole('combobox', { name: 'caseList.ariaSort' });
    await user.click(sortSelect);
    const oldestOption = await screen.findByRole('option', { name: 'caseList.sortOldest' });
    await user.click(oldestOption);
    await waitFor(
      () => {
        expect(mockGetCaseList).toHaveBeenCalledWith(
          expect.objectContaining({ sort_by: 'created_at', sort_order: 'asc' })
        );
      },
      { timeout: 3000 }
    );
  });

  it('變更搜尋時應以新參數重新調用 getCaseList', async () => {
    const user = userEvent.setup();
    mockGetCaseList.mockResolvedValue({
      cases: [{ id: 'c1', title: 'Case 1', status: 'draft', type: '生活習慣衝突', created_at: '2025-01-01' }],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalled();
    });
    const searchInput = screen.getByRole('textbox', { name: 'caseList.ariaSearch' });
    await user.type(searchInput, 'test');
    await waitFor(() => {
      expect(mockGetCaseList).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' })
      );
    });
  });

  it('點擊案件卡片應導向案件詳情', async () => {
    const user = userEvent.setup();
    mockGetCaseList.mockResolvedValue({
      cases: [
        {
          id: 'c1',
          title: 'Test Case',
          status: 'draft',
          type: '生活習慣衝突',
          created_at: '2025-01-01',
        },
      ],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Test Case')).toBeInTheDocument();
    });
    const row = screen.getByText('Test Case').closest('button');
    expect(row).toBeTruthy();
    await user.click(row!);
    expect(mockNavigate).toHaveBeenCalledWith('/case/c1');
  });

  describe('分頁', () => {
    // page 1: Case 1–10（共 10 筆）；page 2: Case 11–12（共 2 筆），總計 12 筆
    const casesPage1 = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i + 1}`,
      title: `Case ${i + 1}`,
      status: 'draft',
      type: '生活習慣衝突',
      created_at: '2025-01-01',
    }));
    const casesPage2 = Array.from({ length: 2 }, (_, i) => ({
      id: `c${11 + i}`,
      title: `Case ${11 + i}`,
      status: 'draft',
      type: '生活習慣衝突',
      created_at: '2025-01-01',
    }));

    beforeEach(() => {
      mockGetCaseList.mockImplementation((params: { page?: number }) => {
        const page = params?.page ?? 1;
        const cases = page === 1 ? casesPage1 : casesPage2;
        return Promise.resolve({
          cases,
          pagination: { page, page_size: 10, total: 12, total_pages: 2 },
        });
      });
    });

    it('分頁變更時應以新參數重新調用 getCaseList', async () => {
      render(
        <MemoryRouter>
          <CaseList />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Case 1')).toBeInTheDocument();
      });
      // The new pagination uses a "next" button rendered by shadcn Button
      const nextBtn = screen.getByRole('button', { name: 'common.next' });
      fireEvent.click(nextBtn);
      await waitFor(
        () => {
          expect(mockGetCaseList).toHaveBeenCalledWith(
            expect.objectContaining({ page: 2, page_size: 10 })
          );
        },
        { timeout: 3000 }
      );
    });
  });
});
