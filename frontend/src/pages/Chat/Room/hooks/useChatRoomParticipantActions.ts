import { useCallback, useRef, useState } from "react";
import { toast } from 'sonner';
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import { kickChatParticipantB, leaveChatRoom } from "@/services/api/chat";
import type { ChatRoom } from "@/types/chat";
import { isRoomActionBlocked } from "../chatRoomUtils";

interface UseChatRoomParticipantActionsInput {
	room: ChatRoom | null;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	navigateToRoomEntry: () => void;
	refreshRoomSafely: (targetRoomId: string) => Promise<unknown>;
}

export function useChatRoomParticipantActions({
	room,
	mountedRef,
	isRoomTargetActive,
	navigateToRoomEntry,
	refreshRoomSafely,
}: UseChatRoomParticipantActionsInput) {
	const [leavingRoomId, setLeavingRoomId] = useState<string | null>(null);
	const [kickingBRoomId, setKickingBRoomId] = useState<string | null>(null);
	const leaveRoomInFlightRoomIdRef = useRef<string | null>(null);
	const kickBInFlightRoomIdRef = useRef<string | null>(null);

	const shouldApplyActionResult = useCallback(
		(targetRoomId: string) => mountedRef.current && isRoomTargetActive(targetRoomId),
		[isRoomTargetActive, mountedRef],
	);

	const handleLeaveRoomAction = useCallback(async () => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		if (isRoomActionBlocked(room.status)) return;
		if (leaveRoomInFlightRoomIdRef.current === targetRoomId) return;

		leaveRoomInFlightRoomIdRef.current = targetRoomId;
		setLeavingRoomId(targetRoomId);
		try {
			await leaveChatRoom(targetRoomId);
			if (!shouldApplyActionResult(targetRoomId)) return;
			toast.success(t("chat.message.leaveRoomSuccess"));
			navigateToRoomEntry();
		} catch (error) {
			if (!shouldApplyActionResult(targetRoomId)) return;
			toast.error(getErrorMessage(error, "chat.message.leaveRoomFail"));
		} finally {
			if (leaveRoomInFlightRoomIdRef.current === targetRoomId) {
				leaveRoomInFlightRoomIdRef.current = null;
			}
			if (mountedRef.current) {
				setLeavingRoomId((current) => (current === targetRoomId ? null : current));
			}
		}
	}, [mountedRef, navigateToRoomEntry, room?.id, room?.status, shouldApplyActionResult]);

	const handleKickB = useCallback(async () => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		if (isRoomActionBlocked(room.status)) return;
		if (kickBInFlightRoomIdRef.current === targetRoomId) return;

		kickBInFlightRoomIdRef.current = targetRoomId;
		setKickingBRoomId(targetRoomId);
		try {
			await kickChatParticipantB(targetRoomId);
			if (!shouldApplyActionResult(targetRoomId)) return;
			toast.success(t("chat.message.kickSuccess"));
			void refreshRoomSafely(targetRoomId).catch(() => undefined);
		} catch (error) {
			if (!shouldApplyActionResult(targetRoomId)) return;
			toast.error(getErrorMessage(error, "chat.message.kickFail"));
		} finally {
			if (kickBInFlightRoomIdRef.current === targetRoomId) {
				kickBInFlightRoomIdRef.current = null;
			}
			if (mountedRef.current) {
				setKickingBRoomId((current) => (current === targetRoomId ? null : current));
			}
		}
	}, [mountedRef, refreshRoomSafely, room?.id, room?.status, shouldApplyActionResult]);

	return {
		leavingRoom: leavingRoomId === room?.id,
		kickingB: kickingBRoomId === room?.id,
		handleLeaveRoomAction,
		handleKickB,
	};
}
