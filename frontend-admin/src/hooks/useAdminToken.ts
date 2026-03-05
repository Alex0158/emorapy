import { useSyncExternalStore } from 'react';
import { getAdminToken, subscribeAdminTokenChanges } from '@/services/api/admin';

export function useAdminToken(): string {
  return useSyncExternalStore(subscribeAdminTokenChanges, getAdminToken, () => '');
}
