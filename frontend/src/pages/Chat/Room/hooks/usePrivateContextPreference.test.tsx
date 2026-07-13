import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrivateContextPreference } from './usePrivateContextPreference';

const mocks = vi.hoisted(() => ({
  getPreference: vi.fn(),
  updatePreference: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/api/chat', () => ({
  getPrivateContextPreference: (...args: unknown[]) => mocks.getPreference(...args),
  updatePrivateContextPreference: (...args: unknown[]) => mocks.updatePreference(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

describe('usePrivateContextPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPreference.mockResolvedValue({ mode: 'private_only' });
  });

  it('切換房間時立即清除上一房間的 mode，並忽略舊 load response', async () => {
    let resolveRoomA!: (value: { mode: 'shared_process_controls' }) => void;
    mocks.getPreference.mockImplementation((roomId: string) => (
      roomId === 'room-a'
        ? new Promise((resolve) => { resolveRoomA = resolve; })
        : Promise.resolve({ mode: 'private_only' })
    ));
    const { result, rerender } = renderHook(
      ({ roomId }) => usePrivateContextPreference(roomId),
      { initialProps: { roomId: 'room-a' as string | null } },
    );

    rerender({ roomId: 'room-b' });
    expect(result.current.mode).toBe('private_only');
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      resolveRoomA({ mode: 'shared_process_controls' });
      await Promise.resolve();
    });
    expect(result.current.mode).toBe('private_only');
  });

  it('舊房間 save 回應不得覆蓋新房間 mode 或顯示成功提示', async () => {
    let resolveSave!: (value: { mode: 'shared_process_controls' }) => void;
    mocks.updatePreference.mockImplementation(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ roomId }) => usePrivateContextPreference(roomId),
      { initialProps: { roomId: 'room-a' as string | null } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { void result.current.updateMode('shared_process_controls'); });
    await waitFor(() => expect(result.current.saving).toBe(true));
    rerender({ roomId: 'room-b' });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      resolveSave({ mode: 'shared_process_controls' });
      await Promise.resolve();
    });
    expect(result.current.mode).toBe('private_only');
    expect(result.current.saving).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
