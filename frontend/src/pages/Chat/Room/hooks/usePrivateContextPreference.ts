import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  PrivateContextPreference,
  PrivateContextUseMode,
  SharedAdaptationConsentDecision,
} from '@/types/chat';
import {
  getPrivateContextPreference,
  updateSharedAdaptationConsent,
  updatePrivateContextPreference,
} from '@/services/api/chat';
import { t } from '@/utils/i18n';

export function usePrivateContextPreference(roomId: string | null) {
  const [preference, setPreference] = useState<PrivateContextPreference | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const activeRoomIdRef = useRef(roomId);
  const requestSequenceRef = useRef(0);
  const savingRef = useRef(false);

  const refresh = useCallback(async (_showLoading = false) => {
    const targetRoomId = activeRoomIdRef.current;
    if (!targetRoomId) return;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setUnavailable(false);
    setLoading(true);
    try {
      const nextPreference = await getPrivateContextPreference(targetRoomId);
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) {
        setPreference(nextPreference);
        setUnavailable(false);
      }
    } catch {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) {
        setUnavailable(true);
        toast.error(t('chat.contextPreference.loadError'));
      }
    } finally {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRoomIdRef.current = roomId;
    requestSequenceRef.current += 1;
    savingRef.current = false;
    setSaving(false);
    setPreference(null);
    setUnavailable(false);
    setLoading(Boolean(roomId));
    if (roomId) void refresh(true);
  }, [refresh, roomId]);

  const updateMode = useCallback(async (nextMode: PrivateContextUseMode) => {
    if (!roomId || !preference || savingRef.current || nextMode === preference.mode) return;
    const targetRoomId = roomId;
    const requestSequence = requestSequenceRef.current;
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await updatePrivateContextPreference(
        targetRoomId,
        nextMode,
        preference.room_adaptation.policy_version,
      );
      if (
        activeRoomIdRef.current !== targetRoomId
        || requestSequenceRef.current !== requestSequence
      ) return;
      setPreference(updated);
      toast.success(t('chat.contextPreference.saved'));
    } catch {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) toast.error(t('chat.contextPreference.saveError'));
    } finally {
      if (activeRoomIdRef.current === targetRoomId) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [preference, roomId]);

  const updateAdaptationDecision = useCallback(async (
    decision: Exclude<SharedAdaptationConsentDecision, 'not_set'>,
  ) => {
    if (
      !roomId
      || !preference
      || savingRef.current
      || decision === preference.adaptation_decision
    ) return;
    const targetRoomId = roomId;
    const requestSequence = requestSequenceRef.current;
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await updateSharedAdaptationConsent(
        targetRoomId,
        decision,
        preference.room_adaptation.policy_version,
      );
      if (
        activeRoomIdRef.current !== targetRoomId
        || requestSequenceRef.current !== requestSequence
      ) return;
      setPreference(updated);
      toast.success(t('chat.contextPreference.saved'));
    } catch {
      if (
        activeRoomIdRef.current === targetRoomId
        && requestSequenceRef.current === requestSequence
      ) toast.error(t('chat.contextPreference.saveError'));
    } finally {
      if (activeRoomIdRef.current === targetRoomId) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [preference, roomId]);

  return {
    adaptationDecision: preference?.adaptation_decision ?? 'not_set',
    loading,
    mode: preference?.mode ?? 'private_only',
    ready: preference !== null && !loading && !unavailable,
    roomAdaptation: preference?.room_adaptation ?? null,
    refresh,
    saving,
    unavailable,
    updateAdaptationDecision,
    updateMode,
  };
}
