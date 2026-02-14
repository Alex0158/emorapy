/**
 * Case List 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CaseList from './index';

const mockGetCaseList = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/services/api/case', () => ({
  getCaseList: (...args: unknown[]) => mockGetCaseList(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/usePerformance', () => ({
  useDebounce: (fn: () => void) => fn,
}));

describe('Case List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCaseList.mockResolvedValue({
      cases: [],
      pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
    });
  });

  it('應顯示頁面標題「案件列表」', async () => {
    render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('案件列表')).toBeInTheDocument();
    });
  });

  it('應有案件列表頁面 role 與 aria-label', async () => {
    const { container } = render(
      <MemoryRouter>
        <CaseList />
      </MemoryRouter>
    );
    await waitFor(() => {
      const main = container.querySelector('[role="main"][aria-label="案件列表頁面"]');
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
});
