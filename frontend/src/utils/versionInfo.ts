import { env } from '@/config/env';
import { getAdminLoginUrl } from '@/utils/adminEntry';

export interface VersionRow {
  service: 'frontend' | 'admin' | 'backend';
  version?: string;
  commitSha?: string;
  status: 'ok' | 'error';
  messageKey?: string;
}

export interface VersionSnapshot {
  rows: VersionRow[];
  fetchedAt: number;
}

interface RemoteVersionResponse {
  version?: string;
  commitSha?: string;
  commitShortSha?: string;
  data?: { version?: string; commitSha?: string; commitShortSha?: string };
}

const CACHE_TTL_MS = 20_000;
let cachedSnapshot: VersionSnapshot | null = null;

function resolveBackendVersionUrl(): string {
  const base = env.apiBaseURL.replace(/\/$/, '');
  return `${base}/version`;
}

function resolveAdminVersionUrl(): string | null {
  const adminLoginUrl = getAdminLoginUrl();
  if (!adminLoginUrl) return null;
  return `${new URL(adminLoginUrl).origin}/version.json`;
}

function formatVersion(version: string, commitSha?: string): string {
  if (!commitSha || commitSha === 'unknown') return version;
  return `${version}@${commitSha.slice(0, 7)}`;
}

async function fetchRemoteVersion(url: string): Promise<{ version: string; commitSha?: string }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    const json = (await response.json()) as RemoteVersionResponse;
    const version = json.data?.version ?? json.version;
    if (!version || typeof version !== 'string') {
      throw new Error('INVALID_VERSION_PAYLOAD');
    }
    const commitSha = json.data?.commitSha ?? json.commitSha ?? json.data?.commitShortSha ?? json.commitShortSha;
    return {
      version,
      commitSha: typeof commitSha === 'string' ? commitSha : undefined,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getVersionSnapshot(forceRefresh = false): Promise<VersionSnapshot> {
  if (
    !forceRefresh &&
    cachedSnapshot &&
    Date.now() - cachedSnapshot.fetchedAt < CACHE_TTL_MS
  ) {
    return cachedSnapshot;
  }

  const localVersion = import.meta.env.VITE_APP_VERSION || 'unknown';
  const localCommitSha = import.meta.env.VITE_APP_COMMIT_SHA || undefined;
  const adminUrl = resolveAdminVersionUrl();

  const [adminResult, backendResult] = await Promise.allSettled([
    adminUrl ? fetchRemoteVersion(adminUrl) : Promise.reject(new Error('ADMIN_URL_NOT_CONFIGURED')),
    fetchRemoteVersion(resolveBackendVersionUrl()),
  ]);

  const rows: VersionRow[] = [
    {
      service: 'frontend',
      version: formatVersion(localVersion, localCommitSha),
      commitSha: localCommitSha,
      status: 'ok',
    },
    adminResult.status === 'fulfilled'
      ? {
          service: 'admin',
          version: formatVersion(adminResult.value.version, adminResult.value.commitSha),
          commitSha: adminResult.value.commitSha,
          status: 'ok',
        }
      : {
          service: 'admin',
          status: 'error',
          messageKey:
            adminUrl === null ? 'versionInfo.adminUrlInvalid' : 'versionInfo.adminVersionEndpointUnavailable',
        },
    backendResult.status === 'fulfilled'
      ? {
          service: 'backend',
          version: formatVersion(backendResult.value.version, backendResult.value.commitSha),
          commitSha: backendResult.value.commitSha,
          status: 'ok',
        }
      : {
          service: 'backend',
          status: 'error',
          messageKey: 'versionInfo.backendVersionEndpointUnavailable',
        },
  ];

  const snapshot: VersionSnapshot = {
    rows,
    fetchedAt: Date.now(),
  };
  cachedSnapshot = snapshot;
  return snapshot;
}
