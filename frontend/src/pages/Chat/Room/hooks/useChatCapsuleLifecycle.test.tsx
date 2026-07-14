import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextCapsuleListItem } from '@/types/chat';
import { useChatCapsuleLifecycle } from './useChatCapsuleLifecycle';

const mocks = vi.hoisted(() => ({
  discard: vi.fn(),
  grant: vi.fn(),
  revise: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/api/chat', () => ({
  discardChatContextCapsule: (...args: unknown[]) => mocks.discard(...args),
  grantChatContextAuthorization: (...args: unknown[]) => mocks.grant(...args),
  reviseChatContextCapsule: (...args: unknown[]) => mocks.revise(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

function buildCapsule(): ContextCapsuleListItem {
  return {
    id: 'capsule-1',
    room_id: 'room-1',
    owner_participant_id: 'participant-a',
    source_channel_id: 'private-1',
    lineage_id: 'lineage-1',
    version: 1,
    summary: 'Original wording',
    source_refs: [
      { kind: 'chat_message', id: 'message-2' },
      { kind: 'chat_message', id: 'message-1' },
    ],
    content_hash: 'a'.repeat(64),
    policy_version: 'context-policy-v1',
    sensitivity_class: 'sensitive',
    status: 'draft',
    expires_at: '2099-01-01T00:00:00.000Z',
    created_at: '2026-07-13T00:00:00.000Z',
    authorizations: [],
  };
}

describe('useChatCapsuleLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.discard.mockResolvedValue({});
    mocks.grant.mockResolvedValue({});
    mocks.revise.mockResolvedValue({});
  });

  it('revision 保留 exact source refs，grant 只送指定 purpose，完成後刷新 read model', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const capsule = buildCapsule();
    const { result } = renderHook(() => useChatCapsuleLifecycle({ roomId: 'room-1', refresh }));

    await act(async () => result.current.revise(capsule, ' Revised wording '));
    expect(mocks.revise).toHaveBeenCalledWith('room-1', 'capsule-1', {
      source_channel_id: 'private-1',
      source_message_ids: ['message-2', 'message-1'],
      summary: 'Revised wording',
      expires_at: '2099-01-01T00:00:00.000Z',
    });

    await act(async () => result.current.grant(capsule, 'formal_analysis_evidence'));
    expect(mocks.grant).toHaveBeenCalledWith('room-1', 'capsule-1', {
      capsule_content_hash: 'a'.repeat(64),
      purpose: 'formal_analysis_evidence',
      audience: 'analysis_participants',
      target_type: 'chat_room',
      target_id: 'room-1',
      policy_version: 'context-policy-v1',
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });

  it('同一 tick 只允許一項 lifecycle mutation', async () => {
    let release!: () => void;
    mocks.discard.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const capsule = buildCapsule();
    const { result } = renderHook(() => useChatCapsuleLifecycle({
      roomId: 'room-1',
      refresh: vi.fn().mockResolvedValue(undefined),
    }));

    act(() => {
      void result.current.discard(capsule);
      void result.current.grant(capsule, 'shared_mediation');
    });
    expect(mocks.discard).toHaveBeenCalledTimes(1);
    expect(mocks.grant).not.toHaveBeenCalled();
    await act(async () => release());
  });
});
