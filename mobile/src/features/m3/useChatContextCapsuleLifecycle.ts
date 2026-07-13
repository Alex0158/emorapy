import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ContextAuthorization,
  ContextCapsuleListItem,
  ContextPurpose,
} from '@emorapy/api-client';

import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';
import { m3Api } from './api';
import { chatQueryKeys } from './chatQueryKeys';

export type ManagedCapsulePurpose = Extract<
  ContextPurpose,
  'shared_mediation' | 'formal_analysis_evidence'
>;

export type CapsuleLifecycleCommand =
  | {
    kind: 'create';
    sourceChannelId: string;
    sourceMessageIds: string[];
    summary: string;
  }
  | {
    kind: 'grant';
    capsule: ContextCapsuleListItem;
    purpose: ManagedCapsulePurpose;
  }
  | {
    kind: 'revoke';
    authorization: ContextAuthorization;
  }
  | {
    kind: 'revise';
    capsule: ContextCapsuleListItem;
    summary: string;
  }
  | {
    kind: 'discard';
    capsule: ContextCapsuleListItem;
  };

const authorizationScope: Record<ManagedCapsulePurpose, {
  audience: 'room_participants' | 'analysis_participants';
}> = {
  formal_analysis_evidence: { audience: 'analysis_participants' },
  shared_mediation: { audience: 'room_participants' },
};

export function getExactCapsuleSourceMessageIds(
  capsule: ContextCapsuleListItem,
): string[] | null {
  if (
    capsule.source_refs.length === 0
    || capsule.source_refs.some((source) => source.kind !== 'chat_message')
  ) return null;
  return capsule.source_refs.map((source) => source.id);
}

export function isCurrentManageableCapsule(
  capsule: ContextCapsuleListItem,
  roomId: string,
  viewerParticipantId: string,
  now = Date.now(),
): boolean {
  return (
    capsule.room_id === roomId
    && capsule.owner_participant_id === viewerParticipantId
    && (capsule.status === 'draft' || capsule.status === 'approved')
    && !capsule.revoked_at
    && Boolean(capsule.expires_at)
    && new Date(capsule.expires_at as string).getTime() > now
  );
}

export function findActiveCapsuleAuthorization(
  capsule: ContextCapsuleListItem,
  purpose: ManagedCapsulePurpose,
  roomId: string,
  viewerParticipantId: string,
  now = Date.now(),
): ContextAuthorization | undefined {
  const expectedAudience = authorizationScope[purpose].audience;
  return capsule.authorizations.find((authorization) => (
    capsule.status === 'approved'
    && authorization.capsule_id === capsule.id
    && authorization.subject_participant_id === viewerParticipantId
    && authorization.purpose === purpose
    && authorization.audience === expectedAudience
    && authorization.target_type === 'chat_room'
    && authorization.target_id === roomId
    && authorization.capsule_content_hash === capsule.content_hash
    && authorization.policy_version === capsule.policy_version
    && !authorization.revoked_at
    && Boolean(authorization.expires_at)
    && new Date(authorization.expires_at as string).getTime() > now
  ));
}

function commandKey(command?: CapsuleLifecycleCommand): string | null {
  if (!command) return null;
  if (command.kind === 'create') return `create:${command.sourceChannelId}`;
  if (command.kind === 'revoke') {
    return `revoke:${command.authorization.id}`;
  }
  if (command.kind === 'grant') {
    return `grant:${command.capsule.id}:${command.purpose}`;
  }
  return `${command.kind}:${command.capsule.id}`;
}

export function useChatContextCapsuleLifecycle(roomId: string) {
  const queryClient = useQueryClient();
  const { epoch: identityEpoch } = useIdentityQueryScope();

  const invalidateContextState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.contextCapsules(identityEpoch, roomId),
      }),
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.contextUsageReceipts(identityEpoch, roomId),
      }),
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.analysisRequests(identityEpoch, roomId),
      }),
    ]);
  };

  const mutation = useMutation({
    mutationFn: async (command: CapsuleLifecycleCommand) => {
      if (command.kind === 'create') {
        return m3Api.chat.createContextCapsule(roomId, {
          source_channel_id: command.sourceChannelId,
          source_message_ids: command.sourceMessageIds,
          summary: command.summary.trim(),
        });
      }
      if (command.kind === 'grant') {
        return m3Api.chat.grantContextAuthorization(roomId, command.capsule.id, {
          audience: authorizationScope[command.purpose].audience,
          capsule_content_hash: command.capsule.content_hash,
          policy_version: command.capsule.policy_version,
          purpose: command.purpose,
          target_id: roomId,
          target_type: 'chat_room',
        });
      }
      if (command.kind === 'revoke') {
        return m3Api.chat.revokeContextAuthorization(roomId, command.authorization.id, {
          reason_code: 'user_revoked',
        });
      }
      if (command.kind === 'discard') {
        return m3Api.chat.discardContextCapsule(roomId, command.capsule.id);
      }

      const sourceMessageIds = getExactCapsuleSourceMessageIds(command.capsule);
      if (!sourceMessageIds) {
        throw new Error('Exact capsule source references are unavailable');
      }
      return m3Api.chat.reviseContextCapsule(roomId, command.capsule.id, {
        expires_at: command.capsule.expires_at,
        source_channel_id: command.capsule.source_channel_id,
        source_message_ids: sourceMessageIds,
        summary: command.summary.trim(),
      });
    },
    onSettled: invalidateContextState,
  });

  return {
    isPending: mutation.isPending,
    error: mutation.error,
    mutate: mutation.mutate,
    operationKey: commandKey(mutation.variables),
    reset: mutation.reset,
  };
}
