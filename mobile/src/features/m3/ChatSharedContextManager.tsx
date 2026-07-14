import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { ContextCapsuleListItem } from '@emorapy/api-client';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow, Panel } from '@/src/ui/components';
import { palette, spacing } from '@/src/ui/theme';
import {
  findActiveCapsuleAuthorization,
  getExactCapsuleSourceMessageIds,
  isCurrentManageableCapsule,
  type ManagedCapsulePurpose,
  useChatContextCapsuleLifecycle,
} from './useChatContextCapsuleLifecycle';

type ChatSharedContextManagerProps = {
  capsules: ContextCapsuleListItem[];
  formalActionsBlocked: boolean;
  roomId: string;
  viewerParticipantId: string;
};

export function ChatSharedContextManager({
  capsules,
  formalActionsBlocked,
  roomId,
  viewerParticipantId,
}: ChatSharedContextManagerProps) {
  const lifecycle = useChatContextCapsuleLifecycle(roomId);
  const [editingCapsuleId, setEditingCapsuleId] = useState<string | null>(null);
  const [discardConfirmCapsuleId, setDiscardConfirmCapsuleId] = useState<string | null>(null);
  const [revisionSummary, setRevisionSummary] = useState('');
  const managedCapsules = useMemo(() => {
    const now = Date.now();
    return capsules
      .filter((capsule) => isCurrentManageableCapsule(
        capsule,
        roomId,
        viewerParticipantId,
        now,
      ));
  }, [capsules, roomId, viewerParticipantId]);

  if (managedCapsules.length === 0) return null;

  const grantLabel = (
    capsule: ContextCapsuleListItem,
    purpose: ManagedCapsulePurpose,
  ): string => {
    const hadEarlierGrant = capsule.authorizations.some((authorization) => (
      authorization.purpose === purpose
    ));
    if (purpose === 'formal_analysis_evidence') {
      return t(hadEarlierGrant
        ? 'chatRoom.capsule.reauthorizeFormal'
        : 'chatRoom.capsule.grantFormal');
    }
    return t(hadEarlierGrant
      ? 'chatRoom.capsule.reauthorizeShared'
      : 'chatRoom.capsule.grantShared');
  };

  const closeRevision = () => {
    setEditingCapsuleId(null);
    setRevisionSummary('');
  };

  return (
    <Panel title={t('chatRoom.capsule.manageTitle')}>
      <FeatureRow
        title={t('chatRoom.capsule.manageBoundary')}
        detail={t('chatRoom.capsule.manageBoundary.detail')}
        tone="blue"
      />
      {lifecycle.error ? (
        <FeatureRow
          title={t('chatRoom.capsule.actionError')}
          detail={t('chatRoom.capsule.actionError.detail')}
          tone="coral"
        />
      ) : null}
      {managedCapsules.map((capsule) => {
        const sharedAuthorization = findActiveCapsuleAuthorization(
          capsule,
          'shared_mediation',
          roomId,
          viewerParticipantId,
        );
        const formalAuthorization = findActiveCapsuleAuthorization(
          capsule,
          'formal_analysis_evidence',
          roomId,
          viewerParticipantId,
        );
        const sourceMessageIds = getExactCapsuleSourceMessageIds(capsule);
        const isEditing = editingCapsuleId === capsule.id;
        return (
        <View key={capsule.id} style={styles.capsuleCard}>
          <FeatureRow
            title={t(capsule.status === 'draft'
              ? 'chatRoom.capsule.savedDraft'
              : 'chatRoom.capsule.approvedSummary')}
            detail={capsule.summary}
            tone={capsule.status === 'draft' ? 'blue' : 'teal'}
          />
          <FeatureRow
            title={t('chatRoom.capsule.sharedPurpose')}
            detail={t(sharedAuthorization
              ? 'chatRoom.capsule.purposeActive'
              : 'chatRoom.capsule.purposeInactive')}
            tone={sharedAuthorization ? 'teal' : 'neutral'}
          />
          <ActionButton
            accessibilityHint={sharedAuthorization
              ? t('chatRoom.capsule.revokeHint')
              : t('chatRoom.capsule.grantSharedHint')}
            disabled={lifecycle.isPending}
            label={sharedAuthorization
              ? t('chatRoom.capsule.revokeShared')
              : grantLabel(capsule, 'shared_mediation')}
            loading={lifecycle.operationKey === (
              sharedAuthorization
                ? `revoke:${sharedAuthorization.id}`
                : `grant:${capsule.id}:shared_mediation`
            )}
            onPress={() => lifecycle.mutate(sharedAuthorization
              ? { kind: 'revoke', authorization: sharedAuthorization }
              : { kind: 'grant', capsule, purpose: 'shared_mediation' })}
            testID={`chat.room.capsule.${sharedAuthorization ? 'revoke' : 'grant'}.shared_mediation.${capsule.id}`}
            tone="teal"
            variant="outline"
          />
          <FeatureRow
            title={t('chatRoom.capsule.formalPurpose')}
            detail={t(
              formalAuthorization
                ? 'chatRoom.capsule.purposeActive'
                : formalActionsBlocked
                  ? 'chatRoom.capsule.formalPurposePaused'
                  : 'chatRoom.capsule.purposeInactive',
            )}
            tone={formalAuthorization ? 'amber' : 'neutral'}
          />
          <ActionButton
            accessibilityHint={formalAuthorization
              ? t('chatRoom.capsule.revokeHint')
              : t(formalActionsBlocked
                ? 'chatRoom.safety.formalActionBlocked'
                : 'chatRoom.capsule.grantFormalHint')}
            disabled={lifecycle.isPending || (formalActionsBlocked && !formalAuthorization)}
            label={formalAuthorization
              ? t('chatRoom.capsule.revokeFormal')
              : grantLabel(capsule, 'formal_analysis_evidence')}
            loading={lifecycle.operationKey === (
              formalAuthorization
                ? `revoke:${formalAuthorization.id}`
                : `grant:${capsule.id}:formal_analysis_evidence`
            )}
            onPress={() => lifecycle.mutate(formalAuthorization
              ? { kind: 'revoke', authorization: formalAuthorization }
              : { kind: 'grant', capsule, purpose: 'formal_analysis_evidence' })}
            testID={`chat.room.capsule.${formalAuthorization ? 'revoke' : 'grant'}.formal_analysis_evidence.${capsule.id}`}
            tone="amber"
            variant="outline"
          />
          {isEditing ? (
            <>
              <FeatureRow
                title={t('chatRoom.capsule.revisionSource')}
                detail={t('chatRoom.capsule.revisionSource.detail', {
                  count: sourceMessageIds?.length ?? 0,
                })}
                tone="blue"
              />
              <TextInput
                accessibilityLabel={t('chatRoom.capsule.revisionLabel')}
                multiline
                onChangeText={setRevisionSummary}
                placeholder={t('chatRoom.capsule.placeholder')}
                placeholderTextColor={palette.muted}
                style={styles.textArea}
                testID={`chat.room.capsule.revision-input.${capsule.id}`}
                textAlignVertical="top"
                value={revisionSummary}
              />
              <ActionButton
                disabled={
                  lifecycle.isPending
                  || !sourceMessageIds
                  || revisionSummary.trim().length === 0
                }
                label={t('chatRoom.capsule.saveRevision')}
                loading={lifecycle.operationKey === `revise:${capsule.id}`}
                onPress={() => lifecycle.mutate({
                  kind: 'revise',
                  capsule,
                  summary: revisionSummary,
                }, { onSuccess: closeRevision })}
                testID={`chat.room.capsule.revise-save.${capsule.id}`}
                tone="blue"
              />
              <ActionButton
                disabled={lifecycle.isPending}
                label={t('chatRoom.capsule.cancelRevision')}
                onPress={closeRevision}
                testID={`chat.room.capsule.revise-cancel.${capsule.id}`}
                tone="neutral"
                variant="outline"
              />
            </>
          ) : (
            <ActionButton
              accessibilityHint={sourceMessageIds
                ? t('chatRoom.capsule.reviseHint')
                : t('chatRoom.capsule.reviseUnavailable')}
              disabled={lifecycle.isPending || !sourceMessageIds}
              label={t('chatRoom.capsule.revise')}
              onPress={() => {
                lifecycle.reset();
                setEditingCapsuleId(capsule.id);
                setRevisionSummary(capsule.summary);
              }}
              testID={`chat.room.capsule.revise.${capsule.id}`}
              tone="blue"
              variant="outline"
            />
          )}
          {discardConfirmCapsuleId === capsule.id ? (
            <>
              <FeatureRow
                title={t('chatRoom.capsule.discardConfirm')}
                detail={t('chatRoom.capsule.discardConfirm.detail')}
                tone="coral"
              />
              <ActionButton
                disabled={lifecycle.isPending}
                label={t('chatRoom.capsule.discardConfirm.action')}
                loading={lifecycle.operationKey === `discard:${capsule.id}`}
                onPress={() => lifecycle.mutate({ kind: 'discard', capsule }, {
                  onSuccess: () => setDiscardConfirmCapsuleId(null),
                })}
                testID={`chat.room.capsule.discard-confirm.${capsule.id}`}
                tone="coral"
              />
              <ActionButton
                disabled={lifecycle.isPending}
                label={t('chatRoom.capsule.discardConfirm.cancel')}
                onPress={() => setDiscardConfirmCapsuleId(null)}
                testID={`chat.room.capsule.discard-cancel.${capsule.id}`}
                tone="neutral"
                variant="outline"
              />
            </>
          ) : (
            <ActionButton
              accessibilityHint={t('chatRoom.capsule.discardHint')}
              disabled={lifecycle.isPending}
              label={t('chatRoom.capsule.discard')}
              onPress={() => {
                lifecycle.reset();
                setDiscardConfirmCapsuleId(capsule.id);
              }}
              testID={`chat.room.capsule.discard.${capsule.id}`}
              tone="coral"
              variant="outline"
            />
          )}
        </View>
        );
      })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  capsuleCard: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  textArea: {
    minHeight: 112,
    borderRadius: 8,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.panel,
    color: palette.ink,
    padding: spacing.md,
  },
});
