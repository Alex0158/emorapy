import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatRoomSafetyStatus } from '@/services/api/chat';
import type { ChatRoomSafetyState } from '@/types/chat';

export function useChatRoomSafetyStatus(roomId: string | null) {
  const mountedRef = useRef(true);
  const activeRoomIdRef = useRef(roomId);
  const requestSequenceRef = useRef(0);
  const [status, setStatus] = useState<ChatRoomSafetyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  activeRoomIdRef.current = roomId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (showLoading = false) => {
    const targetRoomId = activeRoomIdRef.current;
    if (!targetRoomId) return;

    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    if (showLoading) setLoading(true);

    try {
      const result = await getChatRoomSafetyStatus(targetRoomId);
      if (
        mountedRef.current
        && activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === sequence
      ) {
        setStatus(result.status);
        setUnavailable(false);
      }
    } catch {
      if (
        mountedRef.current
        && activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === sequence
      ) setUnavailable(true);
    } finally {
      if (
        showLoading
        && mountedRef.current
        && activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === sequence
      ) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setStatus(null);
    setLoading(false);
    setUnavailable(false);
    if (roomId) void refresh(true);
  }, [refresh, roomId]);

  return {
    blocked: Boolean(roomId) && (unavailable || status !== 'open'),
    loading,
    paused: status === 'paused',
    refresh,
    status,
    unavailable,
  };
}
