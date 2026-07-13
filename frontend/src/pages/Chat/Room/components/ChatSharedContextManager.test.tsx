import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContextCapsuleListItem } from '@/types/chat';
import { setLocale } from '@/utils/i18n';
import ChatSharedContextManager from './ChatSharedContextManager';

const FUTURE = '2099-01-01T00:00:00.000Z';

function buildCapsule(): ContextCapsuleListItem {
  return {
    id: 'capsule-1',
    room_id: 'room-1',
    owner_participant_id: 'participant-a',
    source_channel_id: 'private-channel',
    lineage_id: 'lineage-1',
    version: 1,
    summary: 'Only this approved wording may be shared.',
    source_refs: [],
    content_hash: 'a'.repeat(64),
    policy_version: 'context-policy-v1',
    sensitivity_class: 'sensitive',
    status: 'approved',
    expires_at: FUTURE,
    created_at: '2026-07-12T00:00:00.000Z',
    authorizations: [{
      id: 'grant-shared',
      capsule_id: 'capsule-1',
      subject_participant_id: 'participant-a',
      purpose: 'shared_mediation',
      audience: 'room_participants',
      target_type: 'chat_room',
      target_id: 'room-1',
      capsule_content_hash: 'a'.repeat(64),
      policy_version: 'context-policy-v1',
      granted_at: '2026-07-12T00:00:00.000Z',
      expires_at: FUTURE,
    }],
  };
}

describe('ChatSharedContextManager', () => {
  it('只顯示 active purpose grant，並逐項撤回', async () => {
    setLocale('en-US');
    const onRevokeAuthorization = vi.fn();
    render(
      <ChatSharedContextManager
        capsules={[buildCapsule()]}
        formalActionsBlocked={false}
        workingActionKey={null}
        workingAuthorizationId={null}
        onDiscard={vi.fn()}
        onGrant={vi.fn()}
        onRevokeAuthorization={onRevokeAuthorization}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByText('Only this approved wording may be shared.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop shared-conversation use' }));
    expect(onRevokeAuthorization).toHaveBeenCalledWith('grant-shared');
  });

  it('已撤回 grant 仍保留 capsule 並提供 re-authorize', () => {
    const capsule = buildCapsule();
    capsule.authorizations[0].revoked_at = '2026-07-12T01:00:00.000Z';
    render(
      <ChatSharedContextManager
        capsules={[capsule]}
        formalActionsBlocked={false}
        workingActionKey={null}
        workingAuthorizationId={null}
        onDiscard={vi.fn()}
        onGrant={vi.fn()}
        onRevokeAuthorization={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Allow again in shared conversation' })).toBeInTheDocument();
  });

  it('draft 可以明確批准、建立 revision 或 soft-discard', async () => {
    const capsule = buildCapsule();
    capsule.status = 'draft';
    capsule.source_refs = [{ kind: 'chat_message', id: 'private-1' }];
    capsule.authorizations = [];
    const onGrant = vi.fn();
    const onRevise = vi.fn();
    const onDiscard = vi.fn();
    render(
      <ChatSharedContextManager
        capsules={[capsule]}
        formalActionsBlocked={false}
        workingActionKey={null}
        workingAuthorizationId={null}
        onDiscard={onDiscard}
        onGrant={onGrant}
        onRevokeAuthorization={vi.fn()}
        onRevise={onRevise}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Approve for shared conversation' }));
    expect(onGrant).toHaveBeenCalledWith(capsule, 'shared_mediation');

    await userEvent.click(screen.getByRole('button', { name: 'Edit wording' }));
    const summary = screen.getByLabelText('Shareable version');
    await userEvent.clear(summary);
    await userEvent.type(summary, 'A safer revised wording.');
    await userEvent.click(screen.getByRole('button', { name: 'Save as a new version' }));
    expect(onRevise).toHaveBeenCalledWith(capsule, 'A safer revised wording.');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm discard' }));
    expect(onDiscard).toHaveBeenCalledWith(capsule);
  });

  it('safety 或 governance 未確認時只封鎖新增正式用途，既有撤回仍可用', async () => {
    const capsule = buildCapsule();
    capsule.authorizations = [];
    const onGrant = vi.fn();
    const { rerender } = render(
      <ChatSharedContextManager
        capsules={[capsule]}
        formalActionsBlocked
        workingActionKey={null}
        workingAuthorizationId={null}
        onDiscard={vi.fn()}
        onGrant={onGrant}
        onRevokeAuthorization={vi.fn()}
        onRevise={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Separately allow formal Analysis' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Allow again in shared conversation' }));
    expect(onGrant).toHaveBeenCalledWith(capsule, 'shared_mediation');

    capsule.authorizations = [buildCapsule().authorizations[0], {
      id: 'grant-formal',
      capsule_id: 'capsule-1',
      subject_participant_id: 'participant-a',
      purpose: 'formal_analysis_evidence',
      audience: 'analysis_participants',
      target_type: 'chat_room',
      target_id: 'room-1',
      capsule_content_hash: 'a'.repeat(64),
      policy_version: 'context-policy-v1',
      granted_at: '2026-07-12T00:00:00.000Z',
      expires_at: FUTURE,
    }];
    const onRevokeAuthorization = vi.fn();
    rerender(
      <ChatSharedContextManager
        capsules={[capsule]}
        formalActionsBlocked
        workingActionKey={null}
        workingAuthorizationId={null}
        onDiscard={vi.fn()}
        onGrant={onGrant}
        onRevokeAuthorization={onRevokeAuthorization}
        onRevise={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Revoke formal-Analysis access' }));
    expect(onRevokeAuthorization).toHaveBeenCalledWith('grant-formal');
  });
});
