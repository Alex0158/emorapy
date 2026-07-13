import { useCallback, useEffect, useState } from 'react';
import type { ChatVisibilityScope } from '@emorapy/api-client';

export type ChatConversationLane = 'private' | 'shared';

type LaneDrafts = Record<ChatConversationLane, string>;

const createEmptyDrafts = (): LaneDrafts => ({ private: '', shared: '' });

export function useChatConversationLane(roomId: string | null) {
  const [activeLane, setActiveLane] = useState<ChatConversationLane>('private');
  const [drafts, setDrafts] = useState<LaneDrafts>(createEmptyDrafts);
  const compose = drafts[activeLane];
  const visibilityScope: ChatVisibilityScope = activeLane === 'private' ? 'owner_only' : 'all';

  useEffect(() => {
    setActiveLane('private');
    setDrafts(createEmptyDrafts());
  }, [roomId]);

  const setCompose = useCallback((value: string) => {
    setDrafts((current) => ({ ...current, [activeLane]: value }));
  }, [activeLane]);

  const clearCompose = useCallback(() => {
    setDrafts((current) => ({ ...current, [activeLane]: '' }));
  }, [activeLane]);

  return {
    activeLane,
    clearCompose,
    compose,
    setActiveLane,
    setCompose,
    visibilityScope,
  };
}
