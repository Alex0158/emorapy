import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { message as antdMessage } from 'antd';
import ChatRoomPage from './index';
import { setLocale } from '@/utils/i18n';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/common/ProtectedRoute';

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
const mockConnectAIStream = vi.fn();
const mockDeclineChatInvite = vi.fn();
const mockLeaveChatRoom = vi.fn();
const mockKickChatParticipantB = vi.fn();

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
  leaveChatRoom: (...args: unknown[]) => mockLeaveChatRoom(...args),
  kickChatParticipantB: (...args: unknown[]) => mockKickChatParticipantB(...args),
}));

vi.mock('@/services/aiStream', () => ({
  connectAIStream: (...args: unknown[]) => mockConnectAIStream(...args),
}));

const LoginCapture = () => {
  const location = useLocation();
  return <div data-testid="login-from">{location.state?.from?.pathname ?? 'none'}</div>;
};

describe('ChatRoomPage', () => {
  afterEach(async () => {
    vi.useRealTimers();
    // Flush any pending promise-driven updates (antd message/portal, router, etc.)
    await act(async () => {
      await Promise.resolve();
    });
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.clear();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    setLocale('zh-TW');
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ user: { id: 'u1' } as any, isAuthenticated: true, _hasHydrated: true } as any);
    vi.spyOn(antdMessage, 'success').mockImplementation(() => undefined as any);
    vi.spyOn(antdMessage, 'error').mockImplementation(() => undefined as any);
    vi.spyOn(antdMessage, 'warning').mockImplementation(() => undefined as any);
    vi.spyOn(antdMessage, 'info').mockImplementation(() => undefined as any);
    mockConnectChatStream.mockResolvedValue(() => undefined);
    mockConnectAIStream.mockResolvedValue(() => undefined);
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

  it('createChatRoom 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveCreate: (v: { id: string }) => void;
    mockCreateChatRoom.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
    const { unmount } = render(
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
    unmount();
    resolveCreate!({ id: 'new-room' });
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
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

  it('createChatRoom 失敗且有 message 應顯示該 message（F07 錯誤處理約定）', async () => {
    mockCreateChatRoom.mockRejectedValue(new Error('已達聊天室數量上限'));
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
      expect(screen.getByText('已達聊天室數量上限')).toBeInTheDocument();
    });
  });

  it('createChatRoom 失敗且無 message 時應顯示 createRoomFail 文案', async () => {
    mockCreateChatRoom.mockRejectedValue({ code: 'SERVER_ERROR' });
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
      expect(screen.getByText('建立聊天室失敗')).toBeInTheDocument();
    });
  });

  it('createChatRoom 失敗且 message 為空字串時應使用 createRoomFail（F10 邊界）', async () => {
    mockCreateChatRoom.mockRejectedValue({ code: 'AI_SERVICE_ERROR', message: '' });
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
      expect(screen.getByText('建立聊天室失敗')).toBeInTheDocument();
    });
  });

  it('createChatRoom FORBIDDEN 且無 message 時應使用 createRoomFail（F07 權限邊界 fallback）', async () => {
    mockCreateChatRoom.mockRejectedValue({ code: 'FORBIDDEN' });
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
      expect(screen.getByText('建立聊天室失敗')).toBeInTheDocument();
    });
  });

  it('createChatRoom 失敗後應仍可再次點擊建立，成功後應導向聊天室（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCreateChatRoom
      .mockRejectedValueOnce(new Error('服務暫時不可用'))
      .mockResolvedValueOnce({ id: 'room-retry', status: 'active', visibility_mode: 'public' });
    mockGetChatRoom.mockImplementation(async (roomId: string) =>
      roomId === 'room-retry'
        ? {
            id: 'room-retry',
            status: 'solo_active',
            owner_user_id: 'u1',
            history_visibility_mode: 'share_summary_only',
            participants: [],
          }
        : {
            id: roomId,
            status: 'solo_active',
            owner_user_id: 'u1',
            history_visibility_mode: 'share_summary_only',
            participants: [],
          }
    );
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
      expect(screen.getByText('服務暫時不可用')).toBeInTheDocument();
    });
    expect(mockCreateChatRoom).toHaveBeenCalledTimes(1);

    const btn = screen.getByRole('button', { name: '建立聊天室' });
    await waitFor(() => {
      expect(btn).not.toHaveClass('ant-btn-loading');
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockCreateChatRoom).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText(/room-retry|聊天室：/)).toBeInTheDocument();
    });
  });

  it('建立聊天室成功後若帶 state.room 應走快速路徑，僅呼叫 listChatMessages 不呼叫 getChatRoom（UX 優化：樂觀渲染）', async () => {
    const createdRoom = {
      id: 'fast-room',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [],
    };
    mockCreateChatRoom.mockResolvedValue(createdRoom);
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockGetChatRoom.mockClear();

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
      expect(screen.getByText(/聊天室：fast-room/)).toBeInTheDocument();
    });

    expect(mockGetChatRoom).not.toHaveBeenCalledWith('fast-room');
    expect(mockListChatMessages).toHaveBeenCalledWith('fast-room', { limit: 50 });
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

  it('declineChatInvite 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveDecline: (v: unknown) => void;
    mockDeclineChatInvite.mockImplementation(
      () => new Promise((resolve) => { resolveDecline = resolve; })
    );
    const { unmount } = render(
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
    unmount();
    resolveDecline!({ id: 'invite-1', status: 'declined' });
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
  });

  it('declineChatInvite 失敗且有 message 應顯示該 message（F07 錯誤處理約定）', async () => {
    mockDeclineChatInvite.mockRejectedValue(new Error('此邀請已無法拒絕'));
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
      expect(antdMessage.error).toHaveBeenCalledWith('此邀請已無法拒絕');
    });
  });

  it('declineChatInvite 失敗且無 message 時應顯示 declineFail 文案', async () => {
    mockDeclineChatInvite.mockRejectedValue({ code: 'SERVER_ERROR' });
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
      expect(antdMessage.error).toHaveBeenCalledWith('拒絕邀請失敗');
    });
  });

  it('declineChatInvite 失敗且 message 為空字串時應使用 declineFail（F10 邊界）', async () => {
    mockDeclineChatInvite.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
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
      expect(antdMessage.error).toHaveBeenCalledWith('拒絕邀請失敗');
    });
  });

  it('declineChatInvite FORBIDDEN 且無 message 時應使用 declineFail（F07 權限邊界 fallback）', async () => {
    mockDeclineChatInvite.mockRejectedValue({ code: 'FORBIDDEN' });
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
      expect(antdMessage.error).toHaveBeenCalledWith('拒絕邀請失敗');
    });
  });

  it('declineChatInvite 失敗後應仍可再次點擊拒絕，成功後應顯示成功（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockDeclineChatInvite
      .mockRejectedValueOnce(new Error('暫時無法拒絕'))
      .mockResolvedValueOnce({ id: 'invite-1', status: 'declined' });
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
      expect(antdMessage.error).toHaveBeenCalledWith('暫時無法拒絕');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));
    });
    await waitFor(() => {
      expect(mockDeclineChatInvite).toHaveBeenCalledTimes(2);
      expect(antdMessage.success).toHaveBeenCalledWith('已拒絕邀請');
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

  it('acceptChatInvite 失敗且有 message 應顯示該 message（F07 錯誤處理約定）', async () => {
    mockAcceptChatInvite.mockRejectedValue(new Error('邀請碼已失效或已被使用'));
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
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('邀請碼已失效或已被使用');
    });
  });

  it('acceptChatInvite 失敗且無 message 時應顯示 joinFail 文案', async () => {
    mockAcceptChatInvite.mockRejectedValue({ code: 'SERVER_ERROR' });
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
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('加入聊天室失敗');
    });
  });

  it('acceptChatInvite 失敗且 message 為空字串時應使用 joinFail（F10 邊界）', async () => {
    mockAcceptChatInvite.mockRejectedValue({ code: 'INVITE_EXPIRED', message: '' });
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
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('加入聊天室失敗');
    });
  });

  it('acceptChatInvite FORBIDDEN 且無 message 時應使用 joinFail（F07 權限邊界 fallback）', async () => {
    mockAcceptChatInvite.mockRejectedValue({ code: 'FORBIDDEN' });
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
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('加入聊天室失敗');
    });
  });

  it('acceptChatInvite 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveAccept: (v: { id: string }) => void;
    mockAcceptChatInvite.mockImplementation(
      () => new Promise((resolve) => { resolveAccept = resolve; })
    );
    const { unmount } = render(
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
    });
    await waitFor(() => {
      expect(mockAcceptChatInvite).toHaveBeenCalledWith('ABC123');
    });
    unmount();
    resolveAccept!({ id: 'room-joined' });
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
  });

  it('acceptChatInvite 失敗後應仍可再次點擊加入，成功後應顯示成功（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockAcceptChatInvite
      .mockRejectedValueOnce(new Error('暫時無法加入'))
      .mockResolvedValueOnce({ id: 'room-joined' });
    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入邀請碼'), {
        target: { value: 'ABC123' },
      });
      fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
    });
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('暫時無法加入');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
    });
    await waitFor(() => {
      expect(mockAcceptChatInvite).toHaveBeenCalledTimes(2);
      expect(antdMessage.success).toHaveBeenCalledWith('加入聊天室成功');
    });
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
          <Route path="/judgment/:judgmentId" element={<div>judgment page</div>} />
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

  it('發送訊息後 visibilityScope 為 all 時應顯示思考中（UX 優化）', async () => {
    mockSendChatMessage.mockResolvedValue({
      id: 'msg-1',
      content: 'hello',
      message_type: 'user_text',
      visibility_scope: 'all',
      created_at: new Date().toISOString(),
      sender_participant: { role_in_room: 'roleA' },
    });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'hello' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('思考中...')).toBeInTheDocument();
    });
  });

  it('聊天室 AI draft 應由 AI Stream 驅動，收到 persisted 前保持氣泡，persisted 後交接為正式消息', async () => {
    let aiStreamCallbacks: Record<string, ((payload: any) => void) | undefined> = {};
    mockConnectAIStream.mockImplementation(async (_scopeType, _scopeId, callbacks) => {
      aiStreamCallbacks = callbacks as Record<string, (payload: any) => void>;
      return () => undefined;
    });
    mockSendChatMessage.mockResolvedValue({
      id: 'msg-user-1',
      content: 'hello',
      message_type: 'user_text',
      visibility_scope: 'all',
      created_at: new Date().toISOString(),
      sender_participant: { role_in_room: 'roleA' },
    });
    mockListChatMessages
      .mockResolvedValueOnce({ messages: [], nextCursor: null })
      .mockResolvedValueOnce({
        messages: [
          {
            id: 'msg-user-1',
            content: 'hello',
            message_type: 'user_text',
            visibility_scope: 'all',
            created_at: new Date().toISOString(),
            sender_participant: { role_in_room: 'roleA' },
          },
          {
            id: 'msg-ai-1',
            content: 'AI 已落庫回覆',
            message_type: 'ai_reflection',
            visibility_scope: 'all',
            created_at: new Date().toISOString(),
            sender_participant: { role_in_room: 'aiMediator' },
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'hello' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

    await screen.findByText('思考中...');

    await act(async () => {
      aiStreamCallbacks.onEvent?.({
        eventType: 'stream.started',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_room',
        scopeId: 'room-1',
        seq: 1,
        createdAt: new Date().toISOString(),
      });
      aiStreamCallbacks.onEvent?.({
        eventType: 'stream.delta',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_room',
        scopeId: 'room-1',
        seq: 2,
        createdAt: new Date().toISOString(),
        deltaText: 'AI 正在回覆',
      });
      aiStreamCallbacks.onEvent?.({
        eventType: 'stream.completed',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_room',
        scopeId: 'room-1',
        seq: 3,
        createdAt: new Date().toISOString(),
        fullText: 'AI 正在回覆',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('AI 正在回覆')).toBeInTheDocument();
    });

    await act(async () => {
      aiStreamCallbacks.onEvent?.({
        eventType: 'stream.persisted',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'chat_room',
        scopeId: 'room-1',
        seq: 4,
        createdAt: new Date().toISOString(),
        messageId: 'msg-ai-1',
        fullText: 'AI 已落庫回覆',
      });
    });

    await waitFor(() => {
      expect(mockListChatMessages).toHaveBeenCalledTimes(2);
      expect(screen.getByText('AI 已落庫回覆')).toBeInTheDocument();
    });
    expect(screen.queryByText('AI 正在回覆')).not.toBeInTheDocument();
  });

  it('sendChatMessage 失敗後應仍可再次發送訊息，成功後應顯示訊息（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockSendChatMessage
      .mockRejectedValueOnce(new Error('網路暫時不穩'))
      .mockResolvedValueOnce({
        id: 'msg-retry',
        content: '重試的訊息',
        message_type: 'user_text',
        visibility_scope: 'all',
        created_at: new Date().toISOString(),
        sender_participant: { role_in_room: 'roleA' },
      });
    mockListChatMessages.mockResolvedValueOnce({ messages: [], nextCursor: null });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
          <Route path="/judgment/:judgmentId" element={<div>judgment page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'first' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('網路暫時不穩');
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: '重試的訊息' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });
    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledTimes(2);
      expect(screen.getByText('重試的訊息')).toBeInTheDocument();
    });
  });

  it('sendChatMessage 失敗且有 message 應顯示該 message（F07 錯誤處理約定）', async () => {
    mockSendChatMessage.mockRejectedValue(new Error('訊息發送失敗：房間已封存'));
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'test message' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('訊息發送失敗：房間已封存');
    });
  });

  it('sendChatMessage 失敗且無 message 時應顯示 sendFail 文案', async () => {
    mockSendChatMessage.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
          <Route path="/judgment/:judgmentId" element={<div>judgment page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'test message' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('送出訊息失敗');
    });
  });

  it('sendChatMessage 失敗且 message 為空字串時應使用 sendFail（F10 邊界）', async () => {
    mockSendChatMessage.mockRejectedValue({ code: 'ROOM_ARCHIVED', message: '' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'test message' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('送出訊息失敗');
    });
  });

  it('sendChatMessage FORBIDDEN 且無 message 時應使用 chat.message.forbidden（F07 權限邊界：專用發言權限提示）', async () => {
    mockSendChatMessage.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByPlaceholderText('輸入訊息...');

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'test message' },
      });
      fireEvent.click(screen.getByRole('button', { name: /送\s*出/ }));
    });

    await waitFor(() => {
      expect(antdMessage.warning).toHaveBeenCalledWith('目前沒有發言權限');
    });
  });

  it('匿名 owner 且 canonical session_id 匹配時可建立邀請（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_owner_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });
    mockCreateChatInvite.mockResolvedValue({ id: 'invite-1', invite_code: 'CODE123' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    expect(inviteBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalledWith('room-anon-owner', {
        history_visibility_mode: 'share_summary_only',
      });
    });
  });

  it('匿名 owner 但 canonical session_id 不匹配時應禁用建立邀請（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_other_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '建立邀請' })).toBeDisabled();
  });

  it('匿名 owner 缺少 canonical session_id 時應禁用建立邀請（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '建立邀請' })).toBeDisabled();
  });

  it('匿名 owner 且 canonical session_id 匹配時可發起判決（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_owner_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '發起判決' })).not.toBeDisabled();
  });

  it('匿名 owner 但 canonical session_id 不匹配時應禁用發起判決（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_other_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '發起判決' })).toBeDisabled();
  });

  it('匿名 owner 缺少 canonical session_id 時應禁用發起判決（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '發起判決' })).toBeDisabled();
  });

  it('匿名 owner 且 canonical session_id 匹配時可發起判決（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_owner_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '發起判決' })).not.toBeDisabled();
  });

  it('匿名 owner 但 canonical session_id 不匹配時應禁用發起判決（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_other_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '發起判決' })).toBeDisabled();
  });

  it('匿名 owner 缺少 canonical session_id 時應禁用發起判決（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    mockGetChatRoom.mockResolvedValue({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-anon-owner']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-anon-owner'));
    expect(await screen.findByRole('button', { name: '發起判決' })).toBeDisabled();
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
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    const beforeCalls = mockGetChatRoom.mock.calls.length;
    await act(async () => {
      fireEvent.click(inviteBtn);
    });
	    await waitFor(() => {
	      expect(mockCreateChatInvite).toHaveBeenCalledWith('room-1', {
	        history_visibility_mode: 'share_summary_only',
	      });
	      expect(mockGetChatRoom.mock.calls.length).toBeGreaterThan(beforeCalls);
	    });
	  });

  it('createChatInvite INVALID_SESSION_ID 時應顯示 invalidSession 提示而非 createInviteFail', async () => {
    mockCreateChatInvite.mockRejectedValue({ code: 'INVALID_SESSION_ID' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.warning).toHaveBeenCalledWith('Session 已過期或不一致，請刷新後重試');
    });
    expect(antdMessage.error).not.toHaveBeenCalledWith('建立邀請失敗');
  });

  it('createChatInvite SESSION_EXPIRED 時應顯示 invalidSession 提示而非 createInviteFail', async () => {
    mockCreateChatInvite.mockRejectedValue({ code: 'SESSION_EXPIRED' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.warning).toHaveBeenCalledWith('Session 已過期或不一致，請刷新後重試');
    });
    expect(antdMessage.error).not.toHaveBeenCalledWith('建立邀請失敗');
  });

  it('createChatInvite 失敗且有 message（非 CONFLICT）應顯示該 message（F07 錯誤處理約定）', async () => {
    mockCreateChatInvite.mockRejectedValue(new Error('此房間已達邀請上限'));
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('此房間已達邀請上限');
    });
  });

  it('createChatInvite 失敗且無 message 時應顯示 createInviteFail 文案', async () => {
    mockCreateChatInvite.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('建立邀請失敗');
    });
  });

  it('createChatInvite 失敗且 message 為空字串時應使用 createInviteFail（F10 邊界）', async () => {
    mockCreateChatInvite.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('建立邀請失敗');
    });
  });

  it('createChatInvite FORBIDDEN 且無 message 時應使用 createInviteFail（F07 權限邊界 fallback）', async () => {
    mockCreateChatInvite.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('建立邀請失敗');
    });
  });

  it.each([
    { code: 'INVALID_SESSION_ID' },
    { code: 'SESSION_EXPIRED' },
  ])('createChatInvite 遇到 $code 時應提示 invalidSession 且不顯示通用錯誤', async ({ code }) => {
    mockCreateChatInvite.mockRejectedValue({ code });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(antdMessage.warning).toHaveBeenCalledWith('Session 已過期或不一致，請刷新後重試');
    });
    expect(antdMessage.error).not.toHaveBeenCalledWith('建立邀請失敗');
  });

  it('createChatInvite 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveCreateInvite: (v: { id: string; invite_code: string }) => void;
    mockCreateChatInvite.mockImplementation(
      () => new Promise((resolve) => { resolveCreateInvite = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalled();
    });
    unmount();
    resolveCreateInvite!({ id: 'i1', invite_code: 'ABC123' });
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
  });

  it('createChatInvite 失敗但組件已卸載時不應呼叫 message.error 或 warning（P1-04）', async () => {
    let rejectCreateInvite: (error?: unknown) => void;
    mockCreateChatInvite.mockImplementation(
      () => new Promise((_, reject) => { rejectCreateInvite = reject; })
    );
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalled();
    });
    unmount();
    rejectCreateInvite!(new Error('離線時無法建立邀請'));
    await Promise.resolve();
    expect(antdMessage.error).not.toHaveBeenCalled();
    expect(antdMessage.warning).not.toHaveBeenCalled();
  });

  it('createChatInvite 失敗後應仍可再次點擊建立邀請，成功後應顯示成功（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCreateChatInvite
      .mockRejectedValueOnce(new Error('暫時無法建立'))
      .mockResolvedValueOnce({ id: 'i1', invite_code: 'RETRY123' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const inviteBtn = await screen.findByRole('button', { name: '建立邀請' });
    await act(async () => {
      fireEvent.click(inviteBtn);
    });
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('暫時無法建立');
    });

    await act(async () => {
      fireEvent.click(inviteBtn);
    });
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalledTimes(2);
      expect(antdMessage.success).toHaveBeenCalledWith('邀請建立成功');
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

  it('getChatRoom 失敗且有 message 應顯示該 message（F07 房間載入錯誤處理）', async () => {
    mockGetChatRoom.mockRejectedValue(new Error('房間不存在或已封存'));
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('房間不存在或已封存')).toBeInTheDocument();
    });
  });

  it('getChatRoom FORBIDDEN 時若有 message 應顯示該 message（F07 權限邊界）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限進入此聊天室' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('無權限進入此聊天室')).toBeInTheDocument();
    });
  });

  it('getChatRoom FORBIDDEN 且無 message 時應使用 loadFail（F07 權限邊界 fallback）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('載入聊天室失敗')).toBeInTheDocument();
    });
  });

  it('getChatRoom NOT_FOUND 且無 message 時應顯示 roomUnavailable 文案（F07 弱入口）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'NOT_FOUND' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('聊天室不存在或已失效，請返回入口重新進入')).toBeInTheDocument();
    });
  });

  it('getChatRoom NOT_FOUND 時不應建立 SSE 連線覆蓋主要錯誤文案（F07 弱入口）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'NOT_FOUND' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('聊天室不存在或已失效，請返回入口重新進入')).toBeInTheDocument();
    });
    expect(mockConnectChatStream).not.toHaveBeenCalled();
  });

  it('getChatRoom NOT_FOUND 且 message 為空字串時應使用 roomUnavailable（F07 弱入口）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'NOT_FOUND', message: '' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('聊天室不存在或已失效，請返回入口重新進入')).toBeInTheDocument();
    });
  });

  it('getChatRoom 失敗時應仍可點擊返回按鈕導向 /chat/room（F07 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'NOT_FOUND' });
    mockListChatMessages.mockRejectedValue(new Error('skip')); // 與 getChatRoom 一併失敗，確保 loadRoomInitial 進入 catch
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('聊天室不存在或已失效，請返回入口重新進入')).toBeInTheDocument();
    });

    const backBtn = screen.getByText('返回聊天室入口');
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '建立聊天室' })).toBeInTheDocument();
    });
  });

  it('getChatRoom 失敗時應仍可點擊 retry 重新呼叫 getChatRoom，成功後應顯示聊天室（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetChatRoom
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '暫時不可用' })
      .mockResolvedValueOnce({
        id: 'room-1',
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('暫時不可用')).toBeInTheDocument();
    });
    expect(mockGetChatRoom).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('chat-room-load-retry'));
    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText(/聊天室：room-1/)).toBeInTheDocument();
    });
  });

  it('getChatRoom 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示聊天室（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetChatRoom
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '第一次失敗' })
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '第二次仍失敗' })
      .mockResolvedValueOnce({
        id: 'room-1',
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('第一次失敗')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('chat-room-load-retry'));
    await waitFor(() => {
      expect(screen.getByText('第二次仍失敗')).toBeInTheDocument();
    });
    expect(mockGetChatRoom).toHaveBeenCalledTimes(2);

    const retryBtn = screen.getByTestId('chat-room-load-retry');
    await waitFor(() => {
      expect(retryBtn.closest('button')).not.toHaveClass('ant-btn-loading');
    });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.getByText(/聊天室：room-1/)).toBeInTheDocument();
    });
  });

  it('getChatRoom 失敗時 retry 快速連點只會送出一次 getChatRoom 請求（F07 重試節流）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'SERVER_ERROR', message: '節流測試' });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('節流測試')).toBeInTheDocument();
    });
    const retryBtn = screen.getByTestId('chat-room-load-retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledTimes(2); // initial + 1 retry (throttled)
    });
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

  it('未登入時 chat 發起判決成功後應先被導向 login，並保留 judgment 回跳目標（F07 -> F04 handoff）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('cj_session_id', 'guest_owner_123');
    mockGetChatRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      owner_user_id: null,
      session_id: 'guest_owner_123',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
    });
    mockRequestChatJudgment.mockResolvedValue({
      judgmentId: 'judgment-from-chat',
      roomId: 'room-1',
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
          <Route
            path="/judgment/:id"
            element={(
              <ProtectedRoute>
                <div>Judgment Detail</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/auth/login" element={<LoginCapture />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getAllByRole('button').at(-1);
    expect(confirm).toBeTruthy();

    await act(async () => {
      fireEvent.click(confirm!);
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-from')).toHaveTextContent('/judgment/judgment-from-chat');
    });
  });

  it('requestChatJudgment 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveRequest: (v: { roomId: string; status: string }) => void;
    mockRequestChatJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; })
    );
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
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalled();
    });
    unmount();
    resolveRequest!({ roomId: 'room-1', status: 'judgment_requested' });
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
  });

  it('requestChatJudgment 失敗但組件已卸載時不應呼叫 message.error 或 warning（P1-04）', async () => {
    let rejectRequest: (error?: unknown) => void;
    mockRequestChatJudgment.mockImplementation(
      () => new Promise((_, reject) => { rejectRequest = reject; })
    );
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
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalled();
    });
    unmount();
    rejectRequest!(new Error('判決服務暫時不可用'));
    await Promise.resolve();
    expect(antdMessage.error).not.toHaveBeenCalled();
    expect(antdMessage.warning).not.toHaveBeenCalled();
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

  it('requestChatJudgment 失敗後應仍可再次點擊確認發起判決，成功後應導向判決頁（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    mockRequestChatJudgment
      .mockRejectedValueOnce(new Error('服務暫時不可用'))
      .mockResolvedValueOnce({ judgmentId: 'judgment-retry-1', roomId: 'room-1', status: 'judgment_requested' });
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
          <Route path="/judgment/:judgmentId" element={<div>judgment page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('服務暫時不可用');
    });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalledTimes(2);
      expect(antdMessage.success).toHaveBeenCalled();
    });
  });

  it('requestChatJudgment 失敗且有 message（非 CONFLICT/INVALID_SESSION）應顯示該 message（F07 錯誤處理約定）', async () => {
    mockRequestChatJudgment.mockRejectedValue(new Error('判決服務暫時不可用，請稍後再試'));
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('判決服務暫時不可用，請稍後再試');
    });
  });

  it('requestChatJudgment 失敗且無 message 時應顯示 judgmentFail 文案', async () => {
    mockRequestChatJudgment.mockRejectedValue({ code: 'SERVER_ERROR' });
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('發起判決失敗');
    });
  });

  it('requestChatJudgment 失敗且 message 為空字串時應使用 judgmentFail（F10 邊界：空 message 視為無）', async () => {
    mockRequestChatJudgment.mockRejectedValue({ code: 'AI_SERVICE_ERROR', message: '' });
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('發起判決失敗');
    });
  });

  it('requestChatJudgment FORBIDDEN 且無 message 時應使用 judgmentFail（F07 權限邊界 fallback）', async () => {
    mockRequestChatJudgment.mockRejectedValue({ code: 'FORBIDDEN' });
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起判決' }));
    await screen.findByText('轉判決前確認');
    const dialog = await screen.findByRole('dialog');
    const dialogButtons = within(dialog).getAllByRole('button');
    const confirm = dialogButtons[dialogButtons.length - 1];
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('發起判決失敗');
    });
  });

  it('leaveChatRoom 失敗且有 message 應顯示該 message（F07 錯誤處理約定）', async () => {
    const roomWithRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u-owner',
      history_visibility_mode: 'share_summary_only',
      participants: [
        {
          id: 'p1',
          room_id: 'room-1',
          user_id: 'u1',
          role_in_room: 'roleB',
          is_active: true,
          joined_at: new Date().toISOString(),
          participant_type: 'user',
        },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithRoleB);
    mockLeaveChatRoom.mockRejectedValue(new Error('房間已鎖定，無法離開'));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const leaveBtn = screen.getByRole('button', { name: '離開聊天室' });
    await act(async () => {
      fireEvent.click(leaveBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('房間已鎖定，無法離開');
    });
  });

  it('leaveChatRoom 失敗且無 message 時應顯示 leaveRoomFail 文案', async () => {
    const roomWithRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u-owner',
      history_visibility_mode: 'share_summary_only',
      participants: [
        {
          id: 'p1',
          room_id: 'room-1',
          user_id: 'u1',
          role_in_room: 'roleB',
          is_active: true,
          joined_at: new Date().toISOString(),
          participant_type: 'user',
        },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithRoleB);
    mockLeaveChatRoom.mockRejectedValue({ code: 'FORBIDDEN' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const leaveBtn = screen.getByRole('button', { name: '離開聊天室' });
    await act(async () => {
      fireEvent.click(leaveBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('離開失敗');
    });
  });

  it('leaveChatRoom 失敗且 message 為空字串時應使用 leaveRoomFail（F10 邊界）', async () => {
    const roomWithRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u-owner',
      history_visibility_mode: 'share_summary_only',
      participants: [
        {
          id: 'p1',
          room_id: 'room-1',
          user_id: 'u1',
          role_in_room: 'roleB',
          is_active: true,
          joined_at: new Date().toISOString(),
          participant_type: 'user',
        },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithRoleB);
    mockLeaveChatRoom.mockRejectedValue({ code: 'FORBIDDEN', message: '' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const leaveBtn = screen.getByRole('button', { name: '離開聊天室' });
    await act(async () => {
      fireEvent.click(leaveBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('離開失敗');
    });
  });

  it('leaveChatRoom 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    const roomWithRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u-owner',
      history_visibility_mode: 'share_summary_only',
      participants: [
        {
          id: 'p1',
          room_id: 'room-1',
          user_id: 'u1',
          role_in_room: 'roleB',
          is_active: true,
          joined_at: new Date().toISOString(),
          participant_type: 'user',
        },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithRoleB);
    let resolveLeave: () => void;
    mockLeaveChatRoom.mockImplementation(() => new Promise<void>((resolve) => { resolveLeave = resolve; }));

    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const leaveBtn = screen.getByRole('button', { name: '離開聊天室' });
    fireEvent.click(leaveBtn);
    await waitFor(() => {
      expect(mockLeaveChatRoom).toHaveBeenCalledWith('room-1');
    });
    unmount();
    resolveLeave!();
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
  });

  it('leaveChatRoom 失敗但組件已卸載時不應呼叫 message.error（P1-04）', async () => {
    const roomWithRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u-owner',
      history_visibility_mode: 'share_summary_only',
      participants: [
        {
          id: 'p1',
          room_id: 'room-1',
          user_id: 'u1',
          role_in_room: 'roleB',
          is_active: true,
          joined_at: new Date().toISOString(),
          participant_type: 'user',
        },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithRoleB);
    let rejectLeave: (error?: unknown) => void;
    mockLeaveChatRoom.mockImplementation(() => new Promise<void>((_, reject) => { rejectLeave = reject; }));

    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const leaveBtn = screen.getByRole('button', { name: '離開聊天室' });
    fireEvent.click(leaveBtn);
    await waitFor(() => {
      expect(mockLeaveChatRoom).toHaveBeenCalledWith('room-1');
    });
    unmount();
    rejectLeave!(new Error('離開失敗'));
    await Promise.resolve();
    expect(antdMessage.error).not.toHaveBeenCalled();
  });

  it('leaveChatRoom 失敗後應仍可再次點擊離開，成功後應顯示成功（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    const roomWithRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u-owner',
      history_visibility_mode: 'share_summary_only',
      participants: [
        {
          id: 'p1',
          room_id: 'room-1',
          user_id: 'u1',
          role_in_room: 'roleB',
          is_active: true,
          joined_at: new Date().toISOString(),
          participant_type: 'user',
        },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithRoleB);
    mockLeaveChatRoom
      .mockRejectedValueOnce(new Error('暫時無法離開'))
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const leaveBtn = screen.getByRole('button', { name: '離開聊天室' });
    await act(async () => {
      fireEvent.click(leaveBtn);
    });
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('暫時無法離開');
    });

    await act(async () => {
      fireEvent.click(leaveBtn);
    });
    await waitFor(() => {
      expect(mockLeaveChatRoom).toHaveBeenCalledTimes(2);
      expect(antdMessage.success).toHaveBeenCalledWith('已離開聊天室');
    });
  });

  it('kickChatParticipantB 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    const roomWithOwnerAndRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p1', room_id: 'room-1', user_id: 'u1', role_in_room: 'roleA', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
        { id: 'p2', room_id: 'room-1', user_id: 'u2', role_in_room: 'roleB', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithOwnerAndRoleB);
    let resolveKick: (v: unknown) => void;
    mockKickChatParticipantB.mockImplementation(
      () => new Promise((resolve) => { resolveKick = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const kickBtn = screen.getByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
    });
    await waitFor(() => {
      expect(mockKickChatParticipantB).toHaveBeenCalledWith('room-1');
    });
    unmount();
    resolveKick!({});
    await Promise.resolve();
    expect(antdMessage.success).not.toHaveBeenCalled();
  });

  it('kickChatParticipantB 失敗且有 message 應顯示該 message（F07 錯誤處理約定）', async () => {
    const roomWithOwnerAndRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p1', room_id: 'room-1', user_id: 'u1', role_in_room: 'roleA', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
        { id: 'p2', room_id: 'room-1', user_id: 'u2', role_in_room: 'roleB', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithOwnerAndRoleB);
    mockKickChatParticipantB.mockRejectedValue(new Error('B 方正在參與判決流程，暫時無法移除'));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const kickBtn = screen.getByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('B 方正在參與判決流程，暫時無法移除');
    });
  });

  it('kickChatParticipantB 失敗且無 message 時應顯示 kickFail 文案', async () => {
    const roomWithOwnerAndRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p1', room_id: 'room-1', user_id: 'u1', role_in_room: 'roleA', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
        { id: 'p2', room_id: 'room-1', user_id: 'u2', role_in_room: 'roleB', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithOwnerAndRoleB);
    mockKickChatParticipantB.mockRejectedValue({ code: 'SERVER_ERROR' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const kickBtn = screen.getByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('移除失敗');
    });
  });

  it('kickChatParticipantB 失敗且 message 為空字串時應使用 kickFail（F10 邊界）', async () => {
    const roomWithOwnerAndRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p1', room_id: 'room-1', user_id: 'u1', role_in_room: 'roleA', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
        { id: 'p2', room_id: 'room-1', user_id: 'u2', role_in_room: 'roleB', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithOwnerAndRoleB);
    mockKickChatParticipantB.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const kickBtn = screen.getByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('移除失敗');
    });
  });

  it('kickChatParticipantB FORBIDDEN 且無 message 時應使用 kickFail（F07 權限邊界 fallback）', async () => {
    const roomWithOwnerAndRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p1', room_id: 'room-1', user_id: 'u1', role_in_room: 'roleA', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
        { id: 'p2', room_id: 'room-1', user_id: 'u2', role_in_room: 'roleB', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
      ],
    };
    mockGetChatRoom.mockResolvedValue(roomWithOwnerAndRoleB);
    mockKickChatParticipantB.mockRejectedValue({ code: 'FORBIDDEN' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const kickBtn = screen.getByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('移除失敗');
    });
  });

  it('kickChatParticipantB 失敗後應仍可再次點擊移除，成功後應顯示成功（F07 錯誤恢復：失敗不阻塞重試）', async () => {
    const roomWithOwnerAndRoleB = {
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p1', room_id: 'room-1', user_id: 'u1', role_in_room: 'roleA', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
        { id: 'p2', room_id: 'room-1', user_id: 'u2', role_in_room: 'roleB', is_active: true, joined_at: new Date().toISOString(), participant_type: 'user' },
      ],
    };
    const roomAfterKick = { ...roomWithOwnerAndRoleB, participants: [roomWithOwnerAndRoleB.participants[0]] };
    mockGetChatRoom
      .mockResolvedValueOnce(roomWithOwnerAndRoleB)
      .mockResolvedValueOnce(roomAfterKick);
    mockKickChatParticipantB
      .mockRejectedValueOnce(new Error('暫時無法移除'))
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    const kickBtn = screen.getByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
    });
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('暫時無法移除');
    });

    await act(async () => {
      fireEvent.click(kickBtn);
    });
    await waitFor(() => {
      expect(mockKickChatParticipantB).toHaveBeenCalledTimes(2);
      expect(antdMessage.success).toHaveBeenCalledWith('已移除 B 方');
    });
  });

  it('loadMoreHistory（listChatMessages 帶 cursor）FORBIDDEN 且無 message 時應使用 loadMoreFail（F07 權限邊界 fallback）', async () => {
    mockListChatMessages
      .mockResolvedValueOnce({
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
        nextCursor: 'cursor-1',
      })
      .mockRejectedValueOnce({ code: 'FORBIDDEN' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await waitFor(() => expect(mockListChatMessages).toHaveBeenCalledWith('room-1', expect.objectContaining({ limit: 50 })));

    const loadMoreBtn = await screen.findByRole('button', { name: '載入更多' });
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('載入更多訊息失敗');
    });
  });

  it('loadMoreHistory（listChatMessages 帶 cursor）失敗且 message 為空字串時應使用 loadMoreFail（F10 邊界）', async () => {
    mockListChatMessages
      .mockResolvedValueOnce({
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
        nextCursor: 'cursor-1',
      })
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await waitFor(() => expect(mockListChatMessages).toHaveBeenCalledWith('room-1', expect.objectContaining({ limit: 50 })));

    const loadMoreBtn = await screen.findByRole('button', { name: '載入更多' });
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('載入更多訊息失敗');
    });
  });

});
