import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ContextCapsuleListItem } from '@/types/chat';
import {
  discardChatContextCapsule,
  grantChatContextAuthorization,
  reviseChatContextCapsule,
} from '@/services/api/chat';
import { t } from '@/utils/i18n';

export type ChatCapsuleGrantPurpose = 'shared_mediation' | 'formal_analysis_evidence';

interface UseChatCapsuleLifecycleInput {
  roomId: string | null;
  refresh: (showLoading?: boolean) => Promise<void>;
}

export function useChatCapsuleLifecycle({ roomId, refresh }: UseChatCapsuleLifecycleInput) {
  const [workingActionKey, setWorkingActionKey] = useState<string | null>(null);
  const activeActionRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef(roomId);
  const mountedRef = useRef(true);

  useEffect(() => {
    activeRoomIdRef.current = roomId;
    activeActionRef.current = null;
    setWorkingActionKey(null);
  }, [roomId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAction = useCallback(async (
    actionKey: string,
    operation: (targetRoomId: string) => Promise<void>,
    successKey: string,
  ) => {
    if (!roomId || activeActionRef.current) return;
    const targetRoomId = roomId;
    activeActionRef.current = actionKey;
    setWorkingActionKey(actionKey);
    try {
      await operation(targetRoomId);
      if (!mountedRef.current || activeRoomIdRef.current !== targetRoomId) return;
      toast.success(t(successKey));
      await refresh(false);
    } catch {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        toast.error(t('chat.capsule.lifecycleError'));
      }
    } finally {
      if (activeActionRef.current === actionKey) activeActionRef.current = null;
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        setWorkingActionKey(null);
      }
    }
  }, [refresh, roomId]);

  const grant = useCallback(async (
    capsule: ContextCapsuleListItem,
    purpose: ChatCapsuleGrantPurpose,
  ) => runAction(
    `grant:${purpose}:${capsule.id}`,
    async (targetRoomId) => {
      await grantChatContextAuthorization(targetRoomId, capsule.id, {
        capsule_content_hash: capsule.content_hash,
        purpose,
        audience: purpose === 'shared_mediation'
          ? 'room_participants'
          : 'analysis_participants',
        target_type: 'chat_room',
        target_id: targetRoomId,
        policy_version: capsule.policy_version,
      });
    },
    purpose === 'shared_mediation'
      ? 'chat.capsule.sharedApproved'
      : 'chat.capsule.formalApproved',
  ), [runAction]);

  const revise = useCallback(async (
    capsule: ContextCapsuleListItem,
    summary: string,
  ) => runAction(
    `revise:${capsule.id}`,
    async (targetRoomId) => {
      const sourceMessageIds = capsule.source_refs
        .filter((source) => source.kind === 'chat_message')
        .map((source) => source.id);
      if (sourceMessageIds.length === 0) throw new Error('Capsule source refs unavailable');
      await reviseChatContextCapsule(targetRoomId, capsule.id, {
        source_channel_id: capsule.source_channel_id,
        source_message_ids: sourceMessageIds,
        summary: summary.trim(),
        expires_at: capsule.expires_at,
      });
    },
    'chat.capsule.revised',
  ), [runAction]);

  const discard = useCallback(async (capsule: ContextCapsuleListItem) => runAction(
    `discard:${capsule.id}`,
    async (targetRoomId) => {
      await discardChatContextCapsule(targetRoomId, capsule.id);
    },
    'chat.capsule.discarded',
  ), [runAction]);

  return { discard, grant, revise, workingActionKey };
}
