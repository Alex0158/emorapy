import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from 'sonner';
import { getChatJudgmentStatus, requestChatJudgment } from "@/services/api/chat";
import { t } from "@/utils/i18n";
import type { ChatRoom } from "@/types/chat";
import {
	buildChatJudgmentPayload,
	getJudgmentPollingDecision,
	getRoomMutationErrorFeedback,
	isRoomActionBlocked,
	type ChatActionFeedback,
} from "../chatRoomUtils";

interface UseChatRoomJudgmentActionsInput {
	room: ChatRoom | null;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	navigateToJudgment: (judgmentId: string) => void;
	refreshRoomSafely: (targetRoomId: string) => Promise<unknown>;
	setErrorText: (value: string) => void;
	showChatActionFeedback: (feedback: ChatActionFeedback) => void;
}

export function useChatRoomJudgmentActions({
	room,
	mountedRef,
	isRoomTargetActive,
	navigateToJudgment,
	refreshRoomSafely,
	setErrorText,
	showChatActionFeedback,
}: UseChatRoomJudgmentActionsInput) {
	const [judgingRoomId, setJudgingRoomId] = useState<string | null>(null);
	const judgmentPollingRef = useRef<number | null>(null);
	const judgmentPollingAttemptsRef = useRef(0);
	const judgmentPollingRoomIdRef = useRef<string | null>(null);
	const judgmentPollingInFlightRef = useRef(false);
	const requestJudgmentInFlightRoomIdRef = useRef<string | null>(null);

	const clearJudgmentPolling = useCallback(() => {
		if (judgmentPollingRef.current) {
			clearInterval(judgmentPollingRef.current);
			judgmentPollingRef.current = null;
		}
		judgmentPollingAttemptsRef.current = 0;
		judgmentPollingRoomIdRef.current = null;
		judgmentPollingInFlightRef.current = false;
	}, []);

	const clearJudgmentRequestForRoom = useCallback((targetRoomId: string) => {
		if (requestJudgmentInFlightRoomIdRef.current === targetRoomId) {
			requestJudgmentInFlightRoomIdRef.current = null;
		}
		if (mountedRef.current) {
			setJudgingRoomId((current) => (current === targetRoomId ? null : current));
		}
	}, [mountedRef]);

	const shouldApplyJudgmentResult = useCallback(
		(targetRoomId: string) => mountedRef.current && isRoomTargetActive(targetRoomId),
		[isRoomTargetActive, mountedRef],
	);

	const tryStartJudgmentPolling = useCallback((targetRoomId: string) => {
		if (!isRoomTargetActive(targetRoomId)) {
			return;
		}
		if (judgmentPollingRoomIdRef.current === targetRoomId && judgmentPollingRef.current) {
			return;
		}
		clearJudgmentPolling();
		judgmentPollingAttemptsRef.current = 0;
		judgmentPollingRoomIdRef.current = targetRoomId;
		judgmentPollingRef.current = setInterval(async () => {
			if (!shouldApplyJudgmentResult(targetRoomId) || judgmentPollingRoomIdRef.current !== targetRoomId) {
				clearJudgmentPolling();
				return;
			}
			if (judgmentPollingInFlightRef.current) {
				return;
			}
			judgmentPollingInFlightRef.current = true;
			try {
				judgmentPollingAttemptsRef.current += 1;
				const timeoutDecision = getJudgmentPollingDecision({
					attempts: judgmentPollingAttemptsRef.current,
				});
				if (timeoutDecision.type === "timeout") {
					clearJudgmentPolling();
					clearJudgmentRequestForRoom(targetRoomId);
					toast.warning(t("chat.message.judgmentPollingTimeout"));
					return;
				}
				const status = await getChatJudgmentStatus(targetRoomId);
				if (!shouldApplyJudgmentResult(targetRoomId) || judgmentPollingRoomIdRef.current !== targetRoomId) {
					return;
				}
				const decision = getJudgmentPollingDecision({
					attempts: judgmentPollingAttemptsRef.current,
					status,
				});
				if (decision.type === "ready") {
					clearJudgmentPolling();
					toast.success(t("chat.message.judgmentReady"));
					clearJudgmentRequestForRoom(targetRoomId);
					navigateToJudgment(decision.judgmentId);
					return;
				}
				if (decision.type === "failed") {
					clearJudgmentPolling();
					clearJudgmentRequestForRoom(targetRoomId);
					toast.warning(t("chat.message.judgmentFailed"));
				}
			} catch {
				// keep polling, avoid interrupting user flow
			} finally {
				judgmentPollingInFlightRef.current = false;
			}
		}, 4000);
	}, [
		clearJudgmentPolling,
		clearJudgmentRequestForRoom,
		isRoomTargetActive,
		navigateToJudgment,
		shouldApplyJudgmentResult,
	]);

	useEffect(() => {
		if (!room?.id) return;
		if (room.status === "judgment_requested") {
			setJudgingRoomId(room.id);
			if (judgmentPollingRoomIdRef.current !== room.id || !judgmentPollingRef.current) {
				tryStartJudgmentPolling(room.id);
			}
			return;
		}
		if (room.status === "judgment_completed" || room.status === "judgment_failed") {
			clearJudgmentRequestForRoom(room.id);
			if (judgmentPollingRoomIdRef.current === room.id) {
				clearJudgmentPolling();
			}
		}
	}, [
		clearJudgmentPolling,
		clearJudgmentRequestForRoom,
		room?.id,
		room?.status,
		tryStartJudgmentPolling,
	]);

	const handleRequestJudgment = useCallback(async (includedIds?: string[]) => {
		const targetRoom = room;
		const targetRoomId = targetRoom?.id;
		if (!targetRoomId) return;
		if (requestJudgmentInFlightRoomIdRef.current === targetRoomId) return;
		if (isRoomActionBlocked(targetRoom.status)) return;

		let keepRequestPending = false;
		requestJudgmentInFlightRoomIdRef.current = targetRoomId;
		setJudgingRoomId(targetRoomId);
		try {
			const payload = buildChatJudgmentPayload(includedIds);
			const result = await requestChatJudgment(targetRoomId, payload);
			if (!shouldApplyJudgmentResult(targetRoomId)) return;
			setErrorText("");
			toast.success(t("chat.message.judgmentRequested"));
			if (result.judgmentId) {
				navigateToJudgment(result.judgmentId);
				return;
			}
			keepRequestPending = true;
			tryStartJudgmentPolling(targetRoomId);
			await refreshRoomSafely(targetRoomId).catch(() => undefined);
		} catch (error) {
			if (!shouldApplyJudgmentResult(targetRoomId)) return;
			const feedback = getRoomMutationErrorFeedback(error, "chat.message.judgmentFail");
			showChatActionFeedback(feedback);
			if (feedback.refreshRoom) {
				await refreshRoomSafely(targetRoomId).catch(() => undefined);
			}
		} finally {
			if (!keepRequestPending) {
				clearJudgmentRequestForRoom(targetRoomId);
			}
		}
	}, [
		clearJudgmentRequestForRoom,
		navigateToJudgment,
		refreshRoomSafely,
		room,
		setErrorText,
		shouldApplyJudgmentResult,
		showChatActionFeedback,
		tryStartJudgmentPolling,
	]);

	const cancelJudgmentRequest = useCallback(() => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		clearJudgmentRequestForRoom(targetRoomId);
	}, [clearJudgmentRequestForRoom, room?.id]);

	return {
		cancelJudgmentRequest,
		clearJudgmentPolling,
		handleRequestJudgment,
		judging: judgingRoomId === room?.id,
	};
}
