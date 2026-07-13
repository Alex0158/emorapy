import { useCallback, useRef, useState } from "react";
import { toast } from 'sonner';
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import {
	acceptChatInvite,
	createChatRoom,
	declineChatInvite,
} from "@/services/api/chat";
import type { ChatRoom } from "@/types/chat";

type EntryActionKind = "create" | "accept" | "decline";

interface UseChatRoomEntryActionsInput {
	inviteCodeInput: string;
	mountedRef: { current: boolean };
	isEntryRouteActive: () => boolean;
	setRoom: (room: ChatRoom) => void;
	setErrorText: (value: string) => void;
	setLastInviteCode: (value: string) => void;
	navigateToCreatedRoom: (room: ChatRoom) => void;
	navigateToJoinedRoom: (roomId: string) => void;
}

export function useChatRoomEntryActions({
	inviteCodeInput,
	mountedRef,
	isEntryRouteActive,
	setRoom,
	setErrorText,
	setLastInviteCode,
	navigateToCreatedRoom,
	navigateToJoinedRoom,
}: UseChatRoomEntryActionsInput) {
	const [creatingRoom, setCreatingRoom] = useState(false);
	const [joiningInvite, setJoiningInvite] = useState(false);
	const [decliningInvite, setDecliningInvite] = useState(false);
	const entryActionInFlightRef = useRef<EntryActionKind | null>(null);

	const shouldApplyEntryResult = useCallback(
		() => mountedRef.current && isEntryRouteActive(),
		[isEntryRouteActive, mountedRef],
	);

	const beginEntryAction = useCallback((action: EntryActionKind) => {
		if (entryActionInFlightRef.current) return false;
		entryActionInFlightRef.current = action;
		return true;
	}, []);

	const finishEntryAction = useCallback((action: EntryActionKind) => {
		if (entryActionInFlightRef.current === action) {
			entryActionInFlightRef.current = null;
		}
	}, []);

	const handleCreateRoom = useCallback(async () => {
		if (!beginEntryAction("create")) return;
		setCreatingRoom(true);
		setErrorText("");
		try {
			const created = await createChatRoom("share_from_join_time");
			if (!shouldApplyEntryResult()) return;
			setRoom(created);
			setLastInviteCode("");
			navigateToCreatedRoom(created);
		} catch (error) {
			if (!shouldApplyEntryResult()) return;
			setErrorText(getErrorMessage(error, "chat.toast.createRoomFail"));
		} finally {
			if (mountedRef.current) {
				setCreatingRoom(false);
			}
			finishEntryAction("create");
		}
	}, [
		beginEntryAction,
		finishEntryAction,
		mountedRef,
		navigateToCreatedRoom,
		setErrorText,
		setLastInviteCode,
		setRoom,
		shouldApplyEntryResult,
	]);

	const handleAcceptInvite = useCallback(async () => {
		if (entryActionInFlightRef.current) return;
		const inviteCode = inviteCodeInput.trim();
		if (!inviteCode) {
			toast.warning(t("chat.toast.inviteCodeRequired"));
			return;
		}
		if (!beginEntryAction("accept")) return;
		setJoiningInvite(true);
		try {
			const joined = await acceptChatInvite(inviteCode);
			if (!shouldApplyEntryResult()) return;
			setErrorText("");
			toast.success(t("chat.toast.joinSuccess"));
			navigateToJoinedRoom(joined.id);
		} catch (error) {
			if (!shouldApplyEntryResult()) return;
			toast.error(getErrorMessage(error, "chat.toast.joinFail"));
		} finally {
			if (mountedRef.current) {
				setJoiningInvite(false);
			}
			finishEntryAction("accept");
		}
	}, [
		beginEntryAction,
		finishEntryAction,
		inviteCodeInput,
		mountedRef,
		navigateToJoinedRoom,
		setErrorText,
		shouldApplyEntryResult,
	]);

	const handleDeclineInvite = useCallback(async () => {
		if (entryActionInFlightRef.current) return;
		const inviteCode = inviteCodeInput.trim();
		if (!inviteCode) {
			toast.warning(t("chat.toast.inviteCodeRequired"));
			return;
		}
		if (!beginEntryAction("decline")) return;
		setDecliningInvite(true);
		try {
			await declineChatInvite(inviteCode);
			if (!shouldApplyEntryResult()) return;
			setErrorText("");
			toast.success(t("chat.toast.declineSuccess"));
		} catch (error) {
			if (!shouldApplyEntryResult()) return;
			toast.error(getErrorMessage(error, "chat.toast.declineFail"));
		} finally {
			if (mountedRef.current) {
				setDecliningInvite(false);
			}
			finishEntryAction("decline");
		}
	}, [
		beginEntryAction,
		finishEntryAction,
		inviteCodeInput,
		mountedRef,
		setErrorText,
		shouldApplyEntryResult,
	]);

	return {
		creatingRoom,
		joiningInvite,
		decliningInvite,
		handleCreateRoom,
		handleAcceptInvite,
		handleDeclineInvite,
	};
}
