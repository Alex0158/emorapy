/**
 * Interview Chat 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetSession = vi.fn();
const mockRespond = vi.fn();
const mockSkipTurn = vi.fn();
const mockEndSession = vi.fn();
const mockCancelStream = vi.fn();
const mockDismissSafetyAlert = vi.fn();

let mockStoreState = {
  currentSession: null as Record<string, unknown> | null,
  turns: [] as Record<string, unknown>[],
  streamingText: '',
  isStreaming: false,
  loading: false,
  error: null as string | null,
  errorCode: null as string | null,
  shouldEnd: false,
  safetyAlert: null as Record<string, unknown> | null,
  respond: mockRespond,
  skipTurn: mockSkipTurn,
  getSession: mockGetSession,
  endSession: mockEndSession,
  cancelStream: mockCancelStream,
  dismissSafetyAlert: mockDismissSafetyAlert,
};

vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => mockStoreState,
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@/components/business/Interview/ChatBubble', () => ({
  default: ({ content, isUser }: { content: string; isUser: boolean }) => (
    <div data-testid={isUser ? 'user-bubble' : 'ai-bubble'}>{content}</div>
  ),
}));
vi.mock('@/components/business/Interview/InterviewInput', () => ({
  default: () => <div data-testid="interview-input" />,
}));
vi.mock('@/components/business/Interview/SafetyAlert', () => ({
  default: ({ message }: { message: string }) => <div data-testid="safety-alert">{message}</div>,
}));

import InterviewChat from './index';

function renderWithRouter(sessionId = 'test-session') {
  return render(
    <MemoryRouter initialEntries={[`/interview/${sessionId}`]}>
      <Routes>
        <Route path="/interview/:sessionId" element={<InterviewChat />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InterviewChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(undefined);
    mockStoreState = {
      currentSession: null,
      turns: [],
      streamingText: '',
      isStreaming: false,
      loading: false,
      error: null,
      errorCode: null,
      shouldEnd: false,
      safetyAlert: null,
      respond: mockRespond,
      skipTurn: mockSkipTurn,
      getSession: mockGetSession,
      endSession: mockEndSession,
      cancelStream: mockCancelStream,
      dismissSafetyAlert: mockDismissSafetyAlert,
    };
  });

  it('掛載時應呼叫 getSession', () => {
    renderWithRouter();
    expect(mockGetSession).toHaveBeenCalledWith('test-session');
  });

  it('loading 且無 session 時應顯示 loading', () => {
    mockStoreState.loading = true;
    renderWithRouter();
    expect(screen.getByText('interview.loadingChat')).toBeInTheDocument();
  });

  it('有 turns 時應渲染 ChatBubble', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'AI 問候', user_response: '使用者回覆', skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    renderWithRouter();
    expect(screen.getByText('AI 問候')).toBeInTheDocument();
    expect(screen.getByText('使用者回覆')).toBeInTheDocument();
  });

  it('有 error 時應顯示錯誤訊息', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = '發生錯誤';
    mockStoreState.errorCode = 'RATE_LIMIT_EXCEEDED';
    renderWithRouter();
    expect(screen.getByText('interview.error.rateLimit')).toBeInTheDocument();
  });

  it('有 safetyAlert 時應渲染 SafetyAlert', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.safetyAlert = { message: '安全警告', severity: 'warning' };
    renderWithRouter();
    expect(screen.getByTestId('safety-alert')).toBeInTheDocument();
  });

  it('session 為 in_progress 時應渲染 InterviewInput', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    renderWithRouter();
    expect(screen.getByTestId('interview-input')).toBeInTheDocument();
  });

  it('session 為 processing 時應顯示處理中提示', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing' };
    renderWithRouter();
    expect(screen.getByText('interview.processing')).toBeInTheDocument();
  });

  it('session 為 completed 時應顯示查看結果按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'completed' };
    renderWithRouter();
    expect(screen.getByText('interview.viewResult')).toBeInTheDocument();
  });

  it('isStreaming 時應渲染 streaming bubble', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.isStreaming = true;
    mockStoreState.streamingText = '正在生成...';
    renderWithRouter();
    expect(screen.getByText('正在生成...')).toBeInTheDocument();
  });

  it('errorCode=NOT_FOUND 時應顯示返回個人頁按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'not found';
    mockStoreState.errorCode = 'NOT_FOUND';
    renderWithRouter();
    expect(screen.getByText('interview.error.notFound')).toBeInTheDocument();
    expect(screen.getByText('interview.backToProfile')).toBeInTheDocument();
  });

  it('errorCode=AI_CALL_FAILED 時應顯示重新載入按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'ai error';
    mockStoreState.errorCode = 'AI_CALL_FAILED';
    renderWithRouter();
    expect(screen.getByText('interview.error.aiCallFailed')).toBeInTheDocument();
    expect(screen.getByText('interview.reloadConversation')).toBeInTheDocument();
  });

  it('errorCode=MAX_TURNS_REACHED 時應顯示查看結果按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'max turns';
    mockStoreState.errorCode = 'MAX_TURNS_REACHED';
    renderWithRouter();
    expect(screen.getByText('interview.error.maxTurns')).toBeInTheDocument();
    expect(screen.getByText('interview.viewResult')).toBeInTheDocument();
  });

  it('errorCode=CONSENT_REQUIRED 時應顯示返回個人頁按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'consent required';
    mockStoreState.errorCode = 'CONSENT_REQUIRED';
    renderWithRouter();
    expect(screen.getByText('interview.error.consentRequired')).toBeInTheDocument();
    expect(screen.getByText('interview.backToProfile')).toBeInTheDocument();
  });

  it('isTerminalError 時不應渲染 InterviewInput', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'done';
    mockStoreState.errorCode = 'SESSION_COMPLETED';
    renderWithRouter();
    expect(screen.queryByTestId('interview-input')).not.toBeInTheDocument();
  });

  it('有 safetyAlert 時不應顯示 error 區塊', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'some error';
    mockStoreState.errorCode = 'AI_CALL_FAILED';
    mockStoreState.safetyAlert = { message: '安全警告', severity: 'warning' };
    renderWithRouter();
    expect(screen.getByTestId('safety-alert')).toBeInTheDocument();
    expect(screen.queryByText('interview.error.aiCallFailed')).not.toBeInTheDocument();
  });

  it('turns >= 3 且 in_progress 時應顯示暫停對話按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    renderWithRouter();
    expect(screen.getByText('interview.pauseChat')).toBeInTheDocument();
  });
});
