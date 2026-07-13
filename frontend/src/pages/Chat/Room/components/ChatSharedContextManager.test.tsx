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
        workingAuthorizationId={null}
        onRevokeAuthorization={onRevokeAuthorization}
      />,
    );

    expect(screen.getByText('Only this approved wording may be shared.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop shared-conversation use' }));
    expect(onRevokeAuthorization).toHaveBeenCalledWith('grant-shared');
  });

  it('expired 或已撤回 grant 不形成管理面板', () => {
    const capsule = buildCapsule();
    capsule.authorizations[0].revoked_at = '2026-07-12T01:00:00.000Z';
    const { container } = render(
      <ChatSharedContextManager
        capsules={[capsule]}
        workingAuthorizationId={null}
        onRevokeAuthorization={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
