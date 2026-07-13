import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@/types/chat';
import { INITIAL_FIRST_ITEM_INDEX } from '../chatRoomUtils';
import type { ChatConversationLane } from './useChatRoomUiState';

type LaneRecord<T> = Record<ChatConversationLane, T>;

interface LaneWindow {
  firstItemIndex: number;
  messageIds: string[];
}

interface UseChatLaneHistoryViewInput {
  roomId: string | null;
  activeLane: ChatConversationLane;
  messages: ChatMessage[];
  privateChannelId: string | null;
  sharedChannelId: string | null;
}

const EMPTY_LANE_WINDOWS: LaneRecord<LaneWindow> = {
  private: { firstItemIndex: INITIAL_FIRST_ITEM_INDEX, messageIds: [] },
  shared: { firstItemIndex: INITIAL_FIRST_ITEM_INDEX, messageIds: [] },
};

const EMPTY_UNREAD: LaneRecord<boolean> = { private: false, shared: false };

export function isMessageInConversationLane(
  message: ChatMessage,
  lane: ChatConversationLane,
  channelId: string | null,
): boolean {
  if (message.channel_id) return Boolean(channelId && message.channel_id === channelId);
  return lane === 'shared'
    ? message.visibility_scope === 'all'
    : message.visibility_scope !== 'all';
}

export function reconcileLaneWindow(
  previous: LaneWindow,
  nextMessageIds: string[],
): LaneWindow {
  if (nextMessageIds.length === 0 || previous.messageIds.length === 0) {
    return {
      firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
      messageIds: nextMessageIds,
    };
  }

  const previousIndexById = new Map(
    previous.messageIds.map((messageId, index) => [messageId, index]),
  );
  const sharedAnchorIndex = nextMessageIds.findIndex((messageId) => (
    previousIndexById.has(messageId)
  ));
  if (sharedAnchorIndex < 0) {
    return {
      firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
      messageIds: nextMessageIds,
    };
  }

  const sharedAnchorId = nextMessageIds[sharedAnchorIndex];
  const previousAnchorIndex = previousIndexById.get(sharedAnchorId) ?? 0;
  return {
    firstItemIndex:
      previous.firstItemIndex + previousAnchorIndex - sharedAnchorIndex,
    messageIds: nextMessageIds,
  };
}

export function buildLaneMessageIndexMap(
  messages: ChatMessage[],
  firstItemIndex: number,
): Map<string, number> {
  return new Map(messages.map((message, index) => (
    [message.id, firstItemIndex + index]
  )));
}

function hasAppendedMessages(previousIds: string[], nextIds: string[]): boolean {
  if (previousIds.length === 0 || nextIds.length === 0) return false;
  const previousLastId = previousIds.at(-1);
  const previousLastIndex = previousLastId ? nextIds.indexOf(previousLastId) : -1;
  if (previousLastIndex < 0 || previousLastIndex >= nextIds.length - 1) return false;
  const previousIdSet = new Set(previousIds);
  return nextIds.slice(previousLastIndex + 1).some((id) => !previousIdSet.has(id));
}

export function useChatLaneHistoryView({
  roomId,
  activeLane,
  messages,
  privateChannelId,
  sharedChannelId,
}: UseChatLaneHistoryViewInput) {
  const messagesByLane = useMemo<LaneRecord<ChatMessage[]>>(() => ({
    private: messages.filter((message) => (
      isMessageInConversationLane(message, 'private', privateChannelId)
    )),
    shared: messages.filter((message) => (
      isMessageInConversationLane(message, 'shared', sharedChannelId)
    )),
  }), [messages, privateChannelId, sharedChannelId]);
  const messageIdsByLane = useMemo<LaneRecord<string[]>>(() => ({
    private: messagesByLane.private.map((message) => message.id),
    shared: messagesByLane.shared.map((message) => message.id),
  }), [messagesByLane]);

  const committedRoomIdRef = useRef<string | null>(null);
  const committedWindowsRef = useRef<LaneRecord<LaneWindow>>(EMPTY_LANE_WINDOWS);
  const nextWindows = useMemo<LaneRecord<LaneWindow>>(() => {
    const previous = committedRoomIdRef.current === roomId
      ? committedWindowsRef.current
      : EMPTY_LANE_WINDOWS;
    return {
      private: reconcileLaneWindow(previous.private, messageIdsByLane.private),
      shared: reconcileLaneWindow(previous.shared, messageIdsByLane.shared),
    };
  }, [messageIdsByLane, roomId]);

  const [unreadByLane, setUnreadByLane] = useState<LaneRecord<boolean>>(EMPTY_UNREAD);
  const privateIsAtBottomRef = useRef(true);
  const sharedIsAtBottomRef = useRef(true);
  const privateRangeStartIndexRef = useRef(0);
  const sharedRangeStartIndexRef = useRef(0);
  const activeIsAtBottomRef = useRef(true);
  const activeRangeStartIndexRef = useRef(0);

  useEffect(() => {
    const roomChanged = committedRoomIdRef.current !== roomId;
    const previousWindows = committedWindowsRef.current;
    if (roomChanged) {
      privateIsAtBottomRef.current = true;
      sharedIsAtBottomRef.current = true;
      privateRangeStartIndexRef.current = 0;
      sharedRangeStartIndexRef.current = 0;
      setUnreadByLane(EMPTY_UNREAD);
    } else {
      const privateUnread = hasAppendedMessages(
        previousWindows.private.messageIds,
        nextWindows.private.messageIds,
      ) && (activeLane !== 'private' || !privateIsAtBottomRef.current);
      const sharedUnread = hasAppendedMessages(
        previousWindows.shared.messageIds,
        nextWindows.shared.messageIds,
      ) && (activeLane !== 'shared' || !sharedIsAtBottomRef.current);
      if (privateUnread || sharedUnread) {
        setUnreadByLane((current) => ({
          private: current.private || privateUnread,
          shared: current.shared || sharedUnread,
        }));
      }
    }

    committedRoomIdRef.current = roomId;
    committedWindowsRef.current = nextWindows;
  }, [activeLane, nextWindows, roomId]);

  const clearActiveUnread = useCallback(() => {
    setUnreadByLane((current) => (
      current[activeLane]
        ? { ...current, [activeLane]: false }
        : current
    ));
  }, [activeLane]);

  const handleAtBottomChange = useCallback((atBottom: boolean) => {
    const activeRef = activeLane === 'private'
      ? privateIsAtBottomRef
      : sharedIsAtBottomRef;
    activeRef.current = atBottom;
    activeIsAtBottomRef.current = atBottom;
    if (atBottom) clearActiveUnread();
  }, [activeLane, clearActiveUnread]);

  const handleRangeStartIndexChange = useCallback((rangeStartIndex: number) => {
    const activeRef = activeLane === 'private'
      ? privateRangeStartIndexRef
      : sharedRangeStartIndexRef;
    activeRef.current = rangeStartIndex;
    activeRangeStartIndexRef.current = rangeStartIndex;
  }, [activeLane]);

  const activeMessages = messagesByLane[activeLane];
  const activeWindow = nextWindows[activeLane];
  activeIsAtBottomRef.current = activeLane === 'private'
    ? privateIsAtBottomRef.current
    : sharedIsAtBottomRef.current;
  activeRangeStartIndexRef.current = activeLane === 'private'
    ? privateRangeStartIndexRef.current
    : sharedRangeStartIndexRef.current;
  const activeMessageIndexById = useMemo(() => buildLaneMessageIndexMap(
    activeMessages,
    activeWindow.firstItemIndex,
  ), [activeMessages, activeWindow.firstItemIndex]);

  return {
    activeFirstItemIndex: activeWindow.firstItemIndex,
    activeIsAtBottomRef,
    activeMessageIndexById,
    activeMessages,
    activeRangeStartIndexRef,
    clearActiveUnread,
    handleAtBottomChange,
    handleRangeStartIndexChange,
    hasUnread: unreadByLane[activeLane],
    messagesByLane,
  };
}
