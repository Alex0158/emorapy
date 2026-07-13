import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChatRoomSafetyStatus } from '@/services/api/chat';
import { useChatRoomSafetyStatus } from './useChatRoomSafetyStatus';

vi.mock('@/services/api/chat', () => ({
  getChatRoomSafetyStatus: vi.fn(),
}));

const mockGetChatRoomSafetyStatus = vi.mocked(getChatRoomSafetyStatus);

describe('useChatRoomSafetyStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and refreshes the sanitized status for the active room', async () => {
    mockGetChatRoomSafetyStatus
      .mockResolvedValueOnce({ status: 'open' })
      .mockResolvedValueOnce({ status: 'paused' });
    const { result } = renderHook(() => useChatRoomSafetyStatus('room-1'));

    await waitFor(() => expect(result.current.status).toBe('open'));
    await act(async () => {
      await result.current.refresh(false);
    });

    expect(result.current.status).toBe('paused');
    expect(result.current.paused).toBe(true);
    expect(result.current.blocked).toBe(true);
    expect(mockGetChatRoomSafetyStatus).toHaveBeenNthCalledWith(1, 'room-1');
    expect(mockGetChatRoomSafetyStatus).toHaveBeenNthCalledWith(2, 'room-1');
  });

  it('does not let a late response from the previous room overwrite the active room', async () => {
    let resolveRoomA!: (value: { status: 'paused' }) => void;
    mockGetChatRoomSafetyStatus.mockImplementation((roomId) => (
      roomId === 'room-a'
        ? new Promise((resolve) => { resolveRoomA = resolve; })
        : Promise.resolve({ status: 'open' })
    ));
    const { result, rerender } = renderHook(
      ({ roomId }) => useChatRoomSafetyStatus(roomId),
      { initialProps: { roomId: 'room-a' as string | null } },
    );

    rerender({ roomId: 'room-b' });
    await waitFor(() => expect(result.current.status).toBe('open'));
    await act(async () => {
      resolveRoomA({ status: 'paused' });
      await Promise.resolve();
    });

    expect(result.current.status).toBe('open');
  });

  it('status request 失敗時 fail closed，不把 unknown 當作 open', async () => {
    mockGetChatRoomSafetyStatus.mockRejectedValueOnce(new Error('network unavailable'));
    const { result } = renderHook(() => useChatRoomSafetyStatus('room-1'));

    await waitFor(() => expect(result.current.unavailable).toBe(true));

    expect(result.current.status).toBeNull();
    expect(result.current.blocked).toBe(true);
  });
});
