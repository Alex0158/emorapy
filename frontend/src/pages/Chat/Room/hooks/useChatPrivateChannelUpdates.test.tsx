import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatPrivateChannelUpdates } from './useChatPrivateChannelUpdates';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
}));

vi.mock('@/services/api/chat', () => ({
  connectChatChannelStream: (...args: unknown[]) => mocks.connect(...args),
}));

describe('useChatPrivateChannelUpdates', () => {
  it('effect cleanup 早於 async connect 完成時，應在 connect resolve 後立即關閉舊 stream', async () => {
    let resolveConnect!: (cleanup: () => void) => void;
    const cleanup = vi.fn();
    mocks.connect.mockImplementation(() => new Promise((resolve) => {
      resolveConnect = resolve;
    }));
    const refreshRoomSafely = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useChatPrivateChannelUpdates({
      roomId: 'room-1',
      privateChannelId: 'channel-private',
      refreshRoomSafely,
    }));

    await waitFor(() => expect(mocks.connect).toHaveBeenCalled());
    unmount();
    await act(async () => {
      resolveConnect(cleanup);
      await Promise.resolve();
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
