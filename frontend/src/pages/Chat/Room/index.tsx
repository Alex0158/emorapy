import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { t } from '@/utils/i18n';
import {
  acceptChatInvite,
  connectChatStream,
  createChatInvite,
  createChatRoom,
  declineChatInvite,
  getChatJudgmentStatus,
  getChatRoom,
  listChatMessages,
  requestChatJudgment,
  sendChatMessage,
} from '@/services/api/chat';
import type { ChatMessage, ChatRoom, ChatRoomStatus } from '@/types/chat';
import './index.less';

const { Title, Text, Paragraph } = Typography;

const ROOM_STATUS_COLOR: Partial<Record<ChatRoomStatus, string>> = {
  solo_active: 'blue',
  invite_pending: 'gold',
  invite_accepted: 'cyan',
  group_active: 'green',
  judgment_requested: 'orange',
  judgment_completed: 'success',
  judgment_failed: 'error',
  archived: 'default',
};

const ChatRoomPage = () => {
  const navigate = useNavigate();
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [decliningInvite, setDecliningInvite] = useState(false);
  const [sending, setSending] = useState(false);
  const [judging, setJudging] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [visibilityMode, setVisibilityMode] = useState<'share_full_history' | 'share_summary_only' | 'share_from_join_time'>(
    'share_full_history'
  );
  const [errorText, setErrorText] = useState('');

  const judgmentPollingRef = useRef<number | null>(null);
  const judgmentPollingAttemptsRef = useRef(0);
  const judgmentPollingRoomIdRef = useRef<string | null>(null);
  const roomPollingRef = useRef<number | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const streamRetryRef = useRef<number | null>(null);
  const roomRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const roomRefreshQueuedRef = useRef(false);
  const createRoomLockRef = useRef(false);
  const joinInviteLockRef = useRef(false);
  const declineInviteLockRef = useRef(false);
  const sendMessageLockRef = useRef(false);
  const createInviteLockRef = useRef(false);
  const requestJudgmentLockRef = useRef(false);

  const clearRoomPolling = useCallback(() => {
    if (roomPollingRef.current) {
      window.clearInterval(roomPollingRef.current);
      roomPollingRef.current = null;
    }
  }, []);

  const clearJudgmentPolling = useCallback(() => {
    if (judgmentPollingRef.current) {
      window.clearInterval(judgmentPollingRef.current);
      judgmentPollingRef.current = null;
    }
    judgmentPollingAttemptsRef.current = 0;
    judgmentPollingRoomIdRef.current = null;
  }, []);

  const clearStreamRetry = useCallback(() => {
    if (streamRetryRef.current) {
      window.clearTimeout(streamRetryRef.current);
      streamRetryRef.current = null;
    }
  }, []);

  const isTerminalStreamError = useCallback((error: { code?: string; status?: number }) => {
    if (error.status && [400, 401, 403, 404].includes(error.status)) {
      return true;
    }
    if (error.code && ['INVALID_SESSION_ID', 'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND'].includes(error.code)) {
      return true;
    }
    return false;
  }, []);

  const isRoomTerminalStatus = useCallback((status?: ChatRoomStatus) => {
    return status === 'judgment_completed' || status === 'judgment_failed' || status === 'archived';
  }, []);

  const loadRoom = useCallback(async (targetRoomId: string) => {
    const [fetchedRoom, fetchedMessages] = await Promise.all([
      getChatRoom(targetRoomId),
      listChatMessages(targetRoomId, { limit: 50 }),
    ]);
    setRoom(fetchedRoom);
    setMessages(fetchedMessages.messages);
  }, []);

  const refreshRoomSafely = useCallback(async (targetRoomId: string) => {
    if (roomRefreshInFlightRef.current) {
      roomRefreshQueuedRef.current = true;
      return roomRefreshInFlightRef.current;
    }
    const run = async () => {
      while (true) {
        roomRefreshQueuedRef.current = false;
        await loadRoom(targetRoomId);
        if (!roomRefreshQueuedRef.current) {
          break;
        }
      }
    };
    const promise = run()
      .finally(() => {
        roomRefreshInFlightRef.current = null;
        if (roomRefreshQueuedRef.current) {
          roomRefreshQueuedRef.current = false;
          void refreshRoomSafely(targetRoomId);
        }
      });
    roomRefreshInFlightRef.current = promise;
    return promise;
  }, [loadRoom]);

  const ensureRoomPolling = useCallback((targetRoomId: string) => {
    if (roomPollingRef.current) return;
    roomPollingRef.current = window.setInterval(() => {
      refreshRoomSafely(targetRoomId).catch(() => undefined);
    }, 8000);
  }, [refreshRoomSafely]);

  const tryStartJudgmentPolling = useCallback((targetRoomId: string) => {
    if (judgmentPollingRoomIdRef.current === targetRoomId && judgmentPollingRef.current) {
      return;
    }
    clearJudgmentPolling();
    judgmentPollingAttemptsRef.current = 0;
    judgmentPollingRoomIdRef.current = targetRoomId;
    judgmentPollingRef.current = window.setInterval(async () => {
      try {
        judgmentPollingAttemptsRef.current += 1;
        if (judgmentPollingAttemptsRef.current > 90) {
          clearJudgmentPolling();
          setJudging(false);
          requestJudgmentLockRef.current = false;
          message.warning(t('chat.message.judgmentPollingTimeout'));
          return;
        }
        const status = await getChatJudgmentStatus(targetRoomId);
        if (status.latestLink?.judgment?.id) {
          clearJudgmentPolling();
          message.success(t('chat.message.judgmentReady'));
          navigate(`/judgment/${status.latestLink.judgment.id}`);
          return;
        }
        if (status.roomStatus === 'judgment_failed') {
          clearJudgmentPolling();
          setJudging(false);
          message.warning(t('chat.message.judgmentFailed'));
        }
      } catch {
        // keep polling, avoid interrupting user flow
      }
    }, 4000);
  }, [clearJudgmentPolling, navigate]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!routeRoomId) {
        setRoom(null);
        setMessages([]);
        setErrorText('');
        clearRoomPolling();
        clearJudgmentPolling();
        streamCleanupRef.current?.();
        streamCleanupRef.current = null;
        clearStreamRetry();
        return;
      }
      setLoading(true);
      setErrorText('');
      try {
        await refreshRoomSafely(routeRoomId);
        if (!cancelled) {
          clearRoomPolling();
          ensureRoomPolling(routeRoomId);
        }
      } catch (error) {
        const err = error as { message?: string };
        if (!cancelled) {
          setErrorText(err.message || t('chat.message.loadFail'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void init();
    return () => {
      cancelled = true;
      clearRoomPolling();
      clearJudgmentPolling();
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
      clearStreamRetry();
    };
  }, [routeRoomId, clearJudgmentPolling, clearRoomPolling, refreshRoomSafely, ensureRoomPolling, clearStreamRetry]);

  useEffect(() => {
    if (!routeRoomId) return;
    let cancelled = false;
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    clearStreamRetry();

    const bindStream = async (retryCount = 0) => {
      const scheduleReconnect = (retryFrom: number, errorMessage?: string) => {
        if (errorMessage) {
          setErrorText(errorMessage);
        }
        ensureRoomPolling(routeRoomId);
        const nextRetry = Math.min(10000, 1000 * Math.max(1, retryFrom + 1));
        clearStreamRetry();
        streamRetryRef.current = window.setTimeout(() => {
          if (cancelled) return;
          void bindStream(retryFrom + 1);
        }, nextRetry);
      };

      let cleanup: () => void;
      try {
        cleanup = await connectChatStream(routeRoomId, {
          onEvent: (event) => {
            if (cancelled) return;
            if (event.type === 'ready') {
              clearRoomPolling();
              setErrorText('');
              return;
            }
            if (event.type === 'message' || event.type === 'invite' || event.type === 'room_status') {
              void refreshRoomSafely(routeRoomId);
            }
          },
          onError: (streamError) => {
            if (cancelled) return;
            if (isTerminalStreamError(streamError)) {
              clearStreamRetry();
              clearRoomPolling();
              setErrorText(streamError.message || t('chat.message.streamTerminalError'));
              return;
            }
            scheduleReconnect(retryCount, streamError.message || t('chat.message.streamFail'));
          },
        onClose: () => {
          if (cancelled) return;
          scheduleReconnect(retryCount, t('chat.message.streamClosedRetry'));
        },
        });
      } catch (error) {
        if (cancelled) return;
        const err = error as { message?: string };
        scheduleReconnect(retryCount, err.message || t('chat.message.streamFail'));
        return;
      }
      if (cancelled) {
        cleanup();
        return;
      }
      streamCleanupRef.current = cleanup;
    };

    void bindStream();
    return () => {
      cancelled = true;
      clearStreamRetry();
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
    };
  }, [clearRoomPolling, clearStreamRetry, ensureRoomPolling, isTerminalStreamError, refreshRoomSafely, routeRoomId]);

  useEffect(() => {
    if (!room?.id) return;
    if (room.status === 'judgment_requested') {
      setJudging(true);
      if (judgmentPollingRoomIdRef.current !== room.id || !judgmentPollingRef.current) {
        tryStartJudgmentPolling(room.id);
      }
      return;
    }
    if (room.status === 'judgment_completed' || room.status === 'judgment_failed') {
      setJudging(false);
      requestJudgmentLockRef.current = false;
      clearJudgmentPolling();
    }
  }, [clearJudgmentPolling, room?.id, room?.status, tryStartJudgmentPolling]);

  const handleCreateRoom = useCallback(async () => {
    if (createRoomLockRef.current) return;
    createRoomLockRef.current = true;
    setCreatingRoom(true);
    setErrorText('');
    try {
      const created = await createChatRoom(visibilityMode);
      setRoom(created);
      setLastInviteCode('');
      navigate(`/chat/room/${created.id}`);
    } catch (error) {
      const err = error as { message?: string };
      setErrorText(err.message || t('chat.message.createRoomFail'));
    } finally {
      setCreatingRoom(false);
      createRoomLockRef.current = false;
    }
  }, [navigate, visibilityMode]);

  const handleAcceptInvite = useCallback(async () => {
    if (decliningInvite || declineInviteLockRef.current) return;
    const inviteCode = inviteCodeInput.trim();
    if (!inviteCode) {
      message.warning(t('chat.message.inviteCodeRequired'));
      return;
    }
    if (joinInviteLockRef.current) return;
    joinInviteLockRef.current = true;
    setJoiningInvite(true);
    try {
      const joined = await acceptChatInvite(inviteCode);
      setErrorText('');
      message.success(t('chat.message.joinSuccess'));
      navigate(`/chat/room/${joined.id}`);
    } catch (error) {
      const err = error as { message?: string };
      message.error(err.message || t('chat.message.joinFail'));
    } finally {
      setJoiningInvite(false);
      joinInviteLockRef.current = false;
    }
  }, [decliningInvite, inviteCodeInput, navigate]);

  const handleDeclineInvite = useCallback(async () => {
    if (joiningInvite || joinInviteLockRef.current) return;
    const inviteCode = inviteCodeInput.trim();
    if (!inviteCode) {
      message.warning(t('chat.message.inviteCodeRequired'));
      return;
    }
    if (declineInviteLockRef.current) return;
    declineInviteLockRef.current = true;
    setDecliningInvite(true);
    try {
      await declineChatInvite(inviteCode);
      setErrorText('');
      message.success(t('chat.message.declineSuccess'));
    } catch (error) {
      const err = error as { message?: string };
      message.error(err.message || t('chat.message.declineFail'));
    } finally {
      setDecliningInvite(false);
      declineInviteLockRef.current = false;
    }
  }, [inviteCodeInput, joiningInvite]);

  const handleSendMessage = useCallback(async () => {
    if (!room?.id) return;
    if (sendMessageLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    const content = messageInput.trim();
    if (!content) return;
    sendMessageLockRef.current = true;
    setSending(true);
    try {
      const sent = await sendChatMessage(room.id, { content });
      setMessages((prev) => [...prev, sent]);
      setMessageInput('');
      setErrorText('');
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'FORBIDDEN') {
        message.warning(t('chat.message.forbidden'));
      } else {
        message.error(err.message || t('chat.message.sendFail'));
      }
    } finally {
      setSending(false);
      sendMessageLockRef.current = false;
    }
  }, [isRoomTerminalStatus, messageInput, room?.id, room?.status]);

  const handleCreateInvite = useCallback(async () => {
    if (!room?.id) return;
    if (createInviteLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    createInviteLockRef.current = true;
    setCreatingInvite(true);
    try {
      const invite = await createChatInvite(room.id, { history_visibility_mode: visibilityMode });
      setLastInviteCode(invite.invite_code || '');
      setErrorText('');
      await refreshRoomSafely(room.id);
      message.success(t('chat.message.createInviteSuccess'));
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'CONFLICT') {
        message.warning(t('chat.message.conflictRefresh'));
        await refreshRoomSafely(room.id).catch(() => undefined);
        return;
      }
      message.error(err.message || t('chat.message.createInviteFail'));
    } finally {
      setCreatingInvite(false);
      createInviteLockRef.current = false;
    }
  }, [isRoomTerminalStatus, refreshRoomSafely, room?.id, room?.status, visibilityMode]);

  const handleRequestJudgment = useCallback(async () => {
    if (!room?.id) return;
    if (requestJudgmentLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    requestJudgmentLockRef.current = true;
    setJudging(true);
    try {
      const result = await requestChatJudgment(room.id);
      setErrorText('');
      message.success(t('chat.message.judgmentRequested'));
      if (result.judgmentId) {
        navigate(`/judgment/${result.judgmentId}`);
        return;
      }
      tryStartJudgmentPolling(room.id);
      await refreshRoomSafely(room.id);
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'CONFLICT') {
        message.warning(t('chat.message.conflictRefresh'));
        await refreshRoomSafely(room.id).catch(() => undefined);
      } else if (err.code === 'INVALID_SESSION_ID') {
        message.warning(t('chat.message.invalidSession'));
      } else {
        message.error(err.message || t('chat.message.judgmentFail'));
      }
      setJudging(false);
      requestJudgmentLockRef.current = false;
    }
  }, [isRoomTerminalStatus, refreshRoomSafely, navigate, room?.id, room?.status, tryStartJudgmentPolling]);

  const statusTag = useMemo(() => {
    if (!room?.status) return null;
    return (
      <Tag color={ROOM_STATUS_COLOR[room.status] || 'default'}>
        {t(`chat.status.${room.status}`)}
      </Tag>
    );
  }, [room?.status]);

  const roomStatus = room?.status;
  const isRoomTerminal = isRoomTerminalStatus(roomStatus);
  const disableCreateInvite = !room?.id || creatingInvite || isRoomTerminal || roomStatus === 'judgment_requested';
  const disableRequestJudgment = !room?.id || judging || isRoomTerminal || roomStatus === 'judgment_requested';
  const disableSendMessage = !room?.id || sending || isRoomTerminal || roomStatus === 'judgment_requested';

  if (!routeRoomId) {
    return (
      <div className="chat-room-page">
        <Card className="chat-room-page__panel">
          <Title level={3}>{t('chat.title')}</Title>
          <Paragraph type="secondary">{t('chat.subtitle')}</Paragraph>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Select
              value={visibilityMode}
              onChange={(value) => setVisibilityMode(value)}
              options={[
                { value: 'share_full_history', label: t('chat.visibility.share_full_history') },
                { value: 'share_summary_only', label: t('chat.visibility.share_summary_only') },
                { value: 'share_from_join_time', label: t('chat.visibility.share_from_join_time') },
              ]}
            />
            <Button type="primary" loading={creatingRoom} onClick={handleCreateRoom}>
              {t('chat.createRoom')}
            </Button>
            <Input
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder={t('chat.inviteCodePlaceholder')}
            />
            <Button loading={joiningInvite} onClick={handleAcceptInvite}>
              {t('chat.joinByInvite')}
            </Button>
            <Button loading={decliningInvite} onClick={handleDeclineInvite}>
              {t('chat.declineInvite')}
            </Button>
            {errorText ? <Alert type="error" title={errorText} showIcon /> : null}
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="chat-room-page">
      <Card className="chat-room-page__panel">
        {loading ? (
          <div className="chat-room-page__loading">
            <Spin />
          </div>
        ) : (
          <>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Title level={4} style={{ margin: 0 }}>
                  {t('chat.roomLabel').replace('{roomId}', room?.id || routeRoomId)}
                </Title>
                {statusTag}
              </Space>
              {errorText ? <Alert type="error" showIcon title={errorText} /> : null}
              {lastInviteCode ? (
                <Alert
                  type="success"
                  showIcon
                  title={t('chat.inviteCodeLabel').replace('{code}', lastInviteCode)}
                />
              ) : null}
              <Space wrap>
                <Button disabled={disableCreateInvite} loading={creatingInvite} onClick={handleCreateInvite}>
                  {t('chat.createInvite')}
                </Button>
                <Button type="primary" disabled={disableRequestJudgment} loading={judging} onClick={handleRequestJudgment}>
                  {t('chat.requestJudgment')}
                </Button>
                <Button onClick={() => navigate('/chat/room')}>{t('chat.leaveRoom')}</Button>
              </Space>
            </Space>

            <div className="chat-room-page__messages">
              {messages.length === 0 ? (
                <Text type="secondary">{t('chat.emptyMessages')}</Text>
              ) : (
                messages.map((item) => (
                  <div key={item.id} className="chat-room-page__message-item">
                    <Text strong>{item.message_type}</Text>
                    <Paragraph style={{ margin: '4px 0 0' }}>{item.content}</Paragraph>
                    <Text type="secondary">{new Date(item.created_at).toLocaleString()}</Text>
                  </div>
                ))
              )}
            </div>

            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={messageInput}
                maxLength={2000}
                onChange={(e) => setMessageInput(e.target.value)}
                onPressEnter={handleSendMessage}
                placeholder={t('chat.messagePlaceholder')}
              />
              <Button type="primary" disabled={disableSendMessage} loading={sending} onClick={handleSendMessage}>
                {t('chat.send')}
              </Button>
            </Space.Compact>
          </>
        )}
      </Card>
    </div>
  );
};

export default ChatRoomPage;

