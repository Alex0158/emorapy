import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatAnalysisRequestListItem } from '@/types/chat';
import { setLocale } from '@/utils/i18n';
import ChatAnalysisConsentPanel from './ChatAnalysisConsentPanel';

const FUTURE = '2099-01-01T00:00:00.000Z';

const request: ChatAnalysisRequestListItem = {
  id: 'analysis-1',
  room_id: 'room-1',
  requested_by_participant_id: 'participant-a',
  status: 'pending_approval',
  selection_snapshot: {
    message_refs: [{ kind: 'chat_message', id: 'message-1', content_hash: 'a'.repeat(64) }],
    capsule_refs: [{ kind: 'context_capsule', id: 'capsule-1', version: 2, content_hash: 'b'.repeat(64) }],
  },
  selection_hash: 'c'.repeat(64),
  required_participant_ids: ['participant-a', 'participant-b'],
  policy_version: 'context-policy-v1',
  expires_at: FUTURE,
  created_at: '2026-07-12T00:00:00.000Z',
  updated_at: '2026-07-12T00:00:00.000Z',
  participant_approvals: [{
    id: 'approval-a',
    analysis_request_id: 'analysis-1',
    participant_id: 'participant-a',
    decision: 'approved',
    selection_hash: 'c'.repeat(64),
    policy_version: 'context-policy-v1',
    decision_at: '2026-07-12T00:00:00.000Z',
    expires_at: FUTURE,
  }],
  source_previews: {
    messages: [{
      kind: 'chat_message',
      id: 'message-1',
      content: 'This exact shared sentence is visible to both people.',
      content_hash: 'a'.repeat(64),
      sender_participant_id: 'participant-a',
      sender_role: 'roleA',
      created_at: '2026-07-12T00:00:00.000Z',
    }],
    capsules: [{
      kind: 'context_capsule',
      id: 'capsule-1',
      version: 2,
      summary: 'This is the owner-approved summary, not the private original.',
      content_hash: 'b'.repeat(64),
      owner_participant_id: 'participant-a',
      owner_role: 'roleA',
    }],
  },
};

describe('ChatAnalysisConsentPanel', () => {
  it('另一方只依 server read model 的 source previews 批准或拒絕 exact selection', () => {
    setLocale('en-US');
    const onDecision = vi.fn();
    render(
      <ChatAnalysisConsentPanel
        requests={[request]}
        myParticipantId="participant-b"
        workingRequestId={null}
        loading={false}
        error=""
        getParticipantLabel={(id) => id === 'participant-a' ? 'Side A' : 'Side B'}
        onRefresh={vi.fn()}
        onDecision={onDecision}
        onRevokeApproval={vi.fn()}
        onSubmitAndStart={vi.fn()}
      />,
    );

    expect(screen.getByText('This exact shared sentence is visible to both people.')).toBeInTheDocument();
    expect(screen.getByText('This is the owner-approved summary, not the private original.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit and start Analysis' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve this exact list' }));
    expect(onDecision).toHaveBeenCalledWith(request, 'approved');
  });

  it('source preview 與 snapshot 同數量但 hash 錯配時應顯示警告並禁用批准', () => {
    setLocale('en-US');
    render(
      <ChatAnalysisConsentPanel
        requests={[{
          ...request,
          source_previews: {
            ...request.source_previews,
            messages: [{
              ...request.source_previews.messages[0],
              content_hash: 'f'.repeat(64),
            }],
          },
        }]}
        myParticipantId="participant-b"
        workingRequestId={null}
        loading={false}
        error=""
        getParticipantLabel={(id) => id === 'participant-a' ? 'Side A' : 'Side B'}
        onRefresh={vi.fn()}
        onDecision={vi.fn()}
        onRevokeApproval={vi.fn()}
        onSubmitAndStart={vi.fn()}
      />,
    );

    expect(screen.getByText(/no longer available or have changed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve this exact list' })).toBeDisabled();
  });

  it('已批准且未開始處理時提供本人撤回入口', () => {
    setLocale('en-US');
    const onRevokeApproval = vi.fn();
    render(
      <ChatAnalysisConsentPanel
        requests={[request]}
        myParticipantId="participant-a"
        workingRequestId={null}
        loading={false}
        error=""
        getParticipantLabel={(id) => id === 'participant-a' ? 'Side A' : 'Side B'}
        onRefresh={vi.fn()}
        onDecision={vi.fn()}
        onRevokeApproval={onRevokeApproval}
        onSubmitAndStart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Revoke my approval' }));
    expect(onRevokeApproval).toHaveBeenCalledWith(request);
  });

  it('共同流程暫停時禁用批准與開始，但保留拒絕入口', () => {
    setLocale('en-US');
    render(
      <ChatAnalysisConsentPanel
        requests={[request]}
        myParticipantId="participant-b"
        workingRequestId={null}
        loading={false}
        error=""
        formalActionsDisabled
        getParticipantLabel={(id) => id === 'participant-a' ? 'Side A' : 'Side B'}
        onRefresh={vi.fn()}
        onDecision={vi.fn()}
        onRevokeApproval={vi.fn()}
        onSubmitAndStart={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Approve this exact list' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline this list' })).toBeEnabled();
  });
});
