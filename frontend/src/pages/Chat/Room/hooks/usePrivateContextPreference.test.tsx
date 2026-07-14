import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrivateContextPreference } from './usePrivateContextPreference';

const mocks = vi.hoisted(() => ({
  getPreference: vi.fn(),
  updatePreference: vi.fn(),
  updateAdaptation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/api/chat', () => ({
  getPrivateContextPreference: (...args: unknown[]) => mocks.getPreference(...args),
  updatePrivateContextPreference: (...args: unknown[]) => mocks.updatePreference(...args),
  updateSharedAdaptationConsent: (...args: unknown[]) => mocks.updateAdaptation(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

describe('usePrivateContextPreference', () => {
  const preference = (mode: 'private_only' | 'shared_process_controls') => ({
    participant_id: 'participant-a',
    mode,
    mode_policy_version: '2026-07-13.adaptation-v1',
    mode_updated_at: '2026-07-13T19:00:00.000Z',
    adaptation_decision: 'not_set' as const,
    adaptation_policy_version: null,
    adaptation_decided_at: null,
    room_adaptation: {
      policy_version: '2026-07-13.adaptation-v1',
      enabled: false,
      active_participant_count: 2,
      accepted_participant_count: 0,
      owner_opt_in_count: mode === 'shared_process_controls' ? 1 : 0,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPreference.mockResolvedValue(preference('private_only'));
  });

  it('切換房間時立即清除上一房間的 mode，並忽略舊 load response', async () => {
    let resolveRoomA!: (value: ReturnType<typeof preference>) => void;
    mocks.getPreference.mockImplementation((roomId: string) => (
      roomId === 'room-a'
        ? new Promise((resolve) => { resolveRoomA = resolve; })
        : Promise.resolve(preference('private_only'))
    ));
    const { result, rerender } = renderHook(
      ({ roomId }) => usePrivateContextPreference(roomId),
      { initialProps: { roomId: 'room-a' as string | null } },
    );

    rerender({ roomId: 'room-b' });
    expect(result.current.mode).toBe('private_only');
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      resolveRoomA(preference('shared_process_controls'));
      await Promise.resolve();
    });
    expect(result.current.mode).toBe('private_only');
  });

  it('舊房間 save 回應不得覆蓋新房間 mode 或顯示成功提示', async () => {
    let resolveSave!: (value: ReturnType<typeof preference>) => void;
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
      resolveSave(preference('shared_process_controls'));
      await Promise.resolve();
    });
    expect(result.current.mode).toBe('private_only');
    expect(result.current.saving).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('mode 與 adaptation consent 使用同一 server policy version 但分開更新', async () => {
    mocks.updatePreference.mockResolvedValue(preference('shared_process_controls'));
    mocks.updateAdaptation.mockResolvedValue({
      ...preference('shared_process_controls'),
      adaptation_decision: 'accepted',
    });
    const { result } = renderHook(() => usePrivateContextPreference('room-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.updateMode('shared_process_controls'));
    expect(mocks.updatePreference).toHaveBeenCalledWith(
      'room-a',
      'shared_process_controls',
      '2026-07-13.adaptation-v1',
    );
    await act(async () => result.current.updateAdaptationDecision('accepted'));
    expect(mocks.updateAdaptation).toHaveBeenCalledWith(
      'room-a',
      'accepted',
      '2026-07-13.adaptation-v1',
    );
  });

  it('成員變動後可靜默 refresh server consent，不沿用 stale room adaptation', async () => {
    const resetPreference = {
      ...preference('shared_process_controls'),
      adaptation_decision: 'not_set' as const,
      room_adaptation: {
        ...preference('shared_process_controls').room_adaptation,
        active_participant_count: 2,
        accepted_participant_count: 0,
      },
    };
    mocks.getPreference
      .mockResolvedValueOnce({
        ...preference('shared_process_controls'),
        adaptation_decision: 'accepted',
        room_adaptation: {
          ...preference('shared_process_controls').room_adaptation,
          active_participant_count: 1,
          accepted_participant_count: 1,
        },
      });
    const { result } = renderHook(() => usePrivateContextPreference('room-a'));
    await waitFor(() => expect(result.current.adaptationDecision).toBe('accepted'));

    let finishRefresh!: (value: typeof resetPreference) => void;
    mocks.getPreference.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefresh = resolve;
    }));
    act(() => { void result.current.refresh(false); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.ready).toBe(false);

    await act(async () => finishRefresh(resetPreference));

    expect(result.current.adaptationDecision).toBe('not_set');
    expect(result.current.roomAdaptation?.active_participant_count).toBe(2);
    expect(mocks.getPreference).toHaveBeenCalledTimes(2);
  });

  it('同房 refresh 令 save response stale 時仍會釋放 saving lock', async () => {
    let finishSave!: (value: ReturnType<typeof preference>) => void;
    mocks.updatePreference.mockImplementationOnce(() => new Promise((resolve) => {
      finishSave = resolve;
    }));
    const { result } = renderHook(() => usePrivateContextPreference('room-a'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => { void result.current.updateMode('shared_process_controls'); });
    await waitFor(() => expect(result.current.saving).toBe(true));
    await act(async () => result.current.refresh(false));
    await act(async () => finishSave(preference('shared_process_controls')));

    expect(result.current.saving).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('載入失敗時 fail-closed，重試成功後才恢復 ready', async () => {
    mocks.getPreference.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => usePrivateContextPreference('room-a'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(result.current.unavailable).toBe(true);
    expect(mocks.error).toHaveBeenCalledWith('暫時無法載入私人內容設定');

    mocks.getPreference.mockResolvedValueOnce(preference('private_only'));
    await act(async () => result.current.refresh(true));

    expect(result.current.ready).toBe(true);
    expect(result.current.unavailable).toBe(false);
  });
});
