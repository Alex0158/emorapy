/**
 * useAdminToken Hook 單元測試
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setAdminToken } from '@/services/api/admin';
import { useAdminToken } from './useAdminToken';

describe('useAdminToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setAdminToken 後應即時更新 token 值', async () => {
    const { result } = renderHook(() => useAdminToken());
    expect(result.current).toBe('');

    act(() => {
      setAdminToken('admin-jwt');
    });

    await waitFor(() => {
      expect(result.current).toBe('admin-jwt');
    });
  });
});
