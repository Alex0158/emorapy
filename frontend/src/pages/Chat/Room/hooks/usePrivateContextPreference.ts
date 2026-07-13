import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PrivateContextUseMode } from '@/types/chat';
import {
  getPrivateContextPreference,
  updatePrivateContextPreference,
} from '@/services/api/chat';
import { t } from '@/utils/i18n';

export function usePrivateContextPreference(roomId: string | null) {
  const [mode, setMode] = useState<PrivateContextUseMode>('private_only');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeRoomIdRef = useRef(roomId);
  const requestSequenceRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    activeRoomIdRef.current = roomId;
    requestSequenceRef.current += 1;
    savingRef.current = false;
    setSaving(false);
    setMode('private_only');
    if (!roomId) {
      setLoading(false);
      return;
    }
    const requestSequence = requestSequenceRef.current;
    let cancelled = false;
    setLoading(true);
    getPrivateContextPreference(roomId)
      .then((preference) => {
        if (
          !cancelled
          && activeRoomIdRef.current === roomId
          && requestSequenceRef.current === requestSequence
        ) setMode(preference.mode);
      })
      .catch(() => {
        if (
          !cancelled
          && activeRoomIdRef.current === roomId
          && requestSequenceRef.current === requestSequence
        ) toast.error(t('chat.contextPreference.loadError'));
      })
      .finally(() => {
        if (
          !cancelled
          && activeRoomIdRef.current === roomId
          && requestSequenceRef.current === requestSequence
        ) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const updateMode = useCallback(async (nextMode: PrivateContextUseMode) => {
    if (!roomId || savingRef.current || nextMode === mode) return;
    const targetRoomId = roomId;
    const requestSequence = requestSequenceRef.current;
    savingRef.current = true;
    setSaving(true);
    try {
      const preference = await updatePrivateContextPreference(targetRoomId, nextMode);
      if (
        activeRoomIdRef.current !== targetRoomId
        || requestSequenceRef.current !== requestSequence
      ) return;
      setMode(preference.mode);
      toast.success(t('chat.contextPreference.saved'));
    } catch {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) toast.error(t('chat.contextPreference.saveError'));
    } finally {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [mode, roomId]);

  return { loading, mode, saving, updateMode };
}
