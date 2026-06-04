import { t } from "@/utils/i18n";
import { getErrorMessage } from "@/utils/apiError";
import type {
	ChatHistoryVisibilityMode,
	ChatJudgmentStatus,
	ChatMessage,
	ChatRoom,
	ChatRoomStatus,
	ChatStreamEvent,
	ChatVisibilityScope,
} from "@/types/chat";

export const MAX_MESSAGE_CACHE = 600;
export const ANCHOR_AUTO_PAGE_LIMIT = 6;
export const INITIAL_FIRST_ITEM_INDEX = 100_000;
export const AI_THINKING_TIMEOUT_MS = 15000;
export const ROOM_STREAM_RETRY_MAX_MS = 10000;
export const JUDGMENT_POLLING_MAX_ATTEMPTS = 90;

export interface ChatInitialMessageWindow {
	firstItemIndex: number;
	messages: ChatMessage[];
	historyCursor: string | null;
	hasMoreHistory: boolean;
}

export function getRouteStateRoom(
	routeState: unknown,
	targetRoomId: string,
): ChatRoom | null {
	if (!routeState || typeof routeState !== "object") return null;
	const candidate = (routeState as { room?: ChatRoom }).room;
	return candidate?.id === targetRoomId ? candidate : null;
}

export function getInitialMessageWindow({
	messages,
	nextCursor,
}: {
	messages: ChatMessage[];
	nextCursor?: string | null;
}): ChatInitialMessageWindow {
	return {
		firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
		messages,
		historyCursor: nextCursor ?? null,
		hasMoreHistory: Boolean(nextCursor),
	};
}

export function hasMessageAnchorHash(hash: string | null | undefined): boolean {
	return typeof hash === "string" && hash.startsWith("#msg-");
}

export function shouldApplyRoomRefresh({
	targetRoomId,
	activeRouteRoomId,
}: {
	targetRoomId: string;
	activeRouteRoomId?: string | null;
}): boolean {
	return activeRouteRoomId === targetRoomId;
}

export interface ChatHistoryState {
	historyCursor: string | null;
	hasMoreHistory: boolean;
}

export function getHistoryStateAfterLatestRefresh({
	currentCursor,
	hasMoreHistory,
	fetchedNextCursor,
}: {
	currentCursor: string | null;
	hasMoreHistory: boolean;
	fetchedNextCursor?: string | null;
}): ChatHistoryState {
	if (currentCursor) {
		return { historyCursor: currentCursor, hasMoreHistory: true };
	}
	if (!hasMoreHistory) {
		return { historyCursor: null, hasMoreHistory: false };
	}
	const nextCursor = fetchedNextCursor ?? null;
	return {
		historyCursor: nextCursor,
		hasMoreHistory: Boolean(nextCursor),
	};
}

export type JudgmentPollingDecision =
	| { type: "continue" }
	| { type: "timeout" }
	| { type: "failed" }
	| { type: "ready"; judgmentId: string };

export function getJudgmentPollingDecision({
	attempts,
	status,
	maxAttempts = JUDGMENT_POLLING_MAX_ATTEMPTS,
}: {
	attempts: number;
	status?: ChatJudgmentStatus | null;
	maxAttempts?: number;
}): JudgmentPollingDecision {
	if (attempts > maxAttempts) {
		return { type: "timeout" };
	}
	const judgmentId = status?.latestLink?.judgment?.id;
	if (judgmentId) {
		return { type: "ready", judgmentId };
	}
	if (status?.roomStatus === "judgment_failed") {
		return { type: "failed" };
	}
	return { type: "continue" };
}

export function isTerminalStreamError(error: {
	code?: string;
	status?: number;
}): boolean {
	if (error.status && [400, 401, 403, 404].includes(error.status)) {
		return true;
	}
	return Boolean(
		error.code &&
			["INVALID_SESSION_ID", "SESSION_EXPIRED", "FORBIDDEN", "NOT_FOUND"].includes(
				error.code,
			),
	);
}

export function getRoomStreamRetryDelayMs(retryCount: number): number {
	return Math.min(ROOM_STREAM_RETRY_MAX_MS, 1000 * Math.max(1, retryCount + 1));
}

export function getRoomStreamTerminalErrorText(error: { message?: string }): string {
	return getErrorMessage(error, "chat.message.streamTerminalError");
}

export function getRoomStreamRetryErrorText(error: unknown): string {
	return getErrorMessage(error, "chat.message.streamFail");
}

export function getRoomStreamCloseRetryText(): string {
	return t("chat.message.streamClosedRetry");
}

export function isRoomStreamReadyEvent(event: ChatStreamEvent): boolean {
	return event.type === "ready";
}

export function shouldRefreshRoomForStreamEvent(event: ChatStreamEvent): boolean {
	return event.type === "message" || event.type === "invite" || event.type === "room_status";
}

export interface ChatStreamNoticeFeedback {
	level: "success" | "info";
	message: string;
}

export function getRoomStatusNoticeFeedback(
	event: Pick<ChatStreamEvent, "payload">,
): ChatStreamNoticeFeedback | null {
	const payload = event.payload ?? {};
	if (payload.joined === true) {
		return { level: "success", message: t("chat.stream.joined") };
	}
	if (payload.participantKicked === true) {
		return { level: "info", message: t("chat.stream.participantKicked") };
	}
	if (payload.participantLeft === true) {
		return { level: "info", message: t("chat.stream.participantLeft") };
	}
	return null;
}

export function getRoomLoadErrorText(error: unknown): string {
	const err = error as { code?: string };
	if (err?.code === "NOT_FOUND" || err?.code === "HTTP_404") {
		return t("chat.message.roomUnavailable");
	}
	return getErrorMessage(error, "chat.message.loadFail");
}

export function isTerminalChatRoomStatus(status?: ChatRoomStatus): boolean {
	return (
		status === "judgment_completed" ||
		status === "judgment_failed" ||
		status === "archived"
	);
}

export function isRoomActionBlocked(status?: ChatRoomStatus): boolean {
	return status === "judgment_requested" || isTerminalChatRoomStatus(status);
}

export interface ChatActionFeedback {
	level: "warning" | "error";
	message: string;
	refreshRoom: boolean;
}

function hasFixedDiagnosticMessage(error: unknown): boolean {
	const candidates: unknown[] = [];
	if (error instanceof Error) {
		candidates.push(error.message);
	}
	if (error && typeof error === "object") {
		const record = error as { message?: unknown; error?: { message?: unknown } };
		candidates.push(record.message, record.error?.message);
	}
	return candidates.some(
		(message) =>
			typeof message === "string" &&
			/^Invalid .+ from server$/.test(message.trim()),
	);
}

function getChatActionErrorMessage(error: unknown, fallbackKey: string): string {
	if (hasFixedDiagnosticMessage(error)) {
		return getErrorMessage(error, fallbackKey);
	}
	return t(fallbackKey);
}

export function getSendMessageErrorFeedback(error: unknown): ChatActionFeedback {
	const err = error as { code?: string };
	if (err?.code === "FORBIDDEN") {
		return {
			level: "warning",
			message: t("chat.message.forbidden"),
			refreshRoom: false,
		};
	}

	return {
		level: "error",
		message: getChatActionErrorMessage(error, "chat.message.sendFail"),
		refreshRoom: false,
	};
}

export function getRoomMutationErrorFeedback(
	error: unknown,
	fallbackKey: string,
): ChatActionFeedback {
	const err = error as { code?: string };
	if (err?.code === "CONFLICT") {
		return {
			level: "warning",
			message: t("chat.message.conflictRefresh"),
			refreshRoom: true,
		};
	}
	if (err?.code === "INVALID_SESSION_ID" || err?.code === "SESSION_EXPIRED") {
		return {
			level: "warning",
			message: t("chat.message.invalidSession"),
			refreshRoom: false,
		};
	}

	return {
		level: "error",
		message: getChatActionErrorMessage(error, fallbackKey),
		refreshRoom: false,
	};
}

export function getInviteHistoryVisibilityMode(
	room: Pick<ChatRoom, "history_visibility_mode"> | null | undefined,
): ChatHistoryVisibilityMode {
	return room?.history_visibility_mode ?? "share_summary_only";
}

export function buildSendMessagePayload({
	content,
	visibilityScope,
	replyToMessageId,
}: {
	content: string;
	visibilityScope: ChatVisibilityScope;
	replyToMessageId?: string;
}) {
	return {
		content,
		visibility_scope: visibilityScope,
		reply_to_message_id: replyToMessageId,
	};
}

export function buildChatJudgmentPayload(includedIds?: string[]) {
	return includedIds && includedIds.length > 0
		? { included_message_ids: includedIds }
		: undefined;
}

export function shouldAllowMessageCacheTrim({
	isAtBottom,
	pendingAnchorMessageId,
	loadingMoreHistory,
}: {
	isAtBottom: boolean;
	pendingAnchorMessageId?: string | null;
	loadingMoreHistory: boolean;
}): boolean {
	return isAtBottom && !pendingAnchorMessageId && !loadingMoreHistory;
}

export function trimMessagesToCacheLimit(
	messages: ChatMessage[],
	{
		allowTrim = false,
		maxMessages = MAX_MESSAGE_CACHE,
	}: { allowTrim?: boolean; maxMessages?: number } = {},
): { messages: ChatMessage[]; removedCount: number } {
	if (!allowTrim || messages.length <= maxMessages) {
		return { messages, removedCount: 0 };
	}
	const removedCount = messages.length - maxMessages;
	return {
		messages: messages.slice(removedCount),
		removedCount,
	};
}

export function getUniqueHistoryMessages(
	messages: ChatMessage[],
	existingMessageIds: { has: (id: string) => boolean },
): ChatMessage[] {
	return messages.filter((message) => !existingMessageIds.has(message.id));
}

export function getFirstItemIndexAfterPrepend(
	currentFirstItemIndex: number,
	prependedCount: number,
): number {
	return Math.max(0, currentFirstItemIndex - prependedCount);
}

export function shouldShowHistoryCacheFullNotice({
	now,
	lastNoticeAt,
	cooldownMs = 5000,
}: {
	now: number;
	lastNoticeAt: number;
	cooldownMs?: number;
}): boolean {
	return now - lastNoticeAt > cooldownMs;
}

export interface ChatAnchorOrigin {
	originMessageId: string | null;
	wasAtBottom: boolean;
}

export function buildMessageAnchorHash(messageId: string): string {
	return `#msg-${messageId}`;
}

export function parseMessageAnchorHash(hash: string): string | null {
	const match = (hash || "").match(/^#?msg-(.+)$/);
	return match?.[1] ?? null;
}

export function getAnchorHandledKey(roomId: string, targetMessageId: string): string {
	return `${roomId}:${targetMessageId}`;
}

export function getAnchorOrigin({
	rangeStartIndex,
	firstItemIndex,
	messages,
	isAtBottom,
}: {
	rangeStartIndex: number;
	firstItemIndex: number;
	messages: ChatMessage[];
	isAtBottom: boolean;
}): ChatAnchorOrigin {
	const localStartIndex = rangeStartIndex - firstItemIndex;
	const safeIndex = Math.min(
		Math.max(localStartIndex, 0),
		Math.max(0, messages.length - 1),
	);
	return {
		originMessageId: messages[safeIndex]?.id ?? null,
		wasAtBottom: isAtBottom,
	};
}

export type PendingAnchorResolution =
	| "loaded"
	| "wait"
	| "missing-history"
	| "limit-reached"
	| "load-more";

export function getPendingAnchorResolution({
	targetLoaded,
	hasMoreHistory,
	loadingMoreHistory,
	historyCursor,
	autoPages,
	autoPageLimit = ANCHOR_AUTO_PAGE_LIMIT,
}: {
	targetLoaded: boolean;
	hasMoreHistory: boolean;
	loadingMoreHistory: boolean;
	historyCursor?: string | null;
	autoPages: number;
	autoPageLimit?: number;
}): PendingAnchorResolution {
	if (targetLoaded) return "loaded";
	if (!hasMoreHistory || loadingMoreHistory) return "wait";
	if (!historyCursor) return "missing-history";
	if (autoPages >= autoPageLimit) return "limit-reached";
	return "load-more";
}

export function getRoleLabel(role: string | null | undefined): string {
	const r = role ?? "unknown";
	if (r === "roleA") return t("chat.role.roleA");
	if (r === "roleB") return t("chat.role.roleB");
	if (r === "aiMediator") return t("chat.role.aiMediator");
	if (r === "system") return t("chat.role.system");
	return t("chat.role.unknown");
}

export function getMessageTypeLabel(
	messageType: string | null | undefined,
): string {
	if (!messageType) return t("common.na");
	if (![
		"user_text",
		"ai_text",
		"ai_reflection",
		"ai_mediation",
		"ai_summary",
		"system_event",
		"safety_notice",
	].includes(messageType)) return messageType;
	return t(`chat.messageType.${messageType}`);
}

export function getVisibilityScopeLabel(
	visibilityScope: string | null | undefined,
): string {
	if (!visibilityScope) return t("common.na");
	if (![
		"all",
		"summary_only",
		"owner_only",
		"share_full_history",
		"share_summary_only",
		"share_from_join_time",
	].includes(visibilityScope)) return visibilityScope;
	return t(`chat.visibility.${visibilityScope}`);
}

export function getAiStrategyLabel(strategy: string | null | undefined): string {
	if (!strategy) return "";
	return t("chat.aiStrategyLabel", { strategy });
}

export function mergeSortedMessages(
	a: ChatMessage[],
	b: ChatMessage[],
): ChatMessage[] {
	if (a.length === 0) return b;
	if (b.length === 0) return a;

	const seen = new Set<string>();
	const result: ChatMessage[] = [];
	let i = 0;
	let j = 0;

	const pushUnique = (message: ChatMessage) => {
		if (seen.has(message.id)) return;
		seen.add(message.id);
		result.push(message);
	};

	while (i < a.length || j < b.length) {
		const left = i < a.length ? a[i] : null;
		const right = j < b.length ? b[j] : null;
		if (!left) {
			pushUnique(right!);
			j += 1;
			continue;
		}
		if (!right) {
			pushUnique(left);
			i += 1;
			continue;
		}
		const leftTime = new Date(left.created_at).getTime();
		const rightTime = new Date(right.created_at).getTime();
		if (leftTime < rightTime) {
			pushUnique(left);
			i += 1;
			continue;
		}
		if (rightTime < leftTime) {
			pushUnique(right);
			j += 1;
			continue;
		}
		if (left.id <= right.id) {
			pushUnique(left);
			i += 1;
		} else {
			pushUnique(right);
			j += 1;
		}
	}

	return result;
}

export function buildMessageMap(messages: ChatMessage[]): Map<string, ChatMessage> {
	const map = new Map<string, ChatMessage>();
	messages.forEach((message) => map.set(message.id, message));
	return map;
}

export function findLatestSafetyNotice(
	messages: ChatMessage[],
): ChatMessage | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const candidate = messages[i];
		if (candidate?.message_type === "safety_notice") return candidate;
	}
	return null;
}
