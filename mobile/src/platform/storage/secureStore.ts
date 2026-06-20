import * as SecureStore from 'expo-secure-store';

import type {
  PendingLandingStorageAdapter,
  LocaleStorageAdapter,
  SessionStorageAdapter,
  TokenStorageAdapter,
} from './types';

const TOKEN_KEY = 'emorapy.auth.token';
const SESSION_ID_KEY = 'emorapy.session.id';
const DEVICE_META_KEY = 'emorapy.device.meta';
const PENDING_LANDING_HREF_KEY = 'emorapy.navigation.pendingLandingHref';
const LOCALE_KEY = 'emorapy.locale';
const LEGACY_TOKEN_KEYS = ['cj.auth.token'] as const;
const LEGACY_SESSION_ID_KEYS = ['cj.session.id'] as const;
const LEGACY_DEVICE_META_KEYS = ['cj.device.meta'] as const;
const LEGACY_PENDING_LANDING_HREF_KEYS = ['cj.navigation.pendingLandingHref'] as const;
const LEGACY_LOCALE_KEYS = ['cj.locale'] as const;
const memoryStore = new Map<string, string>();

type StorageKeySet = {
  current: string;
  legacy: readonly string[];
};

const tokenKeys: StorageKeySet = { current: TOKEN_KEY, legacy: LEGACY_TOKEN_KEYS };
const sessionIdKeys: StorageKeySet = { current: SESSION_ID_KEY, legacy: LEGACY_SESSION_ID_KEYS };
const deviceMetaKeys: StorageKeySet = { current: DEVICE_META_KEY, legacy: LEGACY_DEVICE_META_KEYS };
const pendingLandingHrefKeys: StorageKeySet = {
  current: PENDING_LANDING_HREF_KEY,
  legacy: LEGACY_PENDING_LANDING_HREF_KEYS,
};
const localeKeys: StorageKeySet = { current: LOCALE_KEY, legacy: LEGACY_LOCALE_KEYS };

export interface DeviceMetadata {
  installationId?: string;
  platform?: 'ios' | 'android' | 'web';
  pushToken?: string;
  appVersion?: string;
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

async function deleteLegacyItems(keys: StorageKeySet): Promise<void> {
  await Promise.all(keys.legacy.map(key => deleteItem(key)));
}

async function deleteKeySet(keys: StorageKeySet): Promise<void> {
  await Promise.all([
    deleteItem(keys.current),
    deleteLegacyItems(keys),
  ]);
}

async function getMigratedItem(keys: StorageKeySet): Promise<string | null> {
  const current = await getItem(keys.current);
  if (current) {
    await deleteLegacyItems(keys);
    return current;
  }
  for (const legacyKey of keys.legacy) {
    const legacy = await getItem(legacyKey);
    if (!legacy) continue;
    await setItem(keys.current, legacy);
    await deleteLegacyItems(keys);
    return legacy;
  }
  return null;
}

async function setNullableKeySet(keys: StorageKeySet, value: string | null): Promise<void> {
  if (!value) {
    await deleteKeySet(keys);
    return;
  }
  await setItem(keys.current, value);
  await deleteLegacyItems(keys);
}

export const tokenStorage: TokenStorageAdapter = {
  getToken: () => getMigratedItem(tokenKeys),
  setToken: (token) => setNullableKeySet(tokenKeys, token),
  clearToken: () => deleteKeySet(tokenKeys),
};

export const sessionStorage: SessionStorageAdapter = {
  getSessionId: () => getMigratedItem(sessionIdKeys),
  setSessionId: (sessionId) => setNullableKeySet(sessionIdKeys, sessionId),
  clearSessionId: () => deleteKeySet(sessionIdKeys),
};

export const pendingLandingStorage: PendingLandingStorageAdapter = {
  getPendingHref: () => getMigratedItem(pendingLandingHrefKeys),
  setPendingHref: (href) => setNullableKeySet(pendingLandingHrefKeys, href),
  clearPendingHref: () => deleteKeySet(pendingLandingHrefKeys),
  consumePendingHref: async () => {
    const href = await getMigratedItem(pendingLandingHrefKeys);
    await deleteKeySet(pendingLandingHrefKeys);
    return href;
  },
};

export const localeStorage: LocaleStorageAdapter = {
  getLocale: () => getMigratedItem(localeKeys),
  setLocale: (locale) => setNullableKeySet(localeKeys, locale),
  clearLocale: () => deleteKeySet(localeKeys),
};

export async function getDeviceMetadata(): Promise<DeviceMetadata | null> {
  const raw = await getMigratedItem(deviceMetaKeys);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceMetadata;
  } catch {
    await deleteKeySet(deviceMetaKeys);
    return null;
  }
}

export async function setDeviceMetadata(metadata: DeviceMetadata | null): Promise<void> {
  await setNullableKeySet(deviceMetaKeys, metadata ? JSON.stringify(metadata) : null);
}

export async function clearAppStorage(): Promise<void> {
  await Promise.all([
    deleteKeySet(tokenKeys),
    deleteKeySet(sessionIdKeys),
    deleteKeySet(deviceMetaKeys),
    deleteKeySet(pendingLandingHrefKeys),
    deleteKeySet(localeKeys),
  ]);
}
