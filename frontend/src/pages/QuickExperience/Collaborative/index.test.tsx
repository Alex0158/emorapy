/**
 * Collaborative 協作聽證頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCreateCollaborativeCase = vi.fn();
vi.mock('@/services/api/case', () => ({
  createCollaborativeCase: (...args: unknown[]) => mockCreateCollaborativeCase(...args),
}));

vi.mock('@/utils/storage', () => ({
  sessionStorage: { set: vi.fn(), get: vi.fn() },
  caseSessionMap: { set: vi.fn() },
}));

const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Steps: ({ current }: { current: number }) => <div data-testid="steps-mock">step-{current}</div>,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
      success: vi.fn(),
      info: vi.fn(),
    },
  };
});
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('@/utils/constants', () => ({
  MIN_STATEMENT_LENGTH: 5,
  MIN_DEFENDANT_LENGTH: 3,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/BearJudge', () => ({
  default: () => <div data-testid="bear-judge" />,
}));
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, animate, initial, exit, variants, transition, layout, layoutId, viewport, whileInView, whileHover, whileTap, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import CollaborativeCreate from './index';

function renderPage() {
  return render(
    <MemoryRouter>
      <CollaborativeCreate />
    </MemoryRouter>
  );
}

describe('CollaborativeCreate', () => {
  const originalError = console.error;
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('height') && args[0].includes('NaN')) {
        return;
      }
      // @ts-expect-error spread
      originalError(...args);
    };
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('初始應顯示 intro 階段', () => {
    renderPage();
    expect(screen.getByText('collaborative.introText')).toBeInTheDocument();
    expect(screen.getByText('collaborative.startBtn')).toBeInTheDocument();
  });

  it('點擊開始按鈕應進入 role_a 階段', () => {
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    expect(screen.getByText('collaborative.roleATitle')).toBeInTheDocument();
  });

  it('role_a 階段可輸入文字', () => {
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: 'test input' } });
    expect(textarea).toHaveValue('test input');
  });

  it('role_a 提交成功應進入 handoff 階段', async () => {
    mockCreateCollaborativeCase.mockResolvedValue({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'a_done',
    });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: 'sufficiently long text' } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
  });

  it('handoff 階段點擊按鈕應進入 role_b', async () => {
    mockCreateCollaborativeCase.mockResolvedValue({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'a_done',
    });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: 'sufficiently long text' } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    expect(screen.getByText('collaborative.roleBTitle')).toBeInTheDocument();
  });

  it('role_a 階段可返回 intro', () => {
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    expect(screen.getByText('collaborative.roleATitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('collaborative.back'));
    expect(screen.getByText('collaborative.introText')).toBeInTheDocument();
  });

  it('role_b 提交成功應導航到結果頁', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'submitted',
      });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: 'plaintiff long text' } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    expect(screen.getByText('collaborative.roleBTitle')).toBeInTheDocument();
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: 'defendant response' } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/c1');
    });
  });

  it('role_a 文字不足最小長度時提交按鈕應 disabled', () => {
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    const submitBtn = screen.getByText('collaborative.roleASubmit').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('role_a 提交失敗時應顯示 message.error 且停留在 role_a', async () => {
    mockCreateCollaborativeCase.mockRejectedValue(new Error('建立失敗'));
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: 'sufficiently long text' } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('建立失敗');
    });
    expect(screen.getByText('collaborative.roleATitle')).toBeInTheDocument();
  });

  it('role_b 提交失敗時應顯示 message.error 且回到 role_b', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce(new Error('提交失敗'));
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: 'plaintiff long text' } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: 'defendant response' } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('提交失敗');
    });
    expect(screen.getByText('collaborative.roleBTitle')).toBeInTheDocument();
  });
});
