import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  getEligibleSharedAnalysisMessages,
  isExactAnalysisSourceSetComplete,
} from '@emorapy/api-client';
import {
  createChatAnalysisRequest,
  decideChatAnalysisRequest,
  listChatAnalysisRequests,
  listChatContextCapsules,
  revokeChatAnalysisApproval,
  revokeChatContextAuthorization,
  submitChatAnalysisRequest,
} from '@/services/api/chat';
import type {
  ChatAnalysisParticipantApproval,
  ChatAnalysisRequest,
  ChatAnalysisRequestListItem,
  ChatMessage,
  ContextCapsuleListItem,
} from '@/types/chat';
import { t } from '@/utils/i18n';

const ACTIVE_REQUEST_STATUSES = new Set([
  'pending_approval',
  'approved',
  'submitted',
  'processing',
]);
const REFRESH_INTERVAL_MS = 8_000;

export { getEligibleSharedAnalysisMessages } from '@emorapy/api-client';
export const hasExactAnalysisSourcePreviews = isExactAnalysisSourceSetComplete;

export function getExactApproval(
  request: ChatAnalysisRequestListItem,
  participantId: string | null,
): ChatAnalysisParticipantApproval | null {
  if (!participantId) return null;
  return request.participant_approvals.find((approval) => (
    approval.participant_id === participantId
    && approval.selection_hash === request.selection_hash
    && approval.policy_version === request.policy_version
    && approval.revoked_at == null
    && new Date(approval.expires_at).getTime() > Date.now()
  )) ?? null;
}

export function hasAllExactApprovals(request: ChatAnalysisRequestListItem): boolean {
  return request.required_participant_ids.every((participantId) => (
    getExactApproval(request, participantId)?.decision === 'approved'
  ));
}

export function isFormalAnalysisCapsuleEligible(
  capsule: ContextCapsuleListItem,
  roomId: string,
  participantId: string | null,
  now = Date.now(),
): boolean {
  if (!participantId || capsule.owner_participant_id !== participantId) return false;
  if (
    capsule.room_id !== roomId
    || capsule.status !== 'approved'
    || capsule.revoked_at != null
    || capsule.sensitivity_class === 'safety_restricted'
    || !capsule.expires_at
    || new Date(capsule.expires_at).getTime() <= now
  ) {
    return false;
  }

  return capsule.authorizations.some((authorization) => (
    authorization.subject_participant_id === participantId
    && authorization.capsule_id === capsule.id
    && authorization.capsule_content_hash === capsule.content_hash
    && authorization.purpose === 'formal_analysis_evidence'
    && authorization.audience === 'analysis_participants'
    && authorization.target_type === 'chat_room'
    && authorization.target_id === roomId
    && authorization.policy_version === capsule.policy_version
    && authorization.revoked_at == null
    && authorization.expires_at != null
    && new Date(authorization.expires_at).getTime() > now
  ));
}

interface UseChatAnalysisConsentInput {
  roomId: string | null;
  messages: ChatMessage[];
  sharedChannelId: string | null;
  myParticipantId: string | null;
  blocked: boolean;
  onStartAnalysis: (analysisRequestId: string) => Promise<void>;
}

export function useChatAnalysisConsent({
  roomId,
  messages,
  sharedChannelId,
  myParticipantId,
  blocked,
  onStartAnalysis,
}: UseChatAnalysisConsentInput) {
  const mountedRef = useRef(true);
  const activeRoomIdRef = useRef(roomId);
  activeRoomIdRef.current = roomId;
  const [requests, setRequests] = useState<ChatAnalysisRequestListItem[]>([]);
  const [capsules, setCapsules] = useState<ContextCapsuleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectedCapsuleIds, setSelectedCapsuleIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [workingAuthorizationId, setWorkingAuthorizationId] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const creatingSequenceRef = useRef(0);
  const requestActionSequenceRef = useRef(0);
  const requestActionLockRef = useRef<{
    requestId: string;
    roomId: string;
    sequence: number;
  } | null>(null);

  const eligibleMessages = useMemo(
    () => getEligibleSharedAnalysisMessages(messages, sharedChannelId),
    [messages, sharedChannelId],
  );
  const eligibleCapsules = useMemo(
    () => capsules.filter((capsule) => (
      roomId ? isFormalAnalysisCapsuleEligible(capsule, roomId, myParticipantId) : false
    )),
    [capsules, myParticipantId, roomId],
  );
  const hasOpenRequest = useMemo(
    () => requests.some((request) => (
      ACTIVE_REQUEST_STATUSES.has(request.status)
      && new Date(request.expires_at).getTime() > Date.now()
    )),
    [requests],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async (showLoading = false) => {
    const targetRoomId = activeRoomIdRef.current;
    if (!targetRoomId) return;
    if (showLoading) setLoading(true);
    try {
      const [capsuleResult, requestResult] = await Promise.allSettled([
        listChatContextCapsules(targetRoomId),
        listChatAnalysisRequests(targetRoomId),
      ]);
      if (!mountedRef.current || activeRoomIdRef.current !== targetRoomId) return;
      if (capsuleResult.status === 'fulfilled') setCapsules(capsuleResult.value);
      if (requestResult.status === 'fulfilled') setRequests(requestResult.value);
      setLoadError(
        capsuleResult.status === 'fulfilled' && requestResult.status === 'fulfilled'
          ? ''
          : t('chat.analysis.loadError'),
      );
    } finally {
      if (showLoading && mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setRequests([]);
    setCapsules([]);
    setSelectionOpen(false);
    setSelectedMessageIds([]);
    setSelectedCapsuleIds([]);
    setLoadError('');
    creatingSequenceRef.current += 1;
    requestActionSequenceRef.current += 1;
    creatingRef.current = false;
    requestActionLockRef.current = null;
    setCreating(false);
    setWorkingRequestId(null);
    setWorkingAuthorizationId(null);
    if (!roomId) return;

    void refresh(true);
    const timer = window.setInterval(() => { void refresh(false); }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, roomId]);

  useEffect(() => {
    if (!blocked) return;
    setSelectionOpen(false);
  }, [blocked]);

  useEffect(() => {
    if (!hasOpenRequest) return;
    setSelectionOpen(false);
  }, [hasOpenRequest]);

  useEffect(() => {
    const validMessageIds = new Set(eligibleMessages.map((message) => message.id));
    const validCapsuleIds = new Set(eligibleCapsules.map((capsule) => capsule.id));
    setSelectedMessageIds((current) => {
      const next = current.filter((id) => validMessageIds.has(id));
      return next.length === current.length ? current : next;
    });
    setSelectedCapsuleIds((current) => {
      const next = current.filter((id) => validCapsuleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [eligibleCapsules, eligibleMessages]);

  const openSelection = useCallback(() => {
    if (!roomId || blocked || hasOpenRequest) return;
    setSelectedMessageIds([]);
    setSelectedCapsuleIds([]);
    setSelectionOpen(true);
    void refresh(false);
  }, [blocked, hasOpenRequest, refresh, roomId]);

  const closeSelection = useCallback(() => {
    if (!creating) setSelectionOpen(false);
  }, [creating]);

  const createAndApprove = useCallback(async () => {
    const targetRoomId = activeRoomIdRef.current;
    if (
      !targetRoomId
      || blocked
      || creatingRef.current
      || hasOpenRequest
      || selectedMessageIds.length + selectedCapsuleIds.length === 0
    ) {
      return;
    }

    const creatingSequence = creatingSequenceRef.current + 1;
    creatingSequenceRef.current = creatingSequence;
    creatingRef.current = true;
    setCreating(true);
    try {
      const request = await createChatAnalysisRequest(
        targetRoomId,
        selectedMessageIds,
        selectedCapsuleIds,
      );
      try {
        await decideChatAnalysisRequest(targetRoomId, request, 'approved');
        toast.success(t('chat.analysis.requestCreated'));
      } catch {
        toast.warning(t('chat.analysis.requestCreatedApprovalPending'));
      }
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) setSelectionOpen(false);
      await refresh(false);
    } catch {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        toast.error(t('chat.analysis.createError'));
      }
    } finally {
      if (creatingSequenceRef.current === creatingSequence) {
        creatingRef.current = false;
        if (mountedRef.current && activeRoomIdRef.current === targetRoomId) setCreating(false);
      }
    }
  }, [blocked, hasOpenRequest, refresh, selectedCapsuleIds, selectedMessageIds]);

  const acquireRequestAction = useCallback((roomId: string, requestId: string): number | null => {
    if (requestActionLockRef.current) return null;
    const sequence = requestActionSequenceRef.current + 1;
    requestActionSequenceRef.current = sequence;
    requestActionLockRef.current = { requestId, roomId, sequence };
    setWorkingRequestId(requestId);
    return sequence;
  }, []);

  const releaseRequestAction = useCallback((
    roomId: string,
    requestId: string,
    sequence: number,
  ): void => {
    const lock = requestActionLockRef.current;
    if (
      !lock
      || lock.roomId !== roomId
      || lock.requestId !== requestId
      || lock.sequence !== sequence
    ) return;
    requestActionLockRef.current = null;
    if (mountedRef.current && activeRoomIdRef.current === roomId) {
      setWorkingRequestId(null);
    }
  }, []);

  const decide = useCallback(async (
    request: ChatAnalysisRequestListItem,
    decision: 'approved' | 'declined',
  ) => {
    const targetRoomId = activeRoomIdRef.current;
    if (
      !targetRoomId
      || (blocked && decision === 'approved')
      || (decision === 'approved' && !hasExactAnalysisSourcePreviews(request))
    ) return;
    const actionSequence = acquireRequestAction(targetRoomId, request.id);
    if (actionSequence == null) return;
    try {
      await decideChatAnalysisRequest(targetRoomId, request, decision);
      toast.success(t(
        decision === 'approved'
          ? 'chat.analysis.approved'
          : 'chat.analysis.declined',
      ));
      await refresh(false);
    } catch {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        toast.error(t('chat.analysis.decisionError'));
      }
    } finally {
      releaseRequestAction(targetRoomId, request.id, actionSequence);
    }
  }, [acquireRequestAction, blocked, refresh, releaseRequestAction]);

  const submitAndStart = useCallback(async (request: ChatAnalysisRequestListItem) => {
    const targetRoomId = activeRoomIdRef.current;
    if (
      !targetRoomId
      || blocked
      || request.requested_by_participant_id !== myParticipantId
      || !hasAllExactApprovals(request)
      || !hasExactAnalysisSourcePreviews(request)
    ) {
      return;
    }

    const actionSequence = acquireRequestAction(targetRoomId, request.id);
    if (actionSequence == null) return;
    try {
      let analysisRequest: ChatAnalysisRequest = request;
      if (request.status !== 'submitted') {
        analysisRequest = await submitChatAnalysisRequest(targetRoomId, request.id);
      }
      await onStartAnalysis(analysisRequest.id);
      await refresh(false);
    } catch {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        toast.error(t('chat.analysis.submitError'));
      }
    } finally {
      releaseRequestAction(targetRoomId, request.id, actionSequence);
    }
  }, [acquireRequestAction, blocked, myParticipantId, onStartAnalysis, refresh, releaseRequestAction]);

  const revokeApproval = useCallback(async (request: ChatAnalysisRequestListItem) => {
    const targetRoomId = activeRoomIdRef.current;
    if (
      !targetRoomId
      || !['pending_approval', 'approved', 'submitted'].includes(request.status)
      || getExactApproval(request, myParticipantId)?.decision !== 'approved'
    ) return;

    const actionSequence = acquireRequestAction(targetRoomId, request.id);
    if (actionSequence == null) return;
    try {
      await revokeChatAnalysisApproval(targetRoomId, request);
      toast.success(t('chat.analysis.approvalRevoked'));
      await refresh(false);
    } catch {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        toast.error(t('chat.analysis.revokeApprovalError'));
      }
    } finally {
      releaseRequestAction(targetRoomId, request.id, actionSequence);
    }
  }, [acquireRequestAction, myParticipantId, refresh, releaseRequestAction]);

  const revokeAuthorization = useCallback(async (authorizationId: string) => {
    const targetRoomId = activeRoomIdRef.current;
    if (!targetRoomId || workingAuthorizationId) return;

    setWorkingAuthorizationId(authorizationId);
    try {
      await revokeChatContextAuthorization(targetRoomId, authorizationId);
      toast.success(t('chat.capsule.authorizationRevoked'));
      await refresh(false);
    } catch {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        toast.error(t('chat.capsule.revokeAuthorizationError'));
      }
    } finally {
      if (mountedRef.current && activeRoomIdRef.current === targetRoomId) {
        setWorkingAuthorizationId(null);
      }
    }
  }, [refresh, workingAuthorizationId]);

  return {
    allCapsules: capsules,
    capsules: eligibleCapsules,
    closeSelection,
    createAndApprove,
    creating,
    decide,
    eligibleMessages,
    hasOpenRequest,
    loadError,
    loading,
    openSelection,
    refresh,
    requests,
    revokeApproval,
    revokeAuthorization,
    selectedCapsuleIds,
    selectedMessageIds,
    selectionOpen,
    setSelectedCapsuleIds,
    setSelectedMessageIds,
    submitAndStart,
    workingAuthorizationId,
    workingRequestId,
  };
}
