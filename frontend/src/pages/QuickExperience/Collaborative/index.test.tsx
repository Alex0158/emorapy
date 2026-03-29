/**
 * Collaborative 協作聽證頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockSessionStorageSet = vi.fn();
const mockCaseSessionMapSet = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCreateCollaborativeCase = vi.fn();
vi.mock('@/services/api/case', () => ({
  createCollaborativeCase: (...args: unknown[]) => mockCreateCollaborativeCase(...args),
}));

vi.mock('@/utils/storage', () => ({
  sessionStorage: { set: (...args: unknown[]) => mockSessionStorageSet(...args), get: vi.fn() },
  caseSessionMap: { set: (...args: unknown[]) => mockCaseSessionMapSet(...args) },
}));

const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();
const mockMessageSuccess = vi.fn();
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Steps: ({ current }: { current: number }) => <div data-testid="steps-mock">step-{current}</div>,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      info: vi.fn(),
    },
  };
});
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({
  default: () => <div data-testid="mediator-avatar" />,
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

/** role_a 需滿 30 字（MIN_STATEMENT_LENGTH）；role_b 需滿 10 字（MIN_DEFENDANT_LENGTH） */
const validRoleA = 'This is a plaintiff statement that exceeds thirty characters in length for collaborative testing.';
const validRoleB = 'defendant response';

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
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    expect(mockSessionStorageSet).toHaveBeenCalledWith('sess1');
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
    fireEvent.change(textarea, { target: { value: validRoleA } });
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

  it('role_b createCollaborativeCase 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      });
    let resolveB: (v: unknown) => void;
    mockCreateCollaborativeCase.mockImplementation(
      () => new Promise((resolve) => { resolveB = resolve; })
    );
    const { unmount } = renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledWith(
        { case_id: 'c1', defendant_statement: validRoleB },
        'sess1'
      );
    });
    unmount();
    resolveB!({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'submitted',
    });
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    expect(screen.getByText('collaborative.roleBTitle')).toBeInTheDocument();
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/c1');
    });
    expect(mockCaseSessionMapSet).toHaveBeenCalledWith('c1', 'sess1');
  });

  it('role_a 文字不足最小長度時提交按鈕應 disabled（邊界：MIN_STATEMENT_LENGTH=30）', () => {
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    const submitBtn = screen.getByText('collaborative.roleASubmit').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('role_a exactly 29 字時提交按鈕仍應 disabled', () => {
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九' } }); // 29 chars
    const submitBtn = screen.getByText('collaborative.roleASubmit').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('role_a 提交失敗後應仍可再次點擊提交，成功後應進入 handoff（F02 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCreateCollaborativeCase
      .mockRejectedValueOnce(new Error('暫時無法建立'))
      .mockResolvedValueOnce({
        case: { id: 'c-retry' },
        session_id: 'sess-retry',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法建立');
    });
    await waitFor(() => {
      expect(screen.getByText('collaborative.roleASubmit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(2);
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
  });

  it('role_a createCollaborativeCase SESSION_EXPIRED 時應顯示錯誤且可點擊返回導向 intro（F02 session 過期：導航出口）', async () => {
    mockCreateCollaborativeCase.mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: '' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
    expect(screen.getByText('collaborative.roleATitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('collaborative.back'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.introText')).toBeInTheDocument();
    });
  });

  it('role_a 提交失敗時應顯示 message.error 且停留在 role_a', async () => {
    mockCreateCollaborativeCase.mockRejectedValue(new Error('建立失敗'));
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('建立失敗');
    });
    expect(screen.getByText('collaborative.roleATitle')).toBeInTheDocument();
  });

  it('role_a 提交失敗時應顯示頁內錯誤與 retry，點擊 retry 成功後應進入 handoff', async () => {
    mockCreateCollaborativeCase
      .mockRejectedValueOnce(new Error('建立失敗'))
      .mockResolvedValueOnce({
        case: { id: 'c-inline-retry' },
        session_id: 'sess-inline-retry',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    expect(await screen.findByText('建立失敗')).toBeInTheDocument();
    fireEvent.click(screen.getByText('error.retry'));
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(2);
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
  });

  it('role_a 提交失敗後修改輸入時應清除頁內錯誤', async () => {
    mockCreateCollaborativeCase.mockRejectedValueOnce(new Error('建立失敗'));
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    expect(await screen.findByText('建立失敗')).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: `${validRoleA} more` } });
    await waitFor(() => {
      expect(screen.queryByText('建立失敗')).not.toBeInTheDocument();
    });
  });

  it('role_a 提交失敗且 message 為空字串時應使用 submitFail（F10 邊界）', async () => {
    mockCreateCollaborativeCase.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('role_a 提交失敗且錯誤無 message 時應顯示 message.submitFail', async () => {
    mockCreateCollaborativeCase.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('role_a createCollaborativeCase FORBIDDEN 時若有 message 應顯示該 message（F02 權限邊界）', async () => {
    mockCreateCollaborativeCase.mockRejectedValue({ code: 'FORBIDDEN', message: '已達協作案件上限' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('已達協作案件上限');
    });
  });

  it('role_a createCollaborativeCase FORBIDDEN 且無 message 時應使用 submitFail（F02 權限邊界 fallback）', async () => {
    mockCreateCollaborativeCase.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('role_a 快速連點只會送出一次 createCollaborativeCase 請求', async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreateCollaborativeCase.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    const submitBtn = screen.getByText('collaborative.roleASubmit');
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(1);
    });
    resolveCreate!({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'a_done',
    });
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
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
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('提交失敗');
    });
    expect(screen.getByText('collaborative.roleBTitle')).toBeInTheDocument();
  });

  it('role_b 提交失敗時應顯示頁內錯誤與 retry，點擊 retry 成功後應導向 result', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce(new Error('提交失敗'))
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'submitted',
      });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    expect(await screen.findByText('提交失敗')).toBeInTheDocument();
    fireEvent.click(screen.getByText('error.retry'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/c1');
    });
  });

  it('role_b 提交失敗後修改輸入時應清除頁內錯誤', async () => {
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
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    expect(await screen.findByText('提交失敗')).toBeInTheDocument();
    const nextTextareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(nextTextareaB, { target: { value: `${validRoleB} again` } });
    await waitFor(() => {
      expect(screen.queryByText('提交失敗')).not.toBeInTheDocument();
    });
  });

  it('role_a 失敗後若組件已卸載不應再呼叫 message.error（useMountedRef 回歸）', async () => {
    let rejectA: (reason?: unknown) => void;
    mockCreateCollaborativeCase.mockImplementation(
      () => new Promise((_, reject) => { rejectA = reject; })
    );
    const { unmount } = renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(1);
    });
    unmount();
    rejectA!(new Error('卸載後失敗'));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('role_b 失敗後若組件已卸載不應再呼叫 message.error（useMountedRef 回歸）', async () => {
    mockCreateCollaborativeCase.mockResolvedValueOnce({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'a_done',
    });
    let rejectB: (reason?: unknown) => void;
    mockCreateCollaborativeCase.mockImplementationOnce(
      () => new Promise((_, reject) => { rejectB = reject; })
    );
    const { unmount } = renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(2);
    });
    unmount();
    rejectB!(new Error('卸載後失敗'));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('role_b 提交失敗時應仍可點擊返回並導向 handoff（F02 錯誤恢復：失敗不阻塞導航出口）', async () => {
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
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('提交失敗');
    });
    expect(screen.getByText('collaborative.roleBTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('collaborative.back'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    expect(screen.queryByText('collaborative.roleBTitle')).not.toBeInTheDocument();
  });

  it('role_b 提交失敗後應仍可再次點擊提交，成功後應導向 result（F02 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce(new Error('暫時無法提交'))
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'submitted',
      });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法提交');
    });
    await waitFor(() => {
      expect(screen.getByText('collaborative.submitBtn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(3);
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/c1');
    });
  });

  it('role_b 提交失敗且錯誤無 message 時應顯示 message.submitFail', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce({ code: 'SERVER_ERROR' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('role_b 提交失敗且 message 為空字串時應使用 submitFail（F10 邊界）', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: '' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('role_b createCollaborativeCase SESSION_EXPIRED 時應顯示錯誤且可點擊返回導向 handoff（F02 session 過期：導航出口）', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: '' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
    fireEvent.click(screen.getByText('collaborative.back'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
  });

  it('role_b createCollaborativeCase FORBIDDEN 時若有 message 應顯示該 message（F02 權限邊界）', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce({ code: 'FORBIDDEN', message: '此 session 已逾時，請重新開始' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此 session 已逾時，請重新開始');
    });
  });

  it('role_b createCollaborativeCase FORBIDDEN 且無 message 時應使用 submitFail（F02 權限邊界 fallback）', async () => {
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockRejectedValueOnce({ code: 'FORBIDDEN' });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textareaA = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaA, { target: { value: validRoleA } });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    const textareaB = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textareaB, { target: { value: validRoleB } });
    fireEvent.click(screen.getByText('collaborative.submitBtn'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('role_a 快速連點只會送出一次 createCollaborativeCase 請求', async () => {
    let resolveA: (v: unknown) => void;
    mockCreateCollaborativeCase.mockImplementation(
      () => new Promise((resolve) => { resolveA = resolve; })
    );
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    const textarea = screen.getByPlaceholderText('collaborative.placeholder');
    fireEvent.change(textarea, { target: { value: validRoleA } });
    const submitBtn = screen.getByText('collaborative.roleASubmit');
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(1);
    });
    resolveA!({ case: { id: 'c1' }, session_id: 'sess1', session_expires_at: '2025-12-31', phase: 'a_done' });
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
  });

  it('role_b 快速連點只會送出一次 createCollaborativeCase 請求', async () => {
    let resolveB: (v: unknown) => void;
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'c1' },
        session_id: 'sess1',
        session_expires_at: '2025-12-31',
        phase: 'a_done',
      })
      .mockImplementation(
        () => new Promise((resolve) => { resolveB = resolve; })
      );
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    fireEvent.change(screen.getByPlaceholderText('collaborative.placeholder'), {
      target: { value: validRoleA },
    });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    fireEvent.change(screen.getByPlaceholderText('collaborative.placeholder'), {
      target: { value: validRoleB },
    });
    const submitBtn = screen.getByText('collaborative.submitBtn');
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(2);
    });
    resolveB!({ case: { id: 'c1' }, session_id: 'sess1', session_expires_at: '2025-12-31', phase: 'submitted' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/c1');
    });
  });

  it('role_b exactly 9 字時提交按鈕仍應 disabled（邊界：MIN_DEFENDANT_LENGTH=10）', async () => {
    mockCreateCollaborativeCase.mockResolvedValueOnce({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'a_done',
    });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    fireEvent.change(screen.getByPlaceholderText('collaborative.placeholder'), {
      target: { value: validRoleA },
    });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    fireEvent.change(screen.getByPlaceholderText('collaborative.placeholder'), {
      target: { value: '123456789' }, // exactly 9 chars < MIN_DEFENDANT_LENGTH(10)
    });
    const submitBtn = screen.getByText('collaborative.submitBtn').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('role_b exactly 10 字時提交按鈕應 enabled（邊界：MIN_DEFENDANT_LENGTH 正邊界）', async () => {
    mockCreateCollaborativeCase.mockResolvedValueOnce({
      case: { id: 'c1' },
      session_id: 'sess1',
      session_expires_at: '2025-12-31',
      phase: 'a_done',
    });
    renderPage();
    fireEvent.click(screen.getByText('collaborative.startBtn'));
    fireEvent.change(screen.getByPlaceholderText('collaborative.placeholder'), {
      target: { value: validRoleA },
    });
    fireEvent.click(screen.getByText('collaborative.roleASubmit'));
    await waitFor(() => {
      expect(screen.getByText('collaborative.handoffTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('collaborative.roleBStart'));
    fireEvent.change(screen.getByPlaceholderText('collaborative.placeholder'), {
      target: { value: '1234567890' }, // exactly 10 chars = MIN_DEFENDANT_LENGTH
    });
    const submitBtn = screen.getByText('collaborative.submitBtn').closest('button');
    expect(submitBtn).not.toBeDisabled();
  });
});
