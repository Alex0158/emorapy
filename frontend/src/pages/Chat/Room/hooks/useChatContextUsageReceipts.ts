import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextUsageReceipt } from '@/types/chat';
import { listChatContextUsageReceipts } from '@/services/api/chat';

export function useChatContextUsageReceipts(roomId: string | null) {
  const [receipts, setReceipts] = useState<ContextUsageReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const activeRoomIdRef = useRef(roomId);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async (showLoading = false) => {
    const targetRoomId = activeRoomIdRef.current;
    if (!targetRoomId) return;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (showLoading) setLoading(true);
    try {
      const nextReceipts = await listChatContextUsageReceipts(targetRoomId);
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) {
        setReceipts(nextReceipts);
        setError(false);
      }
    } catch {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) setError(true);
    } finally {
      if (
        showLoading
        && activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRoomIdRef.current = roomId;
    requestSequenceRef.current += 1;
    setReceipts([]);
    setError(false);
    setLoading(Boolean(roomId));
    if (!roomId) return;
    void refresh(true);
  }, [refresh, roomId]);

  return { error, loading, receipts, refresh };
}
