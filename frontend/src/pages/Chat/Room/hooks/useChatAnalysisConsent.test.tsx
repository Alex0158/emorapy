import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatAnalysisRequestListItem,
  ChatMessage,
  ContextCapsuleListItem,
} from '@/types/chat';
import {
  getEligibleSharedAnalysisMessages,
  hasAllExactApprovals,
  hasExactAnalysisSourcePreviews,
  isFormalAnalysisCapsuleEligible,
  useChatAnalysisConsent,
} from './useChatAnalysisConsent';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  decide: vi.fn(),
  listRequests: vi.fn(),
  listCapsules: vi.fn(),
  revokeApproval: vi.fn(),
  revokeAuthorization: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('@/services/api/chat', () => ({
  createChatAnalysisRequest: (...args: unknown[]) => mocks.create(...args),
  decideChatAnalysisRequest: (...args: unknown[]) => mocks.decide(...args),
  listChatAnalysisRequests: (...args: unknown[]) => mocks.listRequests(...args),
  listChatContextCapsules: (...args: unknown[]) => mocks.listCapsules(...args),
  revokeChatAnalysisApproval: (...args: unknown[]) => mocks.revokeApproval(...args),
  revokeChatContextAuthorization: (...args: unknown[]) => mocks.revokeAuthorization(...args),
  submitChatAnalysisRequest: (...args: unknown[]) => mocks.submit(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const FUTURE = '2099-01-01T00:00:00.000Z';

function buildRequest(status: ChatAnalysisRequestListItem['status'] = 'approved'): ChatAnalysisRequestListItem {
  return {
    id: 'analysis-1',
    room_id: 'room-1',
    requested_by_participant_id: 'participant-a',
    status,
    selection_snapshot: {
      message_refs: [{ kind: 'chat_message', id: 'shared-1', content_hash: 'a'.repeat(64) }],
      capsule_refs: [],
    },
    selection_hash: 'b'.repeat(64),
    required_participant_ids: ['participant-a', 'participant-b'],
    policy_version: 'context-policy-v1',
    expires_at: FUTURE,
    created_at: '2026-07-12T00:00:00.000Z',
    updated_at: '2026-07-12T00:00:00.000Z',
    participant_approvals: ['participant-a', 'participant-b'].map((participantId, index) => ({
      id: `approval-${index}`,
      analysis_request_id: 'analysis-1',
      participant_id: participantId,
      decision: 'approved',
      selection_hash: 'b'.repeat(64),
      policy_version: 'context-policy-v1',
      decision_at: '2026-07-12T00:00:00.000Z',
      expires_at: FUTURE,
    })),
    source_previews: {
      messages: [{
        kind: 'chat_message',
        id: 'shared-1',
        content: 'Both people can review this exact message.',
        content_hash: 'a'.repeat(64),
        sender_participant_id: 'participant-a',
        sender_role: 'roleA',
        created_at: '2026-07-12T00:00:00.000Z',
      }],
      capsules: [],
    },
  };
}

function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'shared-1',
    room_id: 'room-1',
    channel_id: 'shared-channel',
    sender_participant_id: 'participant-a',
    content: 'Shared human message',
    message_type: 'user_text',
    visibility_scope: 'all',
    safety_flag: false,
    created_at: '2026-07-12T00:00:00.000Z',
    sender_participant: {
      id: 'participant-a',
      room_id: 'room-1',
      participant_type: 'user',
      user_id: 'user-a',
      role_in_room: 'roleA',
      joined_at: '2026-07-12T00:00:00.000Z',
      is_active: true,
      private_context_use_mode: 'private_only',
    },
    ...overrides,
  };
}

describe('useChatAnalysisConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listRequests.mockResolvedValue([]);
    mocks.listCapsules.mockResolvedValue([]);
    mocks.decide.mockResolvedValue({ id: 'approval-a' });
    mocks.revokeApproval.mockResolvedValue({ id: 'approval-a', revoked_at: '2026-07-12T01:00:00.000Z' });
    mocks.revokeAuthorization.mockResolvedValue({ id: 'grant-1', revoked_at: '2026-07-12T01:00:00.000Z' });
  });

  it('只讓 shared channel 的安全真人 user_text 進入可選清單', () => {
    const eligible = getEligibleSharedAnalysisMessages([
      buildMessage(),
      buildMessage({ id: 'private-1', channel_id: 'private-channel', visibility_scope: 'owner_only' }),
      buildMessage({ id: 'ai-1', message_type: 'ai_mediation' }),
      buildMessage({ id: 'safety-1', safety_flag: true }),
    ], 'shared-channel');

    expect(eligible.map((message) => message.id)).toEqual(['shared-1']);
  });

  it('source preview 必須逐項對齊 kind、id、hash 與 version，同數量錯配或 duplicate 也應拒絕', () => {
    const request = buildRequest();
    expect(hasExactAnalysisSourcePreviews(request)).toBe(true);
    expect(hasExactAnalysisSourcePreviews({
      ...request,
      source_previews: {
        ...request.source_previews,
        messages: [{
          ...request.source_previews.messages[0],
          id: 'different-message',
        }],
      },
    })).toBe(false);
    expect(hasExactAnalysisSourcePreviews({
      ...request,
      selection_snapshot: {
        ...request.selection_snapshot,
        message_refs: [
          request.selection_snapshot.message_refs[0],
          request.selection_snapshot.message_refs[0],
        ],
      },
      source_previews: {
        ...request.source_previews,
        messages: [
          request.source_previews.messages[0],
          request.source_previews.messages[0],
        ],
      },
    })).toBe(false);
  });

  it('私人摘要只有 exact formal grant、相同 hash、未撤回且未過期時才可選', () => {
    const capsule: ContextCapsuleListItem = {
      id: 'capsule-1',
      room_id: 'room-1',
      owner_participant_id: 'participant-a',
      source_channel_id: 'private-channel',
      lineage_id: 'lineage-1',
      version: 1,
      summary: 'Approved summary only',
      source_refs: [],
      content_hash: 'c'.repeat(64),
      policy_version: 'context-policy-v1',
      sensitivity_class: 'sensitive',
      status: 'approved',
      expires_at: FUTURE,
      created_at: '2026-07-12T00:00:00.000Z',
      authorizations: [{
        id: 'grant-1',
        capsule_id: 'capsule-1',
        subject_participant_id: 'participant-a',
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: 'room-1',
        capsule_content_hash: 'c'.repeat(64),
        policy_version: 'context-policy-v1',
        granted_at: '2026-07-12T00:00:00.000Z',
        expires_at: FUTURE,
      }],
    };

    expect(isFormalAnalysisCapsuleEligible(capsule, 'room-1', 'participant-a')).toBe(true);
    expect(isFormalAnalysisCapsuleEligible({
      ...capsule,
      authorizations: [{ ...capsule.authorizations[0], capsule_content_hash: 'd'.repeat(64) }],
    }, 'room-1', 'participant-a')).toBe(false);
  });

  it('建立固定清單後立即以 server selection hash 記錄發起方 exact approval', async () => {
    const created = buildRequest('pending_approval');
    mocks.create.mockResolvedValue(created);
    const onStartAnalysis = vi.fn();
    const { result } = renderHook(() => useChatAnalysisConsent({
      roomId: 'room-1',
      messages: [buildMessage()],
      sharedChannelId: 'shared-channel',
      myParticipantId: 'participant-a',
      blocked: false,
      onStartAnalysis,
    }));

    await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());
    act(() => result.current.openSelection());
    expect(result.current.selectedMessageIds).toEqual([]);
    act(() => result.current.setSelectedMessageIds(['shared-1']));
    await act(async () => { await result.current.createAndApprove(); });

    expect(mocks.create).toHaveBeenCalledWith('room-1', ['shared-1'], []);
    expect(mocks.decide).toHaveBeenCalledWith('room-1', created, 'approved');
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.decide.mock.invocationCallOrder[0],
    );
    expect(onStartAnalysis).not.toHaveBeenCalled();
  });

  it('只在所有 required participant exact approved 後由 requester submit，再以 request id 啟動梳理', async () => {
    const request = buildRequest('approved');
    const submitted = { ...request, status: 'submitted' as const };
    mocks.listRequests.mockResolvedValue([request]);
    mocks.submit.mockResolvedValue(submitted);
    const onStartAnalysis = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useChatAnalysisConsent({
      roomId: 'room-1',
      messages: [buildMessage()],
      sharedChannelId: 'shared-channel',
      myParticipantId: 'participant-a',
      blocked: false,
      onStartAnalysis,
    }));

    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    expect(hasAllExactApprovals(request)).toBe(true);
    await act(async () => { await result.current.submitAndStart(request); });

    expect(mocks.submit).toHaveBeenCalledWith('room-1', 'analysis-1');
    expect(onStartAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(mocks.submit.mock.invocationCallOrder[0]).toBeLessThan(
      onStartAnalysis.mock.invocationCallOrder[0],
    );
  });

  it('source preview 與 snapshot 同數量但 hash 錯配時不得 submit 或啟動梳理', async () => {
    const request = buildRequest('approved');
    request.source_previews.messages[0].content_hash = 'f'.repeat(64);
    mocks.listRequests.mockResolvedValue([request]);
    const onStartAnalysis = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useChatAnalysisConsent({
      roomId: 'room-1',
      messages: [buildMessage()],
      sharedChannelId: 'shared-channel',
      myParticipantId: 'participant-a',
      blocked: false,
      onStartAnalysis,
    }));

    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    await act(async () => { await result.current.submitAndStart(request); });

    expect(mocks.submit).not.toHaveBeenCalled();
    expect(onStartAnalysis).not.toHaveBeenCalled();
  });

  it('未開始處理前可撤回自己的 exact approval，並以原 request hash/version 呼叫 API', async () => {
    const request = buildRequest('approved');
    mocks.listRequests.mockResolvedValue([request]);
    const { result } = renderHook(() => useChatAnalysisConsent({
      roomId: 'room-1',
      messages: [buildMessage()],
      sharedChannelId: 'shared-channel',
      myParticipantId: 'participant-a',
      blocked: false,
      onStartAnalysis: vi.fn(),
    }));

    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    await act(async () => { await result.current.revokeApproval(request); });

    expect(mocks.revokeApproval).toHaveBeenCalledWith('room-1', request);
  });

  it('同一 tick 先撤回批准後不得再 submit 或啟動梳理', async () => {
    const request = buildRequest('submitted');
    mocks.listRequests.mockResolvedValue([request]);
    let resolveRevoke: (value: unknown) => void = () => undefined;
    mocks.revokeApproval.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRevoke = resolve;
    }));
    const onStartAnalysis = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useChatAnalysisConsent({
      roomId: 'room-1',
      messages: [buildMessage()],
      sharedChannelId: 'shared-channel',
      myParticipantId: 'participant-a',
      blocked: false,
      onStartAnalysis,
    }));

    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    let revokePromise: Promise<void> = Promise.resolve();
    let submitPromise: Promise<void> = Promise.resolve();
    act(() => {
      revokePromise = result.current.revokeApproval(request);
      submitPromise = result.current.submitAndStart(request);
    });

    expect(mocks.revokeApproval).toHaveBeenCalledTimes(1);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(onStartAnalysis).not.toHaveBeenCalled();
    expect(result.current.workingRequestId).toBe('analysis-1');

    await act(async () => {
      resolveRevoke({ id: 'approval-a', revoked_at: '2026-07-12T01:00:00.000Z' });
      await Promise.all([revokePromise, submitPromise]);
    });
  });

  it('可逐項撤回 purpose-scoped Context authorization', async () => {
    const { result } = renderHook(() => useChatAnalysisConsent({
      roomId: 'room-1',
      messages: [buildMessage()],
      sharedChannelId: 'shared-channel',
      myParticipantId: 'participant-a',
      blocked: false,
      onStartAnalysis: vi.fn(),
    }));

    await waitFor(() => expect(mocks.listCapsules).toHaveBeenCalled());
    await act(async () => { await result.current.revokeAuthorization('grant-1'); });

    expect(mocks.revokeAuthorization).toHaveBeenCalledWith('room-1', 'grant-1');
  });
});
