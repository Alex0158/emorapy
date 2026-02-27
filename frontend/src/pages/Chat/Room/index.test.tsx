import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChatRoomPage from './index';

const mockCreateChatRoom = vi.fn();
const mockAcceptChatInvite = vi.fn();
const mockGetChatRoom = vi.fn();
const mockListChatMessages = vi.fn();
const mockSendChatMessage = vi.fn();
const mockCreateChatInvite = vi.fn();
const mockRequestChatJudgment = vi.fn();
const mockGetChatJudgmentStatus = vi.fn();
const mockConnectChatStream = vi.fn();
const mockDeclineChatInvite = vi.fn();

vi.mock('@/services/api/chat', () => ({
  createChatRoom: (...args: unknown[]) => mockCreateChatRoom(...args),
  acceptChatInvite: (...args: unknown[]) => mockAcceptChatInvite(...args),
  getChatRoom: (...args: unknown[]) => mockGetChatRoom(...args),
  listChatMessages: (...args: unknown[]) => mockListChatMessages(...args),
  sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args),
  createChatInvite: (...args: unknown[]) => mockCreateChatInvite(...args),
  requestChatJudgment: (...args: unknown[]) => mockRequestChatJudgment(...args),
  getChatJudgmentStatus: (...args: unknown[]) => mockGetChatJudgmentStatus(...args),
  connectChatStream: (...args: unknown[]) => mockConnectChatStream(...args),
  declineChatInvite: (...args: unknown[]) => mockDeclineChatInvite(...args),
}));

describe('ChatRoomPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectChatStream.mockResolvedValue(() => undefined);
    mockGetChatRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      participants: [],
    });
    mockListChatMessages.mockResolvedValue({
      messages: [],
      nextCursor: null,
    });
    mockGetChatJudgmentStatus.mockResolvedValue({});
  });

  it('在入口頁可建立聊天室', async () => {
    mockCreateChatRoom.mockResolvedValue({ id: 'new-room' });
    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '建立聊天室' }));
    await waitFor(() => {
      expect(mockCreateChatRoom).toHaveBeenCalled();
    });
  });

  it('建立聊天室快速連點只會送出一次請求', async () => {
    mockCreateChatRoom.mockResolvedValue({ id: 'new-room' });
    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: '建立聊天室' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockCreateChatRoom).toHaveBeenCalledTimes(1);
    });
  });

  it('在入口頁可拒絕邀請', async () => {
    mockDeclineChatInvite.mockResolvedValue({ id: 'invite-1', status: 'declined' });
    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('輸入邀請碼'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));
    await waitFor(() => {
      expect(mockDeclineChatInvite).toHaveBeenCalledWith('ABC123');
    });
  });

  it('接受邀請進行中時不應觸發拒絕邀請', async () => {
    mockAcceptChatInvite.mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('輸入邀請碼'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
    fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));

    expect(mockAcceptChatInvite).toHaveBeenCalledTimes(1);
    expect(mockDeclineChatInvite).not.toHaveBeenCalled();
  });

  it('在房間頁可送出訊息', async () => {
    mockSendChatMessage.mockResolvedValue({
      id: 'msg-1',
      content: 'hello',
      message_type: 'user_text',
      created_at: new Date().toISOString(),
    });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledWith('room-1');
    });

    fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));

    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledWith('room-1', { content: 'hello' });
    });
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('建立邀請遇到 CONFLICT 會觸發房間刷新', async () => {
    mockCreateChatInvite.mockRejectedValue({ code: 'CONFLICT', message: 'conflict' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledWith('room-1');
    });
    const beforeCalls = mockGetChatRoom.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '建立邀請' }));
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalledWith('room-1', {
        history_visibility_mode: 'share_full_history',
      });
      expect(mockGetChatRoom.mock.calls.length).toBeGreaterThan(beforeCalls);
    });
  });

  it('建立邀請快速連點只會送出一次請求', async () => {
    mockCreateChatInvite.mockResolvedValue({ id: 'i1', invite_code: 'ABC123' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledWith('room-1');
    });

    const inviteBtn = screen.getByRole('button', { name: '建立邀請' });
    fireEvent.click(inviteBtn);
    fireEvent.click(inviteBtn);
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalledTimes(1);
    });
  });

  it('SSE close 時會顯示重連提示', async () => {
    mockConnectChatStream.mockImplementation(async (_roomId: string, callbacks: { onClose?: () => void }) => {
      callbacks.onClose?.();
      return () => undefined;
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('即時連線已中斷，正在重試並改用輪詢更新')).toBeInTheDocument();
    });
  });

  it('SSE 終態錯誤時應停止重試並顯示終態錯誤', async () => {
    mockConnectChatStream.mockImplementation(async (_roomId: string, callbacks: { onError?: (e: { status?: number; message?: string }) => void }) => {
      callbacks.onError?.({ status: 403, message: 'forbidden' });
      return () => undefined;
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('forbidden')).toBeInTheDocument();
    });
    expect(mockConnectChatStream).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 401, code: 'SESSION_EXPIRED', message: 'session-expired' },
    { status: 403, code: 'FORBIDDEN', message: 'forbidden' },
    { status: 404, code: 'NOT_FOUND', message: 'not-found' },
    { status: 400, code: 'INVALID_SESSION_ID', message: 'invalid-session' },
  ])('SSE 終態錯誤矩陣：$code 時不應重連', async ({ status, code, message }) => {
    mockConnectChatStream.mockImplementation(async (_roomId: string, callbacks: { onError?: (e: { status?: number; code?: string; message?: string }) => void }) => {
      callbacks.onError?.({ status, code, message });
      return () => undefined;
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
    });
    expect(mockConnectChatStream).toHaveBeenCalledTimes(1);
  });

  it('SSE 非終態錯誤會進行重連', async () => {
    vi.useFakeTimers();
    mockConnectChatStream.mockImplementation(async (_roomId: string, callbacks: { onError?: (e: { status?: number; code?: string; message?: string }) => void }) => {
      setTimeout(() => {
        callbacks.onError?.({ status: 500, code: 'STREAM_DISCONNECTED', message: 'retryable' });
      }, 0);
      return () => undefined;
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockConnectChatStream).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(mockConnectChatStream.mock.calls.length).toBeGreaterThan(1);
  });

  it('房間終態時應禁用建立邀請/發起判決/發送訊息', async () => {
    mockGetChatRoom.mockResolvedValueOnce({
      id: 'room-1',
      status: 'judgment_completed',
      participants: [],
    });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledWith('room-1');
    });
    expect(screen.getByRole('button', { name: '建立邀請' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '發起判決' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /送\s*出/ })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
      target: { value: 'should-not-send' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('輸入訊息...'), { key: 'Enter', code: 'Enter' });
    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });

  it('發起判決快速連點只會送出一次請求', async () => {
    mockRequestChatJudgment.mockResolvedValue({
      roomId: 'room-1',
      caseId: 'case-1',
      status: 'judgment_requested',
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledWith('room-1');
    });

    const button = screen.getByRole('button', { name: '發起判決' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalledTimes(1);
    });
  });
});

