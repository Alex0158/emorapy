import type {
  ChatAnalysisParticipantApproval,
  ChatAnalysisRequestListItem,
  ChatMessage,
  ContextCapsuleListItem,
} from '@emorapy/api-client';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow, Panel } from '@/src/ui/components';
import { ChatAnalysisEvidenceSelector } from './ChatAnalysisEvidenceSelector';
import { ChatSharedSafetyStatusNotice } from './ChatSharedSafetyStatusNotice';
import type { ChatAnalysisSelectionReview } from './useChatAnalysisConsent';
import type { ChatSharedSafetyViewState } from './useChatRoomSafetyStatus';

type ChatAnalysisConsentPanelProps = {
  activeRequest: ChatAnalysisRequestListItem | null;
  allParticipantsApproved: boolean;
  analysisStatusLabel: string;
  approvalRecoveryPending: boolean;
  approvedParticipantCount: number;
  canCreateAnalysisRequest: boolean;
  createPending: boolean;
  decidePending: boolean;
  eligibleMessages: ChatMessage[];
  formalCapsules: ContextCapsuleListItem[];
  formalActionsBlocked: boolean;
  onCloseSelectionReview: () => void;
  onCreateReviewedSelection: (selection: ChatAnalysisSelectionReview) => void;
  onDecision: (request: ChatAnalysisRequestListItem, decision: 'approved' | 'declined') => void;
  onOpenSelectionReview: () => void;
  onRevokeApproval: (request: ChatAnalysisRequestListItem) => void;
  onSubmit: (request: ChatAnalysisRequestListItem) => void;
  onToggleCapsule: (capsuleId: string) => void;
  onToggleMessage: (messageId: string) => void;
  selectedCapsuleIds: string[];
  selectedMessageIds: string[];
  sharedSafety: ChatSharedSafetyViewState;
  selectionReview: ChatAnalysisSelectionReview | null;
  sourceSetComplete: boolean;
  revokeError: boolean;
  revokePending: boolean;
  submitPending: boolean;
  viewerApproval?: ChatAnalysisParticipantApproval;
  viewerIsRequester: boolean;
  workingRequestId: string | null;
};

export function ChatAnalysisConsentPanel({
  activeRequest,
  allParticipantsApproved,
  analysisStatusLabel,
  approvalRecoveryPending,
  approvedParticipantCount,
  canCreateAnalysisRequest,
  createPending,
  decidePending,
  eligibleMessages,
  formalCapsules,
  formalActionsBlocked,
  onCloseSelectionReview,
  onCreateReviewedSelection,
  onDecision,
  onOpenSelectionReview,
  onRevokeApproval,
  onSubmit,
  onToggleCapsule,
  onToggleMessage,
  selectedCapsuleIds,
  selectedMessageIds,
  sharedSafety,
  selectionReview,
  sourceSetComplete,
  revokeError,
  revokePending,
  submitPending,
  viewerApproval,
  viewerIsRequester,
  workingRequestId,
}: ChatAnalysisConsentPanelProps) {
  const requestActionPending = Boolean(workingRequestId);
  return (
    <Panel title={t('chatRoom.analysisPanel')}>
      <ChatSharedSafetyStatusNotice state={sharedSafety} />
      {approvalRecoveryPending ? (
        <FeatureRow
          title={t('chatRoom.analysis.requestCreatedApprovalPending')}
          detail={t('chatRoom.analysis.requestCreatedApprovalPending.detail')}
          tone="amber"
        />
      ) : null}
      {activeRequest ? (
        <>
          <FeatureRow
            title={t('chatRoom.analysis.exactScope')}
            detail={t('chatRoom.analysis.exactScope.detail', {
              capsules: activeRequest.source_previews.capsules.length,
              messages: activeRequest.source_previews.messages.length,
            })}
            tone="teal"
          />
          {activeRequest.source_previews.messages.map((message) => (
            <FeatureRow
              key={message.id}
              title={message.sender_role === 'roleA'
                ? t('chatRoom.messageMeta.roleA')
                : t('chatRoom.messageMeta.roleB')}
              detail={message.content}
              tone={message.sender_role === 'roleA' ? 'teal' : 'blue'}
            />
          ))}
          {activeRequest.source_previews.capsules.map((capsule) => (
            <FeatureRow
              key={capsule.id}
              title={t('chatRoom.analysis.approvedSummary')}
              detail={capsule.summary}
              tone="amber"
            />
          ))}
          <FeatureRow
            title={t('chatRoom.analysis.approvalProgress')}
            detail={t('chatRoom.analysis.approvalProgress.detail', {
              approved: approvedParticipantCount,
              required: activeRequest.required_participant_ids.length,
            })}
            tone={allParticipantsApproved ? 'teal' : 'amber'}
          />
          {!sourceSetComplete ? (
            <FeatureRow
              title={t('chatRoom.analysis.sourceChanged')}
              detail={t('chatRoom.analysis.sourceChanged.detail')}
              tone="amber"
            />
          ) : null}
          {sourceSetComplete && !viewerApproval && activeRequest.status === 'pending_approval' ? (
            <>
              <ActionButton
                disabled={requestActionPending || formalActionsBlocked}
                label={t('chatRoom.analysis.approveExact')}
                loading={decidePending}
                onPress={() => onDecision(activeRequest, 'approved')}
                testID="chat.room.analysis.approve"
                tone="teal"
              />
              <ActionButton
                disabled={requestActionPending}
                label={t('chatRoom.analysis.declineExact')}
                loading={decidePending}
                onPress={() => onDecision(activeRequest, 'declined')}
                testID="chat.room.analysis.decline"
                tone="neutral"
                variant="outline"
              />
            </>
          ) : null}
          {viewerApproval?.decision === 'approved' ? (
            <FeatureRow
              title={t('chatRoom.analysis.youApproved')}
              detail={t('chatRoom.analysis.youApproved.detail')}
              tone="teal"
            />
          ) : null}
          {revokeError ? (
            <FeatureRow
              title={t('chatRoom.analysis.revokeError')}
              detail={t('chatRoom.analysis.revokeError.detail')}
              tone="coral"
            />
          ) : null}
          {viewerApproval?.decision === 'approved'
            && ['pending_approval', 'approved', 'submitted'].includes(activeRequest.status) ? (
              <>
                <FeatureRow
                  title={t('chatRoom.analysis.revokeBoundary')}
                  detail={t('chatRoom.analysis.revokeBoundary.detail')}
                  tone="amber"
                />
                <ActionButton
                  accessibilityHint={t('chatRoom.analysis.revokeHint')}
                  disabled={requestActionPending}
                  label={t('chatRoom.analysis.revokeMyApproval')}
                  loading={revokePending}
                  onPress={() => onRevokeApproval(activeRequest)}
                  testID="chat.room.analysis.revoke-approval"
                  tone="amber"
                  variant="outline"
                />
              </>
            ) : null}
          {viewerApproval?.decision === 'approved' && activeRequest.status === 'processing' ? (
            <FeatureRow
              title={t('chatRoom.analysis.processingLocked')}
              detail={t('chatRoom.analysis.processingLocked.detail')}
              tone="amber"
            />
          ) : null}
          {viewerIsRequester
            && sourceSetComplete
            && allParticipantsApproved
            && ['pending_approval', 'approved', 'submitted'].includes(activeRequest.status) ? (
              <ActionButton
                disabled={requestActionPending || formalActionsBlocked}
                label={activeRequest.status === 'submitted'
                  ? t('chatRoom.analysis.retryHandoff')
                  : t('chatRoom.analysis.submit')}
                loading={submitPending}
                onPress={() => onSubmit(activeRequest)}
                testID="chat.room.analysis.submit"
                tone="coral"
              />
            ) : null}
          {!viewerIsRequester && viewerApproval?.decision === 'approved' && !allParticipantsApproved ? (
            <FeatureRow
              title={t('chatRoom.roleBApproval.title')}
              detail={t('chatRoom.analysis.waitingForOthers')}
              tone="amber"
            />
          ) : null}
        </>
      ) : (
        <>
          {canCreateAnalysisRequest ? (
            selectionReview ? (
              <>
                <FeatureRow
                  title={t('chatRoom.analysis.reviewExactScope')}
                  detail={t('chatRoom.analysis.reviewExactScope.detail', {
                    capsules: selectionReview.capsules.length,
                    messages: selectionReview.messages.length,
                  })}
                  tone="teal"
                />
                {selectionReview.messages.map((message) => (
                  <FeatureRow
                    key={message.id}
                    title={message.sender_participant?.role_in_room === 'roleB'
                      ? t('chatRoom.messageMeta.roleB')
                      : t('chatRoom.messageMeta.roleA')}
                    detail={message.content}
                    tone={message.sender_participant?.role_in_room === 'roleB' ? 'blue' : 'teal'}
                  />
                ))}
                {selectionReview.capsules.map((capsule) => (
                  <FeatureRow
                    key={capsule.id}
                    title={t('chatRoom.analysis.approvedSummary')}
                    detail={capsule.summary}
                    tone="amber"
                  />
                ))}
                <FeatureRow
                  title={t('chatRoom.roleBApproval.title')}
                  detail={t('chatRoom.analysis.reviewApprovalMeaning')}
                  tone="amber"
                />
                <ActionButton
                  disabled={createPending}
                  label={t('chatRoom.analysis.cancelReview')}
                  onPress={onCloseSelectionReview}
                  testID="chat.room.analysis.review-cancel"
                  tone="neutral"
                  variant="outline"
                />
                <ActionButton
                  disabled={formalActionsBlocked}
                  label={t('chatRoom.analysis.createAndApproveExact')}
                  loading={createPending}
                  onPress={() => onCreateReviewedSelection(selectionReview)}
                  testID="chat.room.request-judgment"
                  tone="coral"
                />
              </>
            ) : (
              <>
                <ChatAnalysisEvidenceSelector
                  eligibleMessages={eligibleMessages}
                  formalCapsules={formalCapsules}
                  onToggleCapsule={onToggleCapsule}
                  onToggleMessage={onToggleMessage}
                  selectedCapsuleIds={selectedCapsuleIds}
                  selectedMessageIds={selectedMessageIds}
                />
                <FeatureRow
                  title={t('chatRoom.roleBApproval.title')}
                  detail={t('chatRoom.roleBApproval.detail')}
                  tone="amber"
                />
                <ActionButton
                  disabled={
                    formalActionsBlocked
                    || (selectedMessageIds.length === 0 && selectedCapsuleIds.length === 0)
                  }
                  label={t('chatRoom.analysis.reviewSelection')}
                  onPress={onOpenSelectionReview}
                  testID="chat.room.analysis.review-open"
                  tone="coral"
                />
              </>
            )
          ) : (
            <FeatureRow
              title={t('chatRoom.analysis.roleAStarts')}
              detail={t('chatRoom.analysis.roleAStarts.detail')}
              tone="blue"
            />
          )}
        </>
      )}
      <FeatureRow
        title={t('chatRoom.analysisStatus')}
        detail={analysisStatusLabel}
        tone="coral"
      />
    </Panel>
  );
}
