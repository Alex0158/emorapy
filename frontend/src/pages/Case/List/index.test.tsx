/**
 * Case List 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CaseList from './index';

const mockGetCaseList = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();

vi.mock('@/services/api/case', () => ({
  getCaseList: (...args: unknown[]) => mockGetCaseList(...args),
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

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

vi.mock('@/hooks/usePerformance', () => ({
  useDebounce: (fn: () => void) => fn,
}));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('Case List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockMessageError).toHaveBeenCalledWith('獲取失敗');
    });
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
});
