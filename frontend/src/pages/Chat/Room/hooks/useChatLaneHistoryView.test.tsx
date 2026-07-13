import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types/chat';
import {
  buildLaneMessageIndexMap,
  reconcileLaneWindow,
  useChatLaneHistoryView,
} from './useChatLaneHistoryView';

function buildMessage(
  id: string,
  channelId: 'private-channel' | 'shared-channel',
  createdAt: string,
): ChatMessage {
  return {
    id,
    room_id: 'room-1',
    channel_id: channelId,
    sender_participant_id: 'participant-a',
    content: id,
    message_type: 'user_text',
    visibility_scope: channelId === 'shared-channel' ? 'all' : 'owner_only',
    safety_flag: false,
    created_at: createdAt,
  };
}

const interleavedMessages = [
  buildMessage('private-1', 'private-channel', '2026-07-12T00:00:00.000Z'),
  buildMessage('shared-1', 'shared-channel', '2026-07-12T00:00:01.000Z'),
  buildMessage('private-2', 'private-channel', '2026-07-12T00:00:02.000Z'),
  buildMessage('shared-2', 'shared-channel', '2026-07-12T00:00:03.000Z'),
];

describe('useChatLaneHistoryView', () => {
  it('keeps a contiguous lane index map for interleaved channel messages', () => {
    const laneMessages = [interleavedMessages[0], interleavedMessages[2]];
    const indexMap = buildLaneMessageIndexMap(laneMessages, 100_000);

    expect([...indexMap.entries()]).toEqual([
      ['private-1', 100_000],
      ['private-2', 100_001],
    ]);
    expect(indexMap.has('shared-1')).toBe(false);
  });

  it('changes firstItemIndex only for prepended or trimmed messages in that lane', () => {
    const initial = reconcileLaneWindow(
      { firstItemIndex: 100_000, messageIds: [] },
      ['private-1', 'private-2'],
    );
    const otherLaneAppend = reconcileLaneWindow(initial, ['private-1', 'private-2']);
    const prepend = reconcileLaneWindow(otherLaneAppend, ['private-0', 'private-1', 'private-2']);
    const trim = reconcileLaneWindow(prepend, ['private-1', 'private-2']);

    expect(otherLaneAppend.firstItemIndex).toBe(100_000);
    expect(prepend.firstItemIndex).toBe(99_999);
    expect(trim.firstItemIndex).toBe(100_000);
  });

  it('tracks unread independently and clears only the active lane at bottom', async () => {
    const { result, rerender } = renderHook(({
      activeLane,
      messages,
    }: {
      activeLane: 'private' | 'shared';
      messages: ChatMessage[];
    }) => useChatLaneHistoryView({
      roomId: 'room-1',
      activeLane,
      messages,
      privateChannelId: 'private-channel',
      sharedChannelId: 'shared-channel',
    }), {
      initialProps: { activeLane: 'shared' as const, messages: interleavedMessages },
    });
    const stableIsAtBottomRef = result.current.activeIsAtBottomRef;
    const stableRangeStartIndexRef = result.current.activeRangeStartIndexRef;

    rerender({
      activeLane: 'shared',
      messages: [
        ...interleavedMessages,
        buildMessage('private-3', 'private-channel', '2026-07-12T00:00:04.000Z'),
      ],
    });
    expect(result.current.hasUnread).toBe(false);

    rerender({
      activeLane: 'private',
      messages: [
        ...interleavedMessages,
        buildMessage('private-3', 'private-channel', '2026-07-12T00:00:04.000Z'),
      ],
    });
    expect(result.current.activeIsAtBottomRef).toBe(stableIsAtBottomRef);
    expect(result.current.activeRangeStartIndexRef).toBe(stableRangeStartIndexRef);
    await waitFor(() => expect(result.current.hasUnread).toBe(true));

    act(() => result.current.handleAtBottomChange(true));
    expect(result.current.hasUnread).toBe(false);
  });
});
