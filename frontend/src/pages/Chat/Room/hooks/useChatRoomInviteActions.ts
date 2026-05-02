import { useCallback, useRef, useState } from "react";
import { message } from "antd";
import { t } from "@/utils/i18n";
import { createChatInvite } from "@/services/api/chat";
import type { ChatRoom } from "@/types/chat";
import {
	getInviteHistoryVisibilityMode,
	getRoomMutationErrorFeedback,
	isRoomActionBlocked,
	type ChatActionFeedback,
} from "../chatRoomUtils";

interface UseChatRoomInviteActionsInput {
	room: ChatRoom | null;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	refreshRoomSafely: (targetRoomId: string) => Promise<unknown>;
	setErrorText: (value: string) => void;
	setLastInviteCode: (value: string) => void;
	showChatActionFeedback: (feedback: ChatActionFeedback) => void;
}

export function useChatRoomInviteActions({
	room,
	mountedRef,
	isRoomTargetActive,
	refreshRoomSafely,
	setErrorText,
	setLastInviteCode,
	showChatActionFeedback,
}: UseChatRoomInviteActionsInput) {
	const [creatingInviteRoomId, setCreatingInviteRoomId] = useState<string | null>(null);
	const createInviteInFlightRoomIdRef = useRef<string | null>(null);

	const shouldApplyInviteResult = useCallback(
		(targetRoomId: string) => mountedRef.current && isRoomTargetActive(targetRoomId),
		[isRoomTargetActive, mountedRef],
	);

	const handleCreateInvite = useCallback(async () => {
		const targetRoom = room;
		const targetRoomId = targetRoom?.id;
		if (!targetRoomId) return;
		if (isRoomActionBlocked(targetRoom.status)) return;
		if (createInviteInFlightRoomIdRef.current === targetRoomId) return;

		createInviteInFlightRoomIdRef.current = targetRoomId;
		setCreatingInviteRoomId(targetRoomId);
		try {
			const invite = await createChatInvite(targetRoomId, {
				history_visibility_mode: getInviteHistoryVisibilityMode(targetRoom),
			});
			if (!shouldApplyInviteResult(targetRoomId)) return;
			setLastInviteCode(invite.invite_code || "");
			setErrorText("");
			void refreshRoomSafely(targetRoomId).catch(() => undefined);
			message.success(t("chat.message.createInviteSuccess"));
		} catch (error) {
			if (!shouldApplyInviteResult(targetRoomId)) return;
			const feedback = getRoomMutationErrorFeedback(
				error,
				"chat.message.createInviteFail",
			);
			showChatActionFeedback(feedback);
			if (feedback.refreshRoom) {
				await refreshRoomSafely(targetRoomId).catch(() => undefined);
			}
		} finally {
			if (createInviteInFlightRoomIdRef.current === targetRoomId) {
				createInviteInFlightRoomIdRef.current = null;
			}
			if (mountedRef.current) {
				setCreatingInviteRoomId((current) =>
					current === targetRoomId ? null : current,
				);
			}
		}
	}, [
		mountedRef,
		refreshRoomSafely,
		room,
		setErrorText,
		setLastInviteCode,
		shouldApplyInviteResult,
		showChatActionFeedback,
	]);

	return {
		creatingInvite: creatingInviteRoomId === room?.id,
		handleCreateInvite,
	};
}
