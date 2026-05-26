import * as SecureStore from 'expo-secure-store';

import type {
  PendingLandingStorageAdapter,
  SessionStorageAdapter,
  TokenStorageAdapter,
} from './types';

const TOKEN_KEY = 'cj.auth.token';
const SESSION_ID_KEY = 'cj.session.id';
const DEVICE_META_KEY = 'cj.device.meta';
const PENDING_LANDING_HREF_KEY = 'cj.navigation.pendingLandingHref';
const memoryStore = new Map<string, string>();

export interface DeviceMetadata {
  installationId?: string;
  platform?: 'ios' | 'android' | 'web';
  pushToken?: string;
  appVersion?: string;
}

async function setNullableItem(key: string, value: string | null): Promise<void> {
  if (!value) {
    await deleteItem(key);
    return;
  }
  await setItem(key, value);
}

function canUseSecureStore(): boolean {
  return typeof SecureStore.getItemAsync === 'function'
    && typeof SecureStore.setItemAsync === 'function'
    && typeof SecureStore.deleteItemAsync === 'function';
}

async function getItem(key: string): Promise<string | null> {
  if (canUseSecureStore()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // Fall through to volatile storage for unsupported runtimes such as web export smoke.
    }
  }
  memoryStore.set(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // Fall through to volatile storage for unsupported runtimes such as web export smoke.
    }
  }
  memoryStore.delete(key);
}

export const tokenStorage: TokenStorageAdapter = {
  getToken: () => getItem(TOKEN_KEY),
  setToken: (token) => setNullableItem(TOKEN_KEY, token),
  clearToken: () => deleteItem(TOKEN_KEY),
};

export const sessionStorage: SessionStorageAdapter = {
  getSessionId: () => getItem(SESSION_ID_KEY),
  setSessionId: (sessionId) => setNullableItem(SESSION_ID_KEY, sessionId),
  clearSessionId: () => deleteItem(SESSION_ID_KEY),
};

export const pendingLandingStorage: PendingLandingStorageAdapter = {
  getPendingHref: () => getItem(PENDING_LANDING_HREF_KEY),
  setPendingHref: (href) => setNullableItem(PENDING_LANDING_HREF_KEY, href),
  clearPendingHref: () => deleteItem(PENDING_LANDING_HREF_KEY),
  consumePendingHref: async () => {
    const href = await getItem(PENDING_LANDING_HREF_KEY);
    await deleteItem(PENDING_LANDING_HREF_KEY);
    return href;
  },
};

export async function getDeviceMetadata(): Promise<DeviceMetadata | null> {
  const raw = await getItem(DEVICE_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceMetadata;
  } catch {
    await deleteItem(DEVICE_META_KEY);
    return null;
  }
}

export async function setDeviceMetadata(metadata: DeviceMetadata | null): Promise<void> {
  await setNullableItem(DEVICE_META_KEY, metadata ? JSON.stringify(metadata) : null);
}

export async function clearAppStorage(): Promise<void> {
  await Promise.all([
    deleteItem(TOKEN_KEY),
    deleteItem(SESSION_ID_KEY),
    deleteItem(DEVICE_META_KEY),
    deleteItem(PENDING_LANDING_HREF_KEY),
  ]);
}
