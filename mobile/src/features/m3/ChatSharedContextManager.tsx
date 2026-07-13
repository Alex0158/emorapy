import { useMemo } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContextAuthorization, ContextCapsuleListItem } from '@emorapy/api-client';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow, Panel } from '@/src/ui/components';
import { m3Api } from './api';
import { chatQueryKeys } from './chatQueryKeys';
import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';

type ChatSharedContextManagerProps = {
  capsules: ContextCapsuleListItem[];
  roomId: string;
  viewerParticipantId: string;
};

function isActiveManagedAuthorization(
  authorization: ContextAuthorization,
  capsule: ContextCapsuleListItem,
  roomId: string,
  viewerParticipantId: string,
  now: number,
): boolean {
  return (
    capsule.room_id === roomId
    && capsule.owner_participant_id === viewerParticipantId
    && capsule.status === 'approved'
    && !capsule.revoked_at
    && Boolean(capsule.expires_at)
    && new Date(capsule.expires_at as string).getTime() > now
    && authorization.capsule_id === capsule.id
    && authorization.subject_participant_id === viewerParticipantId
    && authorization.target_type === 'chat_room'
    && authorization.target_id === roomId
    && authorization.capsule_content_hash === capsule.content_hash
    && authorization.policy_version === capsule.policy_version
    && !authorization.revoked_at
    && Boolean(authorization.expires_at)
    && new Date(authorization.expires_at as string).getTime() > now
    && (
      (
        authorization.purpose === 'shared_mediation'
        && authorization.audience === 'room_participants'
      )
      || (
        authorization.purpose === 'formal_analysis_evidence'
        && authorization.audience === 'analysis_participants'
      )
    )
  );
}

export function ChatSharedContextManager({
  capsules,
  roomId,
  viewerParticipantId,
}: ChatSharedContextManagerProps) {
  const queryClient = useQueryClient();
  const { epoch: identityEpoch } = useIdentityQueryScope();
  const managedCapsules = useMemo(() => {
    const now = Date.now();
    return capsules
      .map((capsule) => ({
        authorizations: capsule.authorizations.filter((authorization) => (
          isActiveManagedAuthorization(
            authorization,
            capsule,
            roomId,
            viewerParticipantId,
            now,
          )
        )),
        capsule,
      }))
      .filter(({ authorizations }) => authorizations.length > 0);
  }, [capsules, roomId, viewerParticipantId]);

  const revokeMutation = useMutation({
    mutationFn: (authorization: ContextAuthorization) => (
      m3Api.chat.revokeContextAuthorization(roomId, authorization.id, {
        reason_code: 'user_revoked',
      })
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.contextCapsules(identityEpoch, roomId),
      });
    },
  });

  if (managedCapsules.length === 0) return null;

  return (
    <Panel title={t('chatRoom.capsule.manageTitle')}>
      <FeatureRow
        title={t('chatRoom.capsule.manageBoundary')}
        detail={t('chatRoom.capsule.manageBoundary.detail')}
        tone="blue"
      />
      {revokeMutation.error ? (
        <FeatureRow
          title={t('chatRoom.capsule.revokeError')}
          detail={t('chatRoom.capsule.revokeError.detail')}
          tone="coral"
        />
      ) : null}
      {managedCapsules.map(({ authorizations, capsule }) => (
        <View key={capsule.id}>
          <FeatureRow
            title={t('chatRoom.capsule.sharedSummary')}
            detail={capsule.summary}
            tone="amber"
          />
          {authorizations.map((authorization) => {
            const formal = authorization.purpose === 'formal_analysis_evidence';
            const working = revokeMutation.isPending
              && revokeMutation.variables?.id === authorization.id;
            const label = t(formal
              ? 'chatRoom.capsule.revokeFormal'
              : 'chatRoom.capsule.revokeShared');
            return (
              <ActionButton
                key={authorization.id}
                accessibilityHint={t('chatRoom.capsule.revokeHint')}
                disabled={revokeMutation.isPending}
                label={label}
                loading={working}
                onPress={() => revokeMutation.mutate(authorization)}
                testID={`chat.room.capsule.revoke.${authorization.purpose}.${authorization.id}`}
                tone={formal ? 'amber' : 'blue'}
                variant="outline"
              />
            );
          })}
        </View>
      ))}
    </Panel>
  );
}
