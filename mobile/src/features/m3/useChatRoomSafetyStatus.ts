import { useQuery } from '@tanstack/react-query';
import type { ChatRoomSafetyStatus } from '@emorapy/api-client';

import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';
import { m3Api } from './api';
import { chatQueryKeys } from './chatQueryKeys';

export type ChatSharedSafetyViewState = {
  blocked: boolean;
  loading: boolean;
  status: ChatRoomSafetyStatus['status'] | null;
  unavailable: boolean;
};

export function useChatRoomSafetyStatus(input: {
  enabled: boolean;
  roomId: string | null;
}): ChatSharedSafetyViewState {
  const identityScope = useIdentityQueryScope();
  const query = useQuery({
    queryKey: chatQueryKeys.safetyStatus(identityScope.epoch, input.roomId),
    queryFn: () => m3Api.chat.getRoomSafetyStatus(input.roomId as string),
    enabled: input.enabled
      && Boolean(input.roomId)
      && identityScope.privateDataEnabled
      && !identityScope.transitioning,
  });
  const status = query.data?.status ?? null;

  return {
    blocked: query.isError || status !== 'open',
    loading: query.isPending,
    status,
    unavailable: query.isError,
  };
}
