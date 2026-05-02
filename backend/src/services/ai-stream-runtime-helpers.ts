import type {
  AIStreamScopeType,
  AIStreamSnapshot,
  AIStreamStatus,
} from '../types/ai-stream';

export type StreamScopeKey = `${AIStreamScopeType}:${string}`;

export const DEFAULT_REPLAY_TTL_SECONDS = 24 * 60 * 60;
export const DEFAULT_MAX_EVENTS_PER_SCOPE = 400;
export const REDIS_CHANNEL = 'ai-stream:events';

export function isTerminalStatus(status: AIStreamStatus): boolean {
  return status === 'persisted' || status === 'failed' || status === 'cancelled';
}

export function buildScopeKey(scopeType: AIStreamScopeType, scopeId: string): StreamScopeKey {
  return `${scopeType}:${scopeId}`;
}

export function buildRedisScopePrefix(scopeType: AIStreamScopeType, scopeId: string): string {
  return `ai-stream:scope:${scopeType}:${scopeId}`;
}

export function sortSnapshots(a: AIStreamSnapshot, b: AIStreamSnapshot): number {
  return a.updatedAt.localeCompare(b.updatedAt);
}

export function buildArchiveBatchKey(): string {
  return `ai-stream-archive-${new Date().toISOString()}`;
}
