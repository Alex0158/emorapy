import { env } from '@/config/env';

export interface VersionRow {
  name: '客戶前端' | '管理前端' | '後端';
  version: string;
  commitSha?: string;
  status: 'ok' | 'error';
  message?: string;
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

function resolveFrontendVersionUrl(): string | null {
  const frontendBase = env.frontendBaseURL?.trim();
  if (!frontendBase) return null;

  try {
    const parsed = new URL(frontendBase);
    return `${parsed.origin}/version.json`;
  } catch {
    return null;
  }
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
  const frontendUrl = resolveFrontendVersionUrl();

  const [frontendResult, backendResult] = await Promise.allSettled([
    frontendUrl ? fetchRemoteVersion(frontendUrl) : Promise.reject(new Error('FRONTEND_URL_NOT_CONFIGURED')),
    fetchRemoteVersion(resolveBackendVersionUrl()),
  ]);

  const rows: VersionRow[] = [
    frontendResult.status === 'fulfilled'
      ? {
          name: '客戶前端',
          version: formatVersion(frontendResult.value.version, frontendResult.value.commitSha),
          commitSha: frontendResult.value.commitSha,
          status: 'ok',
        }
      : {
          name: '客戶前端',
          version: '讀取失敗',
          status: 'error',
          message:
            frontendUrl === null ? '未配置 VITE_FRONTEND_BASE_URL 或 URL 無效' : '無法連線客戶前端版本端點',
        },
    {
      name: '管理前端',
      version: formatVersion(localVersion, localCommitSha),
      commitSha: localCommitSha,
      status: 'ok',
    },
    backendResult.status === 'fulfilled'
      ? {
          name: '後端',
          version: formatVersion(backendResult.value.version, backendResult.value.commitSha),
          commitSha: backendResult.value.commitSha,
          status: 'ok',
        }
      : {
          name: '後端',
          version: '讀取失敗',
          status: 'error',
          message: '無法連線後端版本端點',
        },
  ];

  const snapshot: VersionSnapshot = {
    rows,
    fetchedAt: Date.now(),
  };
  cachedSnapshot = snapshot;
  return snapshot;
}
