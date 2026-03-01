import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { message as antdMessage } from 'antd';
import ChatRoomPage from './index';
import { setLocale } from '@/utils/i18n';
import { useAuthStore } from '@/store/authStore';

vi.mock('react-virtuoso', async () => {
  const React = await import('react');
  type VirtuosoProps = {
    data?: unknown[];
    firstItemIndex?: number;
    computeItemKey?: (index: number, item: unknown) => React.Key;
    itemContent?: (index: number, item: unknown) => React.ReactNode;
    components?: { Header?: React.ComponentType; Footer?: React.ComponentType };
    rangeChanged?: (range: { startIndex: number; endIndex: number }) => void;
    atBottomStateChange?: (atBottom: boolean) => void;
    scrollerRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    className?: string;
  };

  const Virtuoso = React.forwardRef(function VirtuosoMock(
    {
      data = [],
      firstItemIndex = 0,
      computeItemKey,
      itemContent,
      components,
      rangeChanged,
      atBottomStateChange,
      scrollerRef,
      style,
      className,
    }: VirtuosoProps,
    ref
  ) {
    const scrollerDivRef = React.useRef<HTMLDivElement | null>(null);

    React.useImperativeHandle(ref, () => ({
      scrollToIndex: () => undefined,
      scrollTo: () => undefined,
    }));

    React.useEffect(() => {
      scrollerRef?.(scrollerDivRef.current);
      return () => scrollerRef?.(null);
    }, [scrollerRef]);

    React.useEffect(() => {
      if (!Array.isArray(data)) return;
      if (data.length === 0) return;
      rangeChanged?.({ startIndex: firstItemIndex, endIndex: firstItemIndex + data.length - 1 });
      atBottomStateChange?.(true);
    }, [atBottomStateChange, data, firstItemIndex, rangeChanged]);

    const Header = components?.Header;
    const Footer = components?.Footer;

    return (
      <div className={className} style={style}>
        {Header ? <Header /> : null}
        <div ref={scrollerDivRef} data-testid="virtuoso-scroller">
          <div data-testid="virtuoso-item-list">
            {data.map((item, i) => {
              const absIndex = firstItemIndex + i;
              const key = computeItemKey ? computeItemKey(absIndex, item) : absIndex;
              return (
                <div key={key} data-index={absIndex}>
                  {itemContent ? itemContent(absIndex, item) : null}
                </div>
              );
            })}
          </div>
        </div>
        {Footer ? <Footer /> : null}
      </div>
    );
  });

  return { Virtuoso };
});

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
  afterEach(async () => {
    vi.useRealTimers();
    // Flush any pending promise-driven updates (antd message/portal, router, etc.)
    await act(async () => {
      await Promise.resolve();
    });
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    setLocale('zh-TW');
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'u1' } as any, isAuthenticated: true });
    vi.spyOn(antdMessage, 'success').mockImplementation(() => undefined as any);
    vi.spyOn(antdMessage, 'error').mockImplementation(() => undefined as any);
    vi.spyOn(antdMessage, 'warning').mockImplementation(() => undefined as any);
    vi.spyOn(antdMessage, 'info').mockImplementation(() => undefined as any);
    mockConnectChatStream.mockResolvedValue(() => undefined);
    mockGetChatRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '建立聊天室' }));
    });
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
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
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

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入邀請碼'), {
        target: { value: 'ABC123' },
      });
      fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));
    });
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

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入邀請碼'), {
        target: { value: 'ABC123' },
      });
      fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
      fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));
    });

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
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'hello' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

	    await waitFor(() => {
	      expect(mockSendChatMessage).toHaveBeenCalledWith('room-1', expect.objectContaining({ content: 'hello' }));
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
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '建立邀請' }));
    });
	    await waitFor(() => {
	      expect(mockCreateChatInvite).toHaveBeenCalledWith('room-1', {
	        history_visibility_mode: 'share_summary_only',
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
    await screen.findByRole('button', { name: '建立邀請' });

    const inviteBtn = screen.getByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
      fireEvent.click(inviteBtn);
    });
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
	    await screen.findByText('聊天室：room-1');
	    expect(screen.getByRole('button', { name: '建立邀請' })).toBeDisabled();
	    expect(screen.getByRole('button', { name: '發起判決' })).toBeDisabled();
	    expect(screen.getByRole('button', { name: /送\s*出/ })).toBeDisabled();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'should-not-send' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('輸入訊息...'), { key: 'Enter', code: 'Enter' });
    });
    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });

  it('發起判決快速連點只會送出一次請求', async () => {
    mockRequestChatJudgment.mockResolvedValue({
      roomId: 'room-1',
      caseId: 'case-1',
      status: 'judgment_requested',
    });
    mockListChatMessages.mockResolvedValueOnce({
      messages: [
        {
          id: 'msg-1',
          content: 'hello',
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: new Date().toISOString(),
          sender_participant: { role_in_room: 'roleA' },
        },
      ],
      nextCursor: null,
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
		    await screen.findByText('聊天室：room-1');

		    const button = screen.getByRole('button', { name: '發起判決' });
		    await act(async () => {
		      fireEvent.click(button);
		      fireEvent.click(button);
		    });

	    await screen.findByText('轉判決前確認');
		    const dialog = await screen.findByRole('dialog');
		    const dialogButtons = within(dialog).getAllByRole('button');
		    const confirm = dialogButtons[dialogButtons.length - 1];
		    await act(async () => {
		      fireEvent.click(confirm);
		      fireEvent.click(confirm);
		    });
		    await waitFor(() => {
		      expect(mockRequestChatJudgment).toHaveBeenCalledTimes(1);
		    });
		  });
});
