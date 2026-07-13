import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChatAnalysisRequestListItem,
  ChatMessage,
  ContextCapsuleListItem,
} from '@emorapy/api-client';

import { m3Api } from './api';
import { chatQueryKeys } from './chatQueryKeys';
import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';
import {
  getEligibleSharedAnalysisMessages,
  isExactAnalysisSourceSetComplete,
} from './chatAnalysisSelection';

type UseChatAnalysisConsentInput = {
  canCreateAnalysisRequest: boolean;
  enabled: boolean;
  messages: ChatMessage[];
  roomId: string | null;
  sharedChannelId: string | null;
  viewerParticipantId: string | null;
};

export type ChatAnalysisSelectionReview = {
  capsules: ContextCapsuleListItem[];
  messages: ChatMessage[];
};

function hasCurrentFormalGrant(
  capsule: ContextCapsuleListItem,
  roomId: string,
  participantId: string | null,
  now: Date,
): boolean {
  if (
    !participantId
    || capsule.room_id !== roomId
    || capsule.owner_participant_id !== participantId
    || capsule.status !== 'approved'
    || capsule.revoked_at
    || !capsule.expires_at
    || new Date(capsule.expires_at) <= now
    || capsule.sensitivity_class === 'safety_restricted'
  ) return false;

  return capsule.authorizations.some((authorization) => (
    authorization.capsule_id === capsule.id
    && authorization.subject_participant_id === participantId
    && authorization.purpose === 'formal_analysis_evidence'
    && authorization.audience === 'analysis_participants'
    && authorization.target_type === 'chat_room'
    && authorization.target_id === roomId
    && authorization.capsule_content_hash === capsule.content_hash
    && authorization.policy_version === capsule.policy_version
    && !authorization.revoked_at
    && Boolean(authorization.expires_at)
    && new Date(authorization.expires_at as string) > now
  ));
}

function getExactApproval(
  request: ChatAnalysisRequestListItem,
  participantId: string | null,
) {
  if (!participantId) return undefined;
  return request.participant_approvals.find((approval) => (
    approval.participant_id === participantId
    && approval.selection_hash === request.selection_hash
    && approval.policy_version === request.policy_version
    && !approval.revoked_at
    && new Date(approval.expires_at).getTime() > Date.now()
  ));
}

export function useChatAnalysisConsent({
  canCreateAnalysisRequest,
  enabled,
  messages,
  roomId,
  sharedChannelId,
  viewerParticipantId,
}: UseChatAnalysisConsentInput) {
  const queryClient = useQueryClient();
  const identityScope = useIdentityQueryScope();
  const scopedEnabled = enabled
    && identityScope.privateDataEnabled
    && !identityScope.transitioning;
  const identityEpoch = identityScope.epoch;
  const requestActionLockRef = useRef<string | null>(null);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectedCapsuleIds, setSelectedCapsuleIds] = useState<string[]>([]);
  const [selectionReview, setSelectionReview] = useState<ChatAnalysisSelectionReview | null>(null);
  const [approvalRecoveryRequestId, setApprovalRecoveryRequestId] = useState<string | null>(null);

  const capsulesQuery = useQuery({
    queryKey: chatQueryKeys.contextCapsules(identityEpoch, roomId),
    queryFn: () => m3Api.chat.listContextCapsules(roomId as string),
    enabled: scopedEnabled && Boolean(roomId),
  });
  const requestsQuery = useQuery({
    queryKey: chatQueryKeys.analysisRequests(identityEpoch, roomId),
    queryFn: () => m3Api.chat.listAnalysisRequests(roomId as string),
    enabled: scopedEnabled && Boolean(roomId),
    refetchInterval: 5000,
  });

  const eligibleMessages = useMemo(
    () => getEligibleSharedAnalysisMessages(messages, sharedChannelId),
    [messages, sharedChannelId],
  );
  const formalCapsules = useMemo(() => {
    if (!roomId) return [];
    const now = new Date();
    return (capsulesQuery.data ?? []).filter((capsule) => (
      hasCurrentFormalGrant(capsule, roomId, viewerParticipantId, now)
    ));
  }, [capsulesQuery.data, roomId, viewerParticipantId]);
  const activeRequest = (requestsQuery.data ?? []).find((request) => (
    ['pending_approval', 'approved', 'submitted', 'processing'].includes(request.status)
    && new Date(request.expires_at).getTime() > Date.now()
  )) ?? null;
  const sourceSetComplete = Boolean(
    activeRequest && isExactAnalysisSourceSetComplete(activeRequest),
  );
  const viewerApproval = activeRequest
    ? getExactApproval(activeRequest, viewerParticipantId)
    : undefined;
  const approvedParticipantIds = new Set(
    activeRequest?.participant_approvals
      .filter((approval) => (
        approval.decision === 'approved'
        && approval.selection_hash === activeRequest.selection_hash
        && approval.policy_version === activeRequest.policy_version
        && !approval.revoked_at
        && new Date(approval.expires_at) > new Date()
      ))
      .map((approval) => approval.participant_id) ?? [],
  );
  const allParticipantsApproved = Boolean(
    activeRequest
    && sourceSetComplete
    && activeRequest.required_participant_ids.every((id) => approvedParticipantIds.has(id)),
  );
  const viewerIsRequester = activeRequest?.requested_by_participant_id === viewerParticipantId;

  const acquireRequestAction = useCallback((requestId: string): boolean => {
    if (requestActionLockRef.current) return false;
    requestActionLockRef.current = requestId;
    setWorkingRequestId(requestId);
    return true;
  }, []);

  const releaseRequestAction = useCallback((requestId: string): void => {
    if (requestActionLockRef.current !== requestId) return;
    requestActionLockRef.current = null;
    setWorkingRequestId(null);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (selection: ChatAnalysisSelectionReview) => {
      if (!canCreateAnalysisRequest) {
        throw new Error('Only roleA can create a formal analysis request');
      }
      const targetRoomId = roomId as string;
      const request = await m3Api.chat.createAnalysisRequest(targetRoomId, {
        selected_message_ids: selection.messages.map((message) => message.id),
        selected_capsule_ids: selection.capsules.map((capsule) => capsule.id),
      });
      try {
        await m3Api.chat.decideAnalysisRequest(targetRoomId, request.id, {
          decision: 'approved',
          policy_version: request.policy_version,
          selection_hash: request.selection_hash,
        });
        return { approvalRecorded: true, request };
      } catch {
        return { approvalRecorded: false, request };
      }
    },
    onSuccess: ({ approvalRecorded, request }) => {
      setSelectionReview(null);
      setApprovalRecoveryRequestId(approvalRecorded ? null : request.id);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.analysisRequests(identityEpoch, roomId),
      });
    },
  });

  const decideMutation = useMutation({
    mutationFn: ({ request, decision }: {
      request: ChatAnalysisRequestListItem;
      decision: 'approved' | 'declined';
    }) => m3Api.chat.decideAnalysisRequest(roomId as string, request.id, {
      decision,
      policy_version: request.policy_version,
      selection_hash: request.selection_hash,
    }),
    onSuccess: (_approval, variables) => {
      if (variables.request.id === approvalRecoveryRequestId) {
        setApprovalRecoveryRequestId(null);
      }
    },
    onSettled: async (_data, _error, variables) => {
      try {
        await queryClient.invalidateQueries({
          queryKey: chatQueryKeys.analysisRequests(identityEpoch, roomId),
        });
      } finally {
        releaseRequestAction(variables.request.id);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (request: ChatAnalysisRequestListItem) => {
      const targetRoomId = roomId as string;
      const analysisRequestId = request.status === 'submitted'
        ? request.id
        : (await m3Api.chat.submitAnalysisRequest(targetRoomId, request.id)).id;
      return m3Api.chat.requestJudgment(targetRoomId, {
        analysis_request_id: analysisRequestId,
      });
    },
    onSettled: async (_data, _error, request) => {
      try {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: chatQueryKeys.analysisRequests(identityEpoch, roomId),
          }),
          queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(identityEpoch, roomId) }),
          queryClient.invalidateQueries({
            queryKey: chatQueryKeys.judgmentStatus(identityEpoch, roomId),
          }),
        ]);
      } finally {
        releaseRequestAction(request.id);
      }
    },
  });

  const revokeApprovalMutation = useMutation({
    mutationFn: (request: ChatAnalysisRequestListItem) => (
      m3Api.chat.revokeAnalysisApproval(roomId as string, request.id, {
        selection_hash: request.selection_hash,
        policy_version: request.policy_version,
      })
    ),
    onSettled: async (_data, _error, request) => {
      try {
        await queryClient.invalidateQueries({
          queryKey: chatQueryKeys.analysisRequests(identityEpoch, roomId),
        });
      } finally {
        releaseRequestAction(request.id);
      }
    },
  });

  const decideRequest = useCallback((
    request: ChatAnalysisRequestListItem,
    decision: 'approved' | 'declined',
  ) => {
    if (!acquireRequestAction(request.id)) return;
    decideMutation.mutate({ request, decision });
  }, [acquireRequestAction, decideMutation]);

  const revokeApproval = useCallback((request: ChatAnalysisRequestListItem) => {
    if (!acquireRequestAction(request.id)) return;
    revokeApprovalMutation.mutate(request);
  }, [acquireRequestAction, revokeApprovalMutation]);

  const submitRequest = useCallback((request: ChatAnalysisRequestListItem) => {
    if (!acquireRequestAction(request.id)) return;
    submitMutation.mutate(request);
  }, [acquireRequestAction, submitMutation]);

  const toggleMessage = useCallback((messageId: string) => {
    setSelectedMessageIds((current) => (
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId]
    ));
  }, []);

  const toggleCapsule = useCallback((capsuleId: string) => {
    setSelectedCapsuleIds((current) => (
      current.includes(capsuleId)
        ? current.filter((id) => id !== capsuleId)
        : [...current, capsuleId]
    ));
  }, []);

  const openSelectionReview = useCallback(() => {
    if (!canCreateAnalysisRequest) return;
    const selectedMessageSet = new Set(selectedMessageIds);
    const selectedCapsuleSet = new Set(selectedCapsuleIds);
    const selectedMessages = eligibleMessages.filter((message) => selectedMessageSet.has(message.id));
    const selectedCapsules = formalCapsules.filter((capsule) => selectedCapsuleSet.has(capsule.id));
    if (selectedMessages.length + selectedCapsules.length === 0) return;
    setSelectionReview({
      capsules: selectedCapsules,
      messages: selectedMessages,
    });
  }, [
    canCreateAnalysisRequest,
    eligibleMessages,
    formalCapsules,
    selectedCapsuleIds,
    selectedMessageIds,
  ]);

  const closeSelectionReview = useCallback(() => {
    if (!createMutation.isPending) setSelectionReview(null);
  }, [createMutation.isPending]);

  useEffect(() => {
    requestActionLockRef.current = null;
    setWorkingRequestId(null);
    setSelectedMessageIds([]);
    setSelectedCapsuleIds([]);
    setSelectionReview(null);
    setApprovalRecoveryRequestId(null);
  }, [roomId]);

  useEffect(() => {
    if (canCreateAnalysisRequest) return;
    setSelectedMessageIds([]);
    setSelectedCapsuleIds([]);
    setSelectionReview(null);
  }, [canCreateAnalysisRequest]);

  useEffect(() => {
    const eligibleIds = new Set(eligibleMessages.map((message) => message.id));
    setSelectedMessageIds((current) => {
      const next = current.filter((id) => eligibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [eligibleMessages]);

  useEffect(() => {
    const eligibleIds = new Set(formalCapsules.map((capsule) => capsule.id));
    setSelectedCapsuleIds((current) => {
      const next = current.filter((id) => eligibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [formalCapsules]);

  useEffect(() => {
    if (
      activeRequest
      && activeRequest.id === approvalRecoveryRequestId
      && viewerApproval?.decision === 'approved'
    ) {
      setApprovalRecoveryRequestId(null);
    }
  }, [activeRequest, approvalRecoveryRequestId, viewerApproval]);

  return {
    activeRequest,
    allParticipantsApproved,
    approvalRecoveryPending: approvalRecoveryRequestId !== null,
    approvedParticipantCount: approvedParticipantIds.size,
    allCapsules: capsulesQuery.data ?? [],
    capsulesError: capsulesQuery.error,
    closeSelectionReview,
    createMutation,
    decideRequest,
    decideMutation,
    eligibleMessages,
    formalCapsules,
    openSelectionReview,
    requestsError: requestsQuery.error,
    revokeApproval,
    revokeApprovalMutation,
    selectedCapsuleIds,
    selectedMessageIds,
    selectionReview,
    sourceSetComplete,
    submitRequest,
    submitMutation,
    toggleCapsule,
    toggleMessage,
    viewerApproval,
    viewerIsRequester,
    workingRequestId,
  };
}
