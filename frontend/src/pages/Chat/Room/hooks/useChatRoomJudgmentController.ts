import { useMemo } from "react";
import type { ChatMessage, ChatRoom } from "@/types/chat";
import {
	findLatestSafetyNotice,
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
}: UseChatRoomJudgmentControllerInput) {
	const {
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
	return {
		clearJudgmentPolling,
		handleRequestJudgment,
		hasSafetyInterruption,
		judging,
		latestSafetyNotice,
	};
}
