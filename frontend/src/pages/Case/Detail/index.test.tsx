/**
 * Case Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetCase = vi.fn();
const mockSubmitCase = vi.fn();
const mockUpdateCase = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/case', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
  submitCase: (...args: unknown[]) => mockSubmitCase(...args),
  updateCase: (...args: unknown[]) => mockUpdateCase(...args),
}));
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: vi.fn(),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', email: 'test@example.com' } }),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/StatementInput', () => ({
  default: () => <div data-testid="statement-input" />,
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

import CaseDetail from './index';

const mockCase = {
  id: 'c1',
  pairing_id: 'p1',
  title: 'Test',
  type: '生活習慣衝突',
  status: 'draft' as const,
  mode: 'quick' as const,
  plaintiff_id: 'u1',
  plaintiff_statement: '原告陳述',
  defendant_statement: '',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function renderPage(id = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/case/${id}`]}>
      <Routes>
        <Route path="/case/:id" element={<CaseDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CaseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCase.mockResolvedValue(mockCase);
  });

  it('掛載時應呼叫 getCase 並顯示案件資訊', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledWith('c1');
    });
  });

  it('loading 時應顯示 loading', () => {
    mockGetCase.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('getCase NOT_FOUND 時應顯示錯誤並排程導航', async () => {
    mockGetCase.mockRejectedValue({ code: 'NOT_FOUND', message: 'Not found' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.caseNotFound');
    });
  });

  it('getCase FORBIDDEN 時應顯示無權限錯誤', async () => {
    mockGetCase.mockRejectedValue({ code: 'FORBIDDEN', message: 'Forbidden' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.noPermissionViewCase');
    });
  });

  it('getCase UNAUTHORIZED 時應顯示需登入錯誤', async () => {
    mockGetCase.mockRejectedValue({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.pleaseLogin');
    });
  });

  it('案件載入成功後應顯示案件標題', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });
});
