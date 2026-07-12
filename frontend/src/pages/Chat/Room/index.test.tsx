import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const LoginCapture = () => {
  const location = useLocation();
  return <div data-testid="login-from">{location.state?.from?.pathname ?? 'none'}</div>;
};

const RoomNavigationButton = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>go room</button>;
};

const buildRoomWithRoleB = (roomId = 'room-1') => ({
  id: roomId,
  status: 'group_active',
  owner_user_id: 'u-owner',
  history_visibility_mode: 'share_summary_only',
  participants: [
    {
      id: `${roomId}-p-role-b`,
      room_id: roomId,
      user_id: 'u1',
      role_in_room: 'roleB',
      is_active: true,
      joined_at: new Date().toISOString(),
      participant_type: 'user',
    },
  ],
});

const buildOwnerRoomWithRoleB = (roomId = 'room-1') => ({
  id: roomId,
  status: 'group_active',
  owner_user_id: 'u1',
  history_visibility_mode: 'share_summary_only',
  participants: [
    {
      id: `${roomId}-p-role-a`,
      room_id: roomId,
      user_id: 'u1',
      role_in_room: 'roleA',
      is_active: true,
      joined_at: new Date().toISOString(),
      participant_type: 'user',
    },
    {
      id: `${roomId}-p-role-b`,
      room_id: roomId,
      user_id: 'u2',
      role_in_room: 'roleB',
      is_active: true,
      joined_at: new Date().toISOString(),
      participant_type: 'user',
    },
  ],
});

const buildOwnerSoloRoom = (roomId = 'room-1') => ({
  id: roomId,
  status: 'solo_active',
  owner_user_id: 'u1',
  history_visibility_mode: 'share_summary_only',
  participants: [],
});

describe('ChatRoomPage', () => {
  afterEach(async () => {
    vi.useRealTimers();
    // Flush any pending promise-driven updates (toast/portal, router, etc.)
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

  it('入口 route-level keyboard-only smoke：Tab focus order 可走過建立與邀請流程', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '建立聊天室' })).toHaveFocus();
    await user.tab();
    const inviteInput = screen.getByLabelText('邀請碼');
    expect(inviteInput).toHaveFocus();
    expect(inviteInput).toHaveAttribute('autocomplete', 'off');
    await user.tab();
    expect(screen.getByRole('button', { name: '用邀請碼加入' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '拒絕邀請' })).toHaveFocus();
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
    expect(toast.success).not.toHaveBeenCalled();
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

  it('createChatRoom 失敗且有 raw message 應顯示本地化 fallback', async () => {
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
      expect(screen.getByText('建立聊天室失敗')).toBeInTheDocument();
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
      expect(screen.getByText('服務器錯誤，請稍後再試')).toBeInTheDocument();
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
      expect(screen.getByText('AI服務暫時不可用，請稍後重試')).toBeInTheDocument();
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
      expect(screen.getByText('無權限訪問此資源')).toBeInTheDocument();
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
      expect(screen.getByText('建立聊天室失敗')).toBeInTheDocument();
    });
    expect(mockCreateChatRoom).toHaveBeenCalledTimes(1);

    const btn = screen.getByRole('button', { name: '建立聊天室' });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
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

  it('路由切換後舊入口 createChatRoom 成功不應導向舊建立房間（entry action 競態回歸）', async () => {
    let resolveCreate!: (room: unknown) => void;
    mockCreateChatRoom.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route
            path="/chat/room/:roomId?"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '建立聊天室' }));
    await waitFor(() => {
      expect(mockCreateChatRoom).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveCreate(buildOwnerSoloRoom('created-after-route-change'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/created-after-route-change/)).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('路由切換時舊房間初始化請求完成不應覆蓋新房間（F07 競態回歸）', async () => {
    let resolveRoomA!: (room: unknown) => void;
    mockGetChatRoom.mockImplementation((roomId: string) => {
      if (roomId === 'room-a') {
        return new Promise((resolve) => {
          resolveRoomA = resolve;
        });
      }
      return Promise.resolve({
        id: roomId,
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
    });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledWith('room-a');
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));

    await waitFor(() => {
      expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
    });

    await act(async () => {
      resolveRoomA({
        id: 'room-a',
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
      await Promise.resolve();
    });

    expect(screen.queryByText(/聊天室：room-a/)).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('路由切換時舊房間 refresh 請求完成不應覆蓋新房間（F07 SSE refresh 競態回歸）', async () => {
    const streamCallbacksByRoom: Record<string, { onEvent?: (event: unknown) => void }> = {};
    let roomAGetCount = 0;
    let resolveRoomARefresh!: (room: unknown) => void;

    mockConnectChatStream.mockImplementation(async (roomId: string, callbacks: { onEvent?: (event: unknown) => void }) => {
      streamCallbacksByRoom[roomId] = callbacks;
      return () => undefined;
    });
    mockGetChatRoom.mockImplementation((roomId: string) => {
      if (roomId === 'room-a') {
        roomAGetCount += 1;
        if (roomAGetCount === 2) {
          return new Promise((resolve) => {
            resolveRoomARefresh = resolve;
          });
        }
      }
      return Promise.resolve({
        id: roomId,
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
    });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    await waitFor(() => {
      expect(streamCallbacksByRoom['room-a']).toBeTruthy();
    });

    await act(async () => {
      streamCallbacksByRoom['room-a'].onEvent?.({ type: 'message', roomId: 'room-a' });
    });
    await waitFor(() => {
      expect(roomAGetCount).toBe(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveRoomARefresh({
        id: 'room-a',
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
      await Promise.resolve();
    });

    expect(screen.queryByText(/聊天室：room-a/)).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('路由切換後舊房間 stream event 不應再觸發舊房間 refresh（live update 競態回歸）', async () => {
    const streamCallbacksByRoom: Record<string, { onEvent?: (event: unknown) => void }> = {};
    const getRoomCalls: string[] = [];

    mockConnectChatStream.mockImplementation(async (roomId: string, callbacks: { onEvent?: (event: unknown) => void }) => {
      streamCallbacksByRoom[roomId] = callbacks;
      return () => undefined;
    });
    mockGetChatRoom.mockImplementation((roomId: string) => {
      getRoomCalls.push(roomId);
      return Promise.resolve({
        id: roomId,
        status: 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      });
    });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    await waitFor(() => {
      expect(streamCallbacksByRoom['room-a']).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);
    const roomACallsAfterSwitch = getRoomCalls.filter((roomId) => roomId === 'room-a').length;

    await act(async () => {
      streamCallbacksByRoom['room-a'].onEvent?.({ type: 'message', roomId: 'room-a' });
      await Promise.resolve();
    });

    expect(getRoomCalls.filter((roomId) => roomId === 'room-a')).toHaveLength(roomACallsAfterSwitch);
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('路由切換後應清理舊房間 composer reply/draft 與判決 preview 狀態（UI state 競態回歸）', async () => {
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));
    mockListChatMessages.mockImplementation((roomId: string) => Promise.resolve({
      messages: [
        {
          id: `msg-${roomId}`,
          content: `${roomId} message`,
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: new Date().toISOString(),
          sender_participant: { role_in_room: 'roleA' },
        },
      ],
      nextCursor: null,
    }));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    fireEvent.click(screen.getByRole('button', { name: '回覆' }));
    expect(screen.getByText('回覆訊息')).toBeInTheDocument();
    expect(screen.getAllByText('room-a message').length).toBeGreaterThan(1);

    fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
      target: { value: 'room-a draft' },
    });
    expect(screen.getByDisplayValue('room-a draft')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');

    fireEvent.click(screen.getByRole('button', { name: 'go room', hidden: true }));
    await screen.findByText(/聊天室：room-b/);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('回覆訊息')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('room-a draft')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('輸入訊息...')).toHaveValue('');
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
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('declineChatInvite 失敗且有 raw message 應顯示本地化 fallback', async () => {
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
      expect(toast.error).toHaveBeenCalledWith('拒絕邀請失敗');
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
      expect(toast.error).toHaveBeenCalledWith('服務器錯誤，請稍後再試');
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
      expect(toast.error).toHaveBeenCalledWith('服務器錯誤，請稍後再試');
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
      expect(toast.error).toHaveBeenCalledWith('無權限訪問此資源');
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
      expect(toast.error).toHaveBeenCalledWith('拒絕邀請失敗');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));
    });
    await waitFor(() => {
      expect(mockDeclineChatInvite).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('已拒絕邀請');
    });
  });

  it('路由切換後舊入口 declineChatInvite 成功不應顯示成功（entry action 競態回歸）', async () => {
    let resolveDecline!: (value: unknown) => void;
    mockDeclineChatInvite.mockImplementation(
      () => new Promise((resolve) => { resolveDecline = resolve; })
    );
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route
            path="/chat/room/:roomId?"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
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

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveDecline({ id: 'invite-1', status: 'declined' });
      await Promise.resolve();
    });

    expect(toast.success).not.toHaveBeenCalledWith('已拒絕邀請');
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
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

  it('拒絕邀請進行中時不應觸發接受邀請', async () => {
    let resolveDecline!: (value: unknown) => void;
    mockDeclineChatInvite.mockImplementation(
      () => new Promise((resolve) => { resolveDecline = resolve; })
    );
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
      fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
    });

    expect(mockDeclineChatInvite).toHaveBeenCalledTimes(1);
    expect(mockAcceptChatInvite).not.toHaveBeenCalled();

    await act(async () => {
      resolveDecline({ id: 'invite-1', status: 'declined' });
      await Promise.resolve();
    });
  });

  it('建立聊天室進行中時不應觸發接受或拒絕邀請', async () => {
    let resolveCreate!: (value: unknown) => void;
    mockCreateChatRoom.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
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
      fireEvent.click(screen.getByRole('button', { name: '建立聊天室' }));
      fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
      fireEvent.click(screen.getByRole('button', { name: '拒絕邀請' }));
    });

    expect(mockCreateChatRoom).toHaveBeenCalledTimes(1);
    expect(mockAcceptChatInvite).not.toHaveBeenCalled();
    expect(mockDeclineChatInvite).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate(buildOwnerSoloRoom('created-room'));
      await Promise.resolve();
    });
  });

  it('acceptChatInvite 失敗且有 raw message 應顯示本地化 fallback', async () => {
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
      expect(toast.error).toHaveBeenCalledWith('加入聊天室失敗');
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
      expect(toast.error).toHaveBeenCalledWith('服務器錯誤，請稍後再試');
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
      expect(toast.error).toHaveBeenCalledWith('加入聊天室失敗');
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
      expect(toast.error).toHaveBeenCalledWith('無權限訪問此資源');
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
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('路由切換後舊入口 acceptChatInvite 成功不應導向加入房間（entry action 競態回歸）', async () => {
    let resolveAccept!: (room: { id: string }) => void;
    mockAcceptChatInvite.mockImplementation(() => new Promise((resolve) => { resolveAccept = resolve; }));
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room']}>
        <Routes>
          <Route
            path="/chat/room/:roomId?"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
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

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveAccept({ id: 'joined-after-route-change' });
      await Promise.resolve();
    });

    expect(toast.success).not.toHaveBeenCalledWith('加入聊天室成功');
    expect(screen.queryByText(/joined-after-route-change/)).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
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
      expect(toast.error).toHaveBeenCalledWith('加入聊天室失敗');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '用邀請碼加入' }));
    });
    await waitFor(() => {
      expect(mockAcceptChatInvite).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('加入聊天室成功');
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });

    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledWith('room-1', expect.objectContaining({ content: 'hello' }));
    });
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('切換房間後舊房間 sendChatMessage 未完成不應阻塞新房間發送或寫入舊訊息（message action 競態回歸）', async () => {
    const sendResolvers = new Map<string, (message: unknown) => void>();
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockSendChatMessage.mockImplementation(
      (roomId: string) => new Promise((resolve) => {
        sendResolvers.set(roomId, resolve);
      })
    );

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId?"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'room-a-pending' },
      });
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });
    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'room-a',
        expect.objectContaining({ content: 'room-a-pending' })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'room-b-message' },
      });
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });

    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'room-b',
        expect.objectContaining({ content: 'room-b-message' })
      );
    });

    await act(async () => {
      sendResolvers.get('room-b')?.({
        id: 'msg-room-b',
        content: 'room-b-message',
        message_type: 'user_text',
        visibility_scope: 'all',
        created_at: new Date().toISOString(),
      });
      await Promise.resolve();
    });
    expect(screen.getByText('room-b-message')).toBeInTheDocument();

    await act(async () => {
      sendResolvers.get('room-a')?.({
        id: 'msg-room-a-stale',
        content: 'room-a-stale',
        message_type: 'user_text',
        visibility_scope: 'all',
        created_at: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('room-a-stale')).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('送出訊息失敗');
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: '重試的訊息' },
      });
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });
    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledTimes(2);
      expect(screen.getByText('重試的訊息')).toBeInTheDocument();
    });
  });

  it('sendChatMessage 失敗且有 raw message 應顯示本地化 fallback', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('送出訊息失敗');
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('送出訊息失敗');
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('送出訊息失敗');
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
      fireEvent.click(screen.getByRole('button', { name: '送出' }));
    });

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith('目前沒有發言權限');
    });
  });

  it('匿名 owner 且 canonical session_id 匹配時可建立邀請（F07 session 規則）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('emorapy_session_id', 'guest_owner_123');
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
    localStorage.setItem('emorapy_session_id', 'guest_other_123');
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
      expect(toast.warning).toHaveBeenCalledWith('Session 已過期或不一致，請刷新後重試');
    });
    expect(toast.error).not.toHaveBeenCalledWith('建立邀請失敗');
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
      expect(toast.warning).toHaveBeenCalledWith('Session 已過期或不一致，請刷新後重試');
    });
    expect(toast.error).not.toHaveBeenCalledWith('建立邀請失敗');
  });

  it('createChatInvite 失敗且有 raw message（非 CONFLICT）應顯示本地化 fallback', async () => {
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
      expect(toast.error).toHaveBeenCalledWith('建立邀請失敗');
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
      expect(toast.error).toHaveBeenCalledWith('建立邀請失敗');
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
      expect(toast.error).toHaveBeenCalledWith('建立邀請失敗');
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
      expect(toast.error).toHaveBeenCalledWith('建立邀請失敗');
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
      expect(toast.warning).toHaveBeenCalledWith('Session 已過期或不一致，請刷新後重試');
    });
    expect(toast.error).not.toHaveBeenCalledWith('建立邀請失敗');
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
    expect(toast.success).not.toHaveBeenCalled();
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
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
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
      expect(toast.error).toHaveBeenCalledWith('建立邀請失敗');
    });

    await act(async () => {
      fireEvent.click(inviteBtn);
    });
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('邀請建立成功');
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

  it('路由切換後舊房間 createChatInvite 成功不應寫入邀請碼或顯示成功（invite action 競態回歸）', async () => {
    let resolveCreateInvite!: (v: { id: string; invite_code: string }) => void;
    mockCreateChatInvite.mockImplementation(
      () => new Promise((resolve) => { resolveCreateInvite = resolve; })
    );
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    fireEvent.click(screen.getByRole('button', { name: '建立邀請' }));
    await waitFor(() => {
      expect(mockCreateChatInvite).toHaveBeenCalledWith('room-a', {
        history_visibility_mode: 'share_summary_only',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveCreateInvite({ id: 'invite-old', invite_code: 'OLD123' });
      await Promise.resolve();
    });

    expect(toast.success).not.toHaveBeenCalledWith('邀請建立成功');
    expect(screen.queryByText('邀請碼：OLD123')).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('切換房間時應清除上一個房間已建立的邀請碼', async () => {
    mockCreateChatInvite.mockResolvedValue({ id: 'invite-a', invite_code: 'ROOMA123' });
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '建立邀請' }));
    });
    await screen.findByText('邀請碼：ROOMA123');

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    expect(screen.queryByText('邀請碼：ROOMA123')).not.toBeInTheDocument();
  });

  it('createChatInvite 成功後刷新失敗不應回報建立邀請失敗', async () => {
    let getRoomCalls = 0;
    mockGetChatRoom.mockImplementation((roomId: string) => {
      getRoomCalls += 1;
      if (getRoomCalls === 2) {
        return Promise.reject(new Error('refresh failed'));
      }
      return Promise.resolve(buildOwnerSoloRoom(roomId));
    });
    mockCreateChatInvite.mockResolvedValue({ id: 'invite-1', invite_code: 'OK123' });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-1/);
    const beforeCalls = mockGetChatRoom.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '建立邀請' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('邀請建立成功');
      expect(screen.getByText('邀請碼：OK123')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockGetChatRoom.mock.calls.length).toBeGreaterThan(beforeCalls);
    });
    expect(toast.error).not.toHaveBeenCalledWith('建立邀請失敗');
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
      expect(screen.getByText('聊天室連線授權或狀態異常，已停止自動重試')).toBeInTheDocument();
    });
    expect(mockConnectChatStream).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 401, code: 'SESSION_EXPIRED', message: 'session-expired', expectedText: '聊天室連線授權或狀態異常，已停止自動重試' },
    { status: 403, code: 'FORBIDDEN', message: 'forbidden', expectedText: '無權限訪問此資源' },
    { status: 404, code: 'NOT_FOUND', message: 'not-found', expectedText: '資源不存在' },
    { status: 400, code: 'INVALID_SESSION_ID', message: 'invalid-session', expectedText: '聊天室連線授權或狀態異常，已停止自動重試' },
  ])('SSE 終態錯誤矩陣：$code 時不應重連', async ({ status, code, message, expectedText }) => {
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
      expect(screen.getByText(expectedText)).toBeInTheDocument();
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

  it('getChatRoom 失敗且有 raw message 應顯示本地化 fallback', async () => {
    mockGetChatRoom.mockRejectedValue(new Error('房間不存在或已封存'));
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

  it('getChatRoom FORBIDDEN 時若有 message 應顯示本地化 code fallback（F07 權限邊界）', async () => {
    mockGetChatRoom.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限進入此聊天室' });
    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('無權限訪問此資源')).toBeInTheDocument();
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
      expect(screen.getByText('無權限訪問此資源')).toBeInTheDocument();
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
      expect(screen.getByText('服務器錯誤，請稍後再試')).toBeInTheDocument();
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
      expect(screen.getByText('服務器錯誤，請稍後再試')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('chat-room-load-retry'));
    await waitFor(() => {
      expect(screen.getByText('服務器錯誤，請稍後再試')).toBeInTheDocument();
    });
    expect(mockGetChatRoom).toHaveBeenCalledTimes(2);

    const retryBtn = screen.getByTestId('chat-room-load-retry');
    await waitFor(() => {
      expect(retryBtn.closest('button')).not.toBeDisabled();
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
      expect(screen.getByText('服務器錯誤，請稍後再試')).toBeInTheDocument();
    });
    const retryBtn = screen.getByTestId('chat-room-load-retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetChatRoom).toHaveBeenCalledTimes(2); // initial + 1 retry (throttled)
    });
  });

  it('路由切換後舊房間 retry 請求完成不應覆蓋新房間（F07 retry 競態回歸）', async () => {
    let room1CallCount = 0;
    let resolveRoom1Retry!: (room: unknown) => void;
    mockGetChatRoom.mockImplementation((roomId: string) => {
      if (roomId === 'room-1') {
        room1CallCount += 1;
        if (room1CallCount === 1) {
          return Promise.reject({ code: 'SERVER_ERROR', message: '第一次失敗' });
        }
        return new Promise((resolve) => {
          resolveRoom1Retry = resolve;
        });
      }
      return Promise.resolve(buildOwnerSoloRoom(roomId));
    });
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('服務器錯誤，請稍後再試');

    fireEvent.click(screen.getByTestId('chat-room-load-retry'));
    await waitFor(() => {
      expect(room1CallCount).toBe(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveRoom1Retry(buildOwnerSoloRoom('room-1'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/聊天室：room-1/)).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('房間終態時應禁用建立邀請/發起梳理/發送訊息', async () => {
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
	    expect(screen.getByRole('button', { name: '發起梳理' })).toBeDisabled();
	    expect(screen.getByRole('button', { name: '送出' })).toBeDisabled();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('輸入訊息...'), {
        target: { value: 'should-not-send' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('輸入訊息...'), { key: 'Enter', code: 'Enter' });
    });
    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });

  it('安全通知應取得焦點並阻斷 judgment handoff，但保留對話輸入', async () => {
    mockListChatMessages.mockResolvedValueOnce({
      messages: [{
        id: 'safety-1',
        room_id: 'room-1',
        sender_participant_id: 'system',
        content: '請先確認當下安全',
        message_type: 'safety_notice',
        visibility_scope: 'all',
        safety_flag: true,
        created_at: '2026-07-12T10:00:00.000Z',
      }],
      nextCursor: null,
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const safetyInterruption = await screen.findByTestId('chat-safety-interruption');
    expect(safetyInterruption).toHaveFocus();
    expect(screen.getByRole('button', { name: '發起梳理' })).toBeDisabled();
    expect(screen.getByPlaceholderText('輸入訊息...')).toBeEnabled();
  });

  it('未登入時 chat 發起梳理成功後應先被導向 login，並保留 judgment 回跳目標（F07 -> F04 handoff）', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, _hasHydrated: true } as any);
    localStorage.setItem('emorapy_session_id', 'guest_owner_123');
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });

    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-from')).toHaveTextContent('/judgment/judgment-from-chat');
    });
  });

  it('發起梳理時只應提交 user_text 訊息 id，不應把 AI 訊息帶進 included_message_ids（P04 回歸）', async () => {
    mockRequestChatJudgment.mockResolvedValue({
      judgmentId: 'judgment-user-only',
      roomId: 'room-1',
      status: 'judgment_requested',
    });
    mockListChatMessages.mockResolvedValueOnce({
      messages: [
        {
          id: 'msg-user-1',
          content: 'role-a-message',
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: new Date().toISOString(),
          sender_participant: { role_in_room: 'roleA' },
        },
        {
          id: 'msg-ai-1',
          content: 'ai-summary',
          message_type: 'ai_text',
          visibility_scope: 'all',
          created_at: new Date().toISOString(),
          sender_participant: { role_in_room: 'aiMediator' },
        },
        {
          id: 'msg-user-2',
          content: 'role-b-message',
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: new Date().toISOString(),
          sender_participant: { role_in_room: 'roleB' },
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });

    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalledWith('room-1', {
        included_message_ids: ['msg-user-1', 'msg-user-2'],
      });
    });
    expect(screen.queryByText('ai-summary')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalled();
    });
    unmount();
    resolveRequest!({ roomId: 'room-1', status: 'judgment_requested' });
    await Promise.resolve();
    expect(toast.success).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalled();
    });
    unmount();
    rejectRequest!(new Error('判決服務暫時不可用'));
    await Promise.resolve();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('發起梳理快速連點只會送出一次請求', async () => {
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

		    const button = screen.getByRole('button', { name: '發起梳理' });
		    await act(async () => {
		      fireEvent.click(button);
		      fireEvent.click(button);
		    });

	    await screen.findByText('轉梳理前確認');
		    const dialog = await screen.findByRole('dialog');
		    const confirm = within(dialog).getByRole('button', { name: '確認' });
		    await act(async () => {
		      fireEvent.click(confirm);
		      fireEvent.click(confirm);
		    });
		    await waitFor(() => {
		      expect(mockRequestChatJudgment).toHaveBeenCalledTimes(1);
		    });
		  });

  it('requestChatJudgment 成功但尚無 judgmentId 時應保持 pending，避免再次發起梳理', async () => {
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    await screen.findByText('聊天室：room-1');
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });

    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('已發起梳理，正在等待結果');
    });

    expect(screen.getByRole('button', { name: /發起梳理/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /發起梳理/ }));
    expect(mockRequestChatJudgment).toHaveBeenCalledTimes(1);
  });

  it('路由切換後舊房間判決 polling 結果不應導向舊判決（F07 polling 競態回歸）', async () => {
    let resolveStatus!: (status: unknown) => void;
    let judgmentTick: (() => void | Promise<void>) | null = null;
    let intervalId = 1;
    const realSetInterval = globalThis.setInterval;
    const realClearInterval = globalThis.clearInterval;
    vi.spyOn(globalThis, 'setInterval').mockImplementation((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 4000 && typeof handler === 'function') {
        const id = intervalId;
        intervalId += 1;
        judgmentTick = () => handler(...args);
        return id as unknown as ReturnType<typeof setInterval>;
      }
      return realSetInterval(handler, timeout, ...args);
    });
    vi.spyOn(globalThis, 'clearInterval').mockImplementation((id?: Parameters<typeof clearInterval>[0]) => {
      if (typeof id === 'number' && id < intervalId) return;
      return realClearInterval(id);
    });
    mockGetChatRoom.mockImplementation((roomId: string) =>
      Promise.resolve({
        id: roomId,
        status: roomId === 'room-a' ? 'judgment_requested' : 'solo_active',
        owner_user_id: 'u1',
        history_visibility_mode: 'share_summary_only',
        participants: [],
      })
    );
    mockListChatMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockGetChatJudgmentStatus.mockImplementation(
      () => new Promise((resolve) => { resolveStatus = resolve; })
    );

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
          <Route path="/judgment/:judgmentId" element={<div>judgment page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    await waitFor(() => {
      expect(judgmentTick).toBeTruthy();
    });

    await act(async () => {
      judgmentTick!();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockGetChatJudgmentStatus).toHaveBeenCalledWith('room-a');
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveStatus({
        roomStatus: 'judgment_completed',
        latestLink: {
          id: 'link-old',
          judgment: {
            id: 'judgment-old',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        },
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('judgment page')).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('requestChatJudgment 失敗後應仍可再次點擊確認發起梳理，成功後應導向判決頁（F07 錯誤恢復：失敗不阻塞重試）', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    let dialog = await screen.findByRole('dialog');
    let confirm = within(dialog).getByRole('button', { name: '確認' });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('發起梳理失敗');
    });

    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    dialog = await screen.findByRole('dialog');
    confirm = within(dialog).getByRole('button', { name: '確認' });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockRequestChatJudgment).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('requestChatJudgment 失敗且有 raw message（非 CONFLICT/INVALID_SESSION）應顯示本地化 fallback', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('發起梳理失敗');
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('發起梳理失敗');
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('發起梳理失敗');
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
    fireEvent.click(screen.getByRole('button', { name: '發起梳理' }));
    await screen.findByText('轉梳理前確認');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    await act(async () => {
      fireEvent.click(confirm);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('發起梳理失敗');
    });
  });

  it('leaveChatRoom 失敗且有 raw message 應顯示本地化 fallback', async () => {
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
      expect(toast.error).toHaveBeenCalledWith('離開失敗');
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
      expect(toast.error).toHaveBeenCalledWith('無權限訪問此資源');
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
      expect(toast.error).toHaveBeenCalledWith('無權限訪問此資源');
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
    expect(toast.success).not.toHaveBeenCalled();
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
    expect(toast.error).not.toHaveBeenCalled();
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
      expect(toast.error).toHaveBeenCalledWith('離開失敗');
    });

    await act(async () => {
      fireEvent.click(leaveBtn);
    });
    await waitFor(() => {
      expect(mockLeaveChatRoom).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('已離開聊天室');
    });
  });

  it('leaveChatRoom 快速連點只會送出一次請求（participant action 重入保護）', async () => {
    mockGetChatRoom.mockResolvedValue(buildRoomWithRoleB());
    let resolveLeave!: () => void;
    mockLeaveChatRoom.mockImplementation(() => new Promise<void>((resolve) => { resolveLeave = resolve; }));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room" element={<ChatRoomPage />} />
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const leaveBtn = await screen.findByRole('button', { name: '離開聊天室' });
    await act(async () => {
      fireEvent.click(leaveBtn);
      fireEvent.click(leaveBtn);
    });

    expect(mockLeaveChatRoom).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveLeave();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('已離開聊天室');
    });
  });

  it('路由切換後舊房間 leaveChatRoom 成功不應導回入口或顯示成功（participant action 競態回歸）', async () => {
    let resolveLeave!: () => void;
    mockLeaveChatRoom.mockImplementation(() => new Promise<void>((resolve) => { resolveLeave = resolve; }));
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(
      roomId === 'room-a' ? buildRoomWithRoleB('room-a') : buildOwnerSoloRoom(roomId)
    ));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
          <Route path="/chat/room" element={<div>entry page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    fireEvent.click(screen.getByRole('button', { name: '離開聊天室' }));
    await waitFor(() => {
      expect(mockLeaveChatRoom).toHaveBeenCalledWith('room-a');
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveLeave();
      await Promise.resolve();
    });

    expect(toast.success).not.toHaveBeenCalledWith('已離開聊天室');
    expect(screen.queryByText('entry page')).not.toBeInTheDocument();
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
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
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('kickChatParticipantB 失敗且有 raw message 應顯示本地化 fallback', async () => {
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
      expect(toast.error).toHaveBeenCalledWith('移除失敗');
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
      expect(toast.error).toHaveBeenCalledWith('服務器錯誤，請稍後再試');
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
      expect(toast.error).toHaveBeenCalledWith('服務器錯誤，請稍後再試');
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
      expect(toast.error).toHaveBeenCalledWith('無權限訪問此資源');
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
      expect(toast.error).toHaveBeenCalledWith('移除失敗');
    });

    await act(async () => {
      fireEvent.click(kickBtn);
    });
    await waitFor(() => {
      expect(mockKickChatParticipantB).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('已移除 B 方');
    });
  });

  it('kickChatParticipantB 快速連點只會送出一次請求（participant action 重入保護）', async () => {
    mockGetChatRoom.mockResolvedValue(buildOwnerRoomWithRoleB());
    let resolveKick!: () => void;
    mockKickChatParticipantB.mockImplementation(() => new Promise<void>((resolve) => { resolveKick = resolve; }));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const kickBtn = await screen.findByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
      fireEvent.click(kickBtn);
    });

    expect(mockKickChatParticipantB).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveKick();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('已移除 B 方');
    });
  });

  it('路由切換後舊房間 kickChatParticipantB 成功不應顯示成功（participant action 競態回歸）', async () => {
    let resolveKick!: () => void;
    mockKickChatParticipantB.mockImplementation(() => new Promise<void>((resolve) => { resolveKick = resolve; }));
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(
      roomId === 'room-a' ? buildOwnerRoomWithRoleB('room-a') : buildOwnerSoloRoom(roomId)
    ));

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/聊天室：room-a/);
    fireEvent.click(screen.getByRole('button', { name: '移除 B 方' }));
    await waitFor(() => {
      expect(mockKickChatParticipantB).toHaveBeenCalledWith('room-a');
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText(/聊天室：room-b/);

    await act(async () => {
      resolveKick();
      await Promise.resolve();
    });

    expect(toast.success).not.toHaveBeenCalledWith('已移除 B 方');
    expect(screen.getByText(/聊天室：room-b/)).toBeInTheDocument();
  });

  it('kickChatParticipantB 成功後刷新失敗不應回報移除失敗', async () => {
    mockGetChatRoom
      .mockResolvedValueOnce(buildOwnerRoomWithRoleB())
      .mockRejectedValueOnce(new Error('refresh failed'));
    mockKickChatParticipantB.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/chat/room/room-1']}>
        <Routes>
          <Route path="/chat/room/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledWith('room-1'));
    const kickBtn = await screen.findByRole('button', { name: '移除 B 方' });
    await act(async () => {
      fireEvent.click(kickBtn);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('已移除 B 方');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(toast.error).not.toHaveBeenCalledWith('移除失敗');
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
      expect(toast.error).toHaveBeenCalledWith('無權限訪問此資源');
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
      expect(toast.error).toHaveBeenCalledWith('服務器錯誤，請稍後再試');
    });
  });

  it('切換房間後舊房間 loadMoreHistory 完成不應寫入新房間（history navigation 競態回歸）', async () => {
    let resolveOldLoadMore!: (value: unknown) => void;
    mockGetChatRoom.mockImplementation((roomId: string) => Promise.resolve(buildOwnerSoloRoom(roomId)));
    mockListChatMessages.mockImplementation((roomId: string, params?: { cursor?: string }) => {
      if (roomId === 'room-a' && !params?.cursor) {
        return Promise.resolve({
          messages: [
            {
              id: 'msg-room-a-new',
              content: 'room-a-new',
              message_type: 'user_text',
              visibility_scope: 'all',
              created_at: new Date('2026-04-18T11:15:41.592Z').toISOString(),
              sender_participant: { role_in_room: 'roleA' },
            },
          ],
          nextCursor: 'cursor-room-a',
        });
      }
      if (roomId === 'room-a' && params?.cursor === 'cursor-room-a') {
        return new Promise((resolve) => { resolveOldLoadMore = resolve; });
      }
      if (roomId === 'room-b') {
        return Promise.resolve({
          messages: [
            {
              id: 'msg-room-b-new',
              content: 'room-b-new',
              message_type: 'user_text',
              visibility_scope: 'all',
              created_at: new Date('2026-04-18T11:16:41.592Z').toISOString(),
              sender_participant: { role_in_room: 'roleA' },
            },
          ],
          nextCursor: null,
        });
      }
      return Promise.resolve({ messages: [], nextCursor: null });
    });

    render(
      <MemoryRouter initialEntries={['/chat/room/room-a']}>
        <Routes>
          <Route
            path="/chat/room/:roomId?"
            element={(
              <>
                <RoomNavigationButton to="/chat/room/room-b" />
                <ChatRoomPage />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('room-a-new');
    const loadMoreBtn = await screen.findByRole('button', { name: '載入更多' });
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });
    await waitFor(() => {
      expect(mockListChatMessages).toHaveBeenCalledWith('room-a', { cursor: 'cursor-room-a', limit: 50 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'go room' }));
    await screen.findByText('room-b-new');

    await act(async () => {
      resolveOldLoadMore({
        messages: [
          {
            id: 'msg-room-a-old',
            content: 'room-a-old-should-not-appear',
            message_type: 'user_text',
            visibility_scope: 'all',
            created_at: new Date('2026-04-18T11:14:41.592Z').toISOString(),
            sender_participant: { role_in_room: 'roleA' },
          },
        ],
        nextCursor: null,
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('room-a-old-should-not-appear')).not.toBeInTheDocument();
    expect(screen.getByText('room-b-new')).toBeInTheDocument();
  });

  it('載入更多歷史訊息不應重新觸發整個房間初始化（P04 匿名房間 loading 回歸）', async () => {
    mockListChatMessages
      .mockResolvedValueOnce({
        messages: [
          {
            id: 'msg-2',
            content: 'newest',
            message_type: 'user_text',
            visibility_scope: 'all',
            created_at: new Date('2026-04-18T11:15:41.592Z').toISOString(),
            sender_participant: { role_in_room: 'roleA' },
          },
        ],
        nextCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        messages: [
          {
            id: 'msg-1',
            content: 'older',
            message_type: 'user_text',
            visibility_scope: 'all',
            created_at: new Date('2026-04-18T11:15:33.034Z').toISOString(),
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

    await waitFor(() => expect(mockGetChatRoom).toHaveBeenCalledTimes(1));
    await screen.findByText('聊天室：room-1');

    const loadMoreBtn = await screen.findByRole('button', { name: '載入更多' });
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    await waitFor(() => {
      expect(mockListChatMessages).toHaveBeenCalledTimes(2);
    });
    await screen.findByText('older');
    expect(mockGetChatRoom).toHaveBeenCalledTimes(1);
  });

});
