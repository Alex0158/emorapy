import { useEffect } from 'react';
import { connectChatChannelStream } from '@/services/api/chat';
import { getRoomStreamRetryDelayMs, isTerminalStreamError } from '../chatRoomUtils';

interface UseChatPrivateChannelUpdatesInput {
  roomId: string | null;
  privateChannelId: string | null;
  refreshRoomSafely: (roomId: string) => Promise<void>;
}

export function useChatPrivateChannelUpdates({
  roomId,
  privateChannelId,
  refreshRoomSafely,
}: UseChatPrivateChannelUpdatesInput) {
  useEffect(() => {
    if (!roomId || !privateChannelId) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    };
    const clearPolling = () => {
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = null;
    };
    const ensurePolling = () => {
      if (pollingTimer) return;
      pollingTimer = setInterval(() => {
        void refreshRoomSafely(roomId);
      }, 8_000);
    };

    const connect = async (retryCount = 0) => {
      cleanup?.();
      cleanup = null;
      try {
        const nextCleanup = await connectChatChannelStream(privateChannelId, {
          onEvent: (event) => {
            if (cancelled) return;
            if (event.type === 'ready') {
              clearPolling();
              return;
            }
            if (event.type === 'message') {
              void refreshRoomSafely(roomId);
            }
          },
          onError: (error) => {
            if (cancelled) return;
            ensurePolling();
            if (isTerminalStreamError(error)) return;
            clearRetry();
            retryTimer = setTimeout(() => {
              if (!cancelled) void connect(retryCount + 1);
            }, getRoomStreamRetryDelayMs(retryCount));
          },
          onClose: () => {
            if (cancelled) return;
            ensurePolling();
            clearRetry();
            retryTimer = setTimeout(() => {
              if (!cancelled) void connect(retryCount + 1);
            }, getRoomStreamRetryDelayMs(retryCount));
          },
        });
        if (cancelled) {
          nextCleanup();
          return;
        }
        cleanup = nextCleanup;
      } catch {
        if (cancelled) return;
        ensurePolling();
        clearRetry();
        retryTimer = setTimeout(() => {
          if (!cancelled) void connect(retryCount + 1);
        }, getRoomStreamRetryDelayMs(retryCount));
      }
    };

    void connect();
    return () => {
      cancelled = true;
      clearRetry();
      clearPolling();
      cleanup?.();
    };
  }, [privateChannelId, refreshRoomSafely, roomId]);
}
