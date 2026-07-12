import { useCallback, useEffect, useMemo } from "react";
import type { ChatMessage, ChatRoom } from "@/types/chat";
import { getJudgmentPreviewInfo } from "../components/ChatJudgmentPanel";
import {
	findLatestSafetyNotice,
	isRoomActionBlocked,
	type ChatActionFeedback,
} from "../chatRoomUtils";
import { useChatRoomJudgmentActions } from "./useChatRoomJudgmentActions";

interface UseChatRoomJudgmentControllerInput {
	room: ChatRoom | null;
	messages: ChatMessage[];
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	navigateToJudgment: (judgmentId: string) => void;
	refreshRoomSafely: (targetRoomId: string) => Promise<void>;
	setErrorText: (value: string) => void;
	showChatActionFeedback: (feedback: ChatActionFeedback) => void;
	previewVisible: boolean;
	showJudgmentPreview: (includedMessageIds: string[]) => void;
	closeJudgmentPreview: () => void;
}

export function useChatRoomJudgmentController({
	room,
	messages,
	mountedRef,
	isRoomTargetActive,
	navigateToJudgment,
	refreshRoomSafely,
	setErrorText,
	showChatActionFeedback,
	previewVisible,
	showJudgmentPreview,
	closeJudgmentPreview,
}: UseChatRoomJudgmentControllerInput) {
	const {
		cancelJudgmentRequest,
		clearJudgmentPolling,
		handleRequestJudgment,
		judging,
	} = useChatRoomJudgmentActions({
		room,
		mountedRef,
		isRoomTargetActive,
		navigateToJudgment,
		refreshRoomSafely,
		setErrorText,
		showChatActionFeedback,
	});

	const latestSafetyNotice = useMemo(
		() => findLatestSafetyNotice(messages),
		[messages],
	);
	const hasSafetyInterruption = Boolean(latestSafetyNotice);
	const previewInfo = useMemo(
		() => getJudgmentPreviewInfo(room, messages),
		[messages, room],
	);

	useEffect(() => {
		if (!hasSafetyInterruption || !previewVisible) return;
		closeJudgmentPreview();
		cancelJudgmentRequest();
	}, [
		cancelJudgmentRequest,
		closeJudgmentPreview,
		hasSafetyInterruption,
		previewVisible,
	]);

	const openJudgmentPreview = useCallback(() => {
		if (!room?.id) return;
		if (isRoomActionBlocked(room.status)) return;
		if (hasSafetyInterruption) return;
		const includedMessageIds = previewInfo.includedMessages.map(
			(message) => message.id,
		);
		showJudgmentPreview(includedMessageIds);
	}, [hasSafetyInterruption, previewInfo, room, showJudgmentPreview]);

	return {
		cancelJudgmentRequest,
		clearJudgmentPolling,
		handleRequestJudgment,
		hasSafetyInterruption,
		judging,
		latestSafetyNotice,
		openJudgmentPreview,
		previewInfo,
	};
}
