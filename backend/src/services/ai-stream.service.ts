import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { env } from '../config/env';
import logger from '../config/logger';
import type {
  AIStreamEvent,
  AIStreamErrorPayload,
  AIStreamPhase,
  AIStreamScopeType,
  AIStreamSnapshot,
  AIStreamStatus,
} from '../types/ai-stream';
import { aiStreamMetricsService } from './ai-stream-metrics.service';
import {
  DEFAULT_MAX_EVENTS_PER_SCOPE,
  DEFAULT_REPLAY_TTL_SECONDS,
  REDIS_CHANNEL,
  type StreamScopeKey,
  buildArchiveBatchKey,
  buildRedisScopePrefix,
  buildScopeKey,
  isTerminalStatus,
  sortSnapshots,
} from './ai-stream-runtime-helpers';

type Listener = (event: AIStreamEvent) => void;

export interface AIStreamHandle {
  streamId: string;
  requestId: string;
  scopeType: AIStreamScopeType;
  scopeId: string;
}

interface ScopeState {
  seq: number;
  events: AIStreamEvent[];
  listeners: Set<Listener>;
  snapshots: Map<string, AIStreamSnapshot>;
}

interface StreamTimingState {
  createdAtMs?: number;
  firstDeltaAtMs?: number;
  completedAtMs?: number;
  persistedAtMs?: number;
}

interface PublishOptions {
  actorRole?: string;
  phase?: AIStreamPhase;
  messageId?: string;
  deltaText?: string;
  fullText?: string;
  metadata?: Record<string, unknown>;
  error?: AIStreamErrorPayload;
}

interface AIStreamRedisConfig {
  enabled?: boolean;
  replayTtlSeconds?: number;
  maxEventsPerScope?: number;
  persistToDatabase?: boolean;
}

interface AIStreamReportOptions {
  days?: number;
  limit?: number;
}

interface AIStreamCleanupOptions {
  sessionRetentionDays?: number;
  eventRetentionDays?: number;
  archiveEnabled?: boolean;
  archiveBatchSize?: number;
  dryRun?: boolean;
}

type AIStreamPersistenceSource = 'live' | 'archive' | 'all';

interface AIStreamSessionListOptions {
  days?: number;
  limit?: number;
  offset?: number;
  status?: string;
  scopeType?: string;
  scopeId?: string;
  requestId?: string;
  streamId?: string;
  source?: AIStreamPersistenceSource;
}

interface AIStreamDetailOptions {
  eventLimit?: number;
  source?: AIStreamPersistenceSource;
  includeSensitive?: boolean;
}

let prismaLoader: (() => any) | null = null;

function loadPrisma(): any {
  if (!prismaLoader) {
    prismaLoader = () => require('../config/database').default;
  }
  return prismaLoader();
}

function mapDatabaseEventRecordToEvent(record: Record<string, unknown>): AIStreamEvent {
  return {
    eventType: record.event_type as AIStreamEvent['eventType'],
    streamId: String(record.stream_id),
    requestId: String(record.request_id),
    scopeType: record.scope_type as AIStreamScopeType,
    scopeId: String(record.scope_id),
    seq: Number(record.seq),
    createdAt: new Date(record.created_at as Date).toISOString(),
    actorRole: record.actor_role ? String(record.actor_role) : undefined,
    messageId: record.message_id ? String(record.message_id) : undefined,
    deltaText: record.delta_text ? String(record.delta_text) : undefined,
    fullText: record.full_text ? String(record.full_text) : undefined,
    phase: record.phase as AIStreamPhase | undefined,
    metadata: record.metadata as Record<string, unknown> | undefined,
    error: record.error as AIStreamErrorPayload | undefined,
  };
}

function mapDatabaseSessionRecordToSnapshot(record: Record<string, unknown>): AIStreamSnapshot {
  return {
    streamId: String(record.stream_id),
    requestId: String(record.request_id),
    scopeType: record.scope_type as AIStreamScopeType,
    scopeId: String(record.scope_id),
    status: record.status as AIStreamStatus,
    lastSeq: Number(record.last_seq),
    text: record.text ? String(record.text) : undefined,
    phase: record.phase as AIStreamPhase | undefined,
    messageId: record.message_id ? String(record.message_id) : undefined,
    metadata: record.metadata as Record<string, unknown> | undefined,
    error: record.error as AIStreamErrorPayload | undefined,
    updatedAt: new Date(record.updated_at as Date).toISOString(),
  };
}

const ADMIN_SAFE_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_.:-]{0,127}$/;

function projectAIStreamErrorForAdmin(
  error: unknown,
  includeSensitive: boolean
): unknown {
  if (includeSensitive) return error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;

  const source = error as Record<string, unknown>;
  const projected: { code?: string; retryable?: boolean } = {};
  if (
    typeof source.code === 'string'
    && ADMIN_SAFE_ERROR_CODE_PATTERN.test(source.code)
  ) {
    projected.code = source.code;
  }
  if (typeof source.retryable === 'boolean') {
    projected.retryable = source.retryable;
  }

  return Object.keys(projected).length > 0 ? projected : null;
}

export class AIStreamService {
  private scopes = new Map<StreamScopeKey, ScopeState>();
  private streamTiming = new Map<string, StreamTimingState>();
  private readonly replayTtlSeconds: number;
  private readonly maxEventsPerScope: number;
  private readonly redisEnabled: boolean;
  private readonly enableDatabasePersistence: boolean;
  private redisCommand: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private redisReady = false;
  private redisInitPromise: Promise<void> | null = null;

  constructor(config: AIStreamRedisConfig = {}) {
    this.replayTtlSeconds = config.replayTtlSeconds ?? DEFAULT_REPLAY_TTL_SECONDS;
    this.maxEventsPerScope = config.maxEventsPerScope ?? DEFAULT_MAX_EVENTS_PER_SCOPE;
    this.redisEnabled = config.enabled ?? (env.NODE_ENV !== 'test' && Boolean(env.REDIS_URL));
    this.enableDatabasePersistence = config.persistToDatabase ?? env.NODE_ENV !== 'test';

    if (this.redisEnabled && env.REDIS_URL) {
      this.redisInitPromise = this.initRedis(env.REDIS_URL);
    }
  }

  private async initRedis(redisUrl: string): Promise<void> {
    try {
      const command = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });
      const subscriber = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });

      command.on('error', (error) => {
        logger.warn('AI Stream Redis command client error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      subscriber.on('error', (error) => {
        logger.warn('AI Stream Redis subscriber error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

      await command.connect();
      await subscriber.connect();
      await subscriber.subscribe(REDIS_CHANNEL);
      subscriber.on('message', (channel, payload) => {
        if (channel !== REDIS_CHANNEL) return;
        this.handleRedisMessage(payload);
      });

      this.redisCommand = command;
      this.redisSubscriber = subscriber;
      this.redisReady = true;
      logger.info('Redis connected for AI Stream runtime');
    } catch (error) {
      this.redisReady = false;
      logger.warn('AI Stream Redis unavailable, falling back to in-memory runtime', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async ensureRedisReady(): Promise<boolean> {
    if (!this.redisEnabled) return false;
    if (this.redisReady && this.redisCommand) return true;
    if (this.redisInitPromise) {
      await this.redisInitPromise;
    }
    return this.redisReady && !!this.redisCommand;
  }

  private getScopeState(scopeType: AIStreamScopeType, scopeId: string): ScopeState {
    const key = buildScopeKey(scopeType, scopeId);
    const existing = this.scopes.get(key);
    if (existing) return existing;
    const created: ScopeState = {
      seq: 0,
      events: [],
      listeners: new Set<Listener>(),
      snapshots: new Map<string, AIStreamSnapshot>(),
    };
    this.scopes.set(key, created);
    return created;
  }

  private deriveStatus(eventType: AIStreamEvent['eventType'], previous?: AIStreamSnapshot): AIStreamStatus {
    switch (eventType) {
      case 'stream.created':
        return 'created';
      case 'stream.queued':
        return 'queued';
      case 'stream.started':
      case 'stream.phase':
        return 'started';
      case 'stream.delta':
        return 'streaming';
      case 'stream.completed':
        return 'completed';
      case 'stream.persisted':
        return 'persisted';
      case 'stream.failed':
        return 'failed';
      case 'stream.cancelled':
        return 'cancelled';
      case 'stream.heartbeat':
        return previous?.status ?? 'started';
    }
  }

  private buildSnapshot(
    handle: AIStreamHandle,
    event: AIStreamEvent,
    previous?: AIStreamSnapshot
  ): AIStreamSnapshot {
    const nextStatus = this.deriveStatus(event.eventType, previous);
    const nextText =
      event.eventType === 'stream.delta'
        ? `${previous?.text ?? ''}${event.deltaText ?? ''}`
        : (event.fullText ?? previous?.text ?? '');

    return {
      streamId: handle.streamId,
      requestId: handle.requestId,
      scopeType: handle.scopeType,
      scopeId: handle.scopeId,
      status: nextStatus,
      lastSeq: event.seq,
      text: nextText,
      phase: event.phase ?? previous?.phase,
      messageId: event.messageId ?? previous?.messageId,
      metadata: event.metadata ?? previous?.metadata,
      error: event.error ?? previous?.error,
      updatedAt: event.createdAt,
    };
  }

  private applyEventToLocalState(event: AIStreamEvent, notifyListeners: boolean): AIStreamSnapshot {
    const state = this.getScopeState(event.scopeType, event.scopeId);
    const previous = state.snapshots.get(event.streamId);
    const snapshot = this.buildSnapshot(
      {
        streamId: event.streamId,
        requestId: event.requestId,
        scopeType: event.scopeType,
        scopeId: event.scopeId,
      },
      event,
      previous
    );

    state.seq = Math.max(state.seq, event.seq);
    state.snapshots.set(event.streamId, snapshot);

    const existingIndex = state.events.findIndex((candidate) => candidate.seq === event.seq);
    if (existingIndex >= 0) {
      state.events[existingIndex] = event;
    } else {
      state.events.push(event);
      state.events.sort((a, b) => a.seq - b.seq);
      if (state.events.length > this.maxEventsPerScope) {
        state.events.splice(0, state.events.length - this.maxEventsPerScope);
      }
    }

    if (notifyListeners) {
      state.listeners.forEach((listener) => listener(event));
    }

    return snapshot;
  }

  private async nextSeq(scopeType: AIStreamScopeType, scopeId: string): Promise<number> {
    if (await this.ensureRedisReady()) {
      try {
        const prefix = buildRedisScopePrefix(scopeType, scopeId);
        const seq = await this.redisCommand!.incr(`${prefix}:seq`);
        await this.redisCommand!.expire(`${prefix}:seq`, this.replayTtlSeconds);
        return seq;
      } catch (error) {
        logger.warn('AI Stream Redis seq increment failed, falling back to memory seq', {
          scopeType,
          scopeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const state = this.getScopeState(scopeType, scopeId);
    state.seq += 1;
    return state.seq;
  }

  private async persistToRedis(event: AIStreamEvent, snapshot: AIStreamSnapshot): Promise<void> {
    if (!(await this.ensureRedisReady())) return;

    const prefix = buildRedisScopePrefix(event.scopeType, event.scopeId);
    try {
      const pipeline = this.redisCommand!.pipeline();
      pipeline.rpush(`${prefix}:events`, JSON.stringify(event));
      pipeline.ltrim(`${prefix}:events`, -this.maxEventsPerScope, -1);
      pipeline.expire(`${prefix}:events`, this.replayTtlSeconds);
      pipeline.hset(`${prefix}:snapshots`, event.streamId, JSON.stringify(snapshot));
      pipeline.expire(`${prefix}:snapshots`, this.replayTtlSeconds);
      pipeline.publish(REDIS_CHANNEL, JSON.stringify(event));
      await pipeline.exec();
    } catch (error) {
      logger.warn('AI Stream Redis persistence failed', {
        scopeType: event.scopeType,
        scopeId: event.scopeId,
        streamId: event.streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildSessionPersistencePayload(event: AIStreamEvent, snapshot: AIStreamSnapshot): Record<string, unknown> {
    const eventTime = new Date(event.createdAt);
    return {
      request_id: event.requestId,
      scope_type: event.scopeType,
      scope_id: event.scopeId,
      status: snapshot.status,
      last_seq: snapshot.lastSeq,
      last_event_type: event.eventType,
      actor_role: event.actorRole ?? null,
      text: snapshot.text ?? null,
      phase: snapshot.phase ?? null,
      message_id: snapshot.messageId ?? null,
      metadata: snapshot.metadata ?? null,
      error: snapshot.error ?? null,
      backend_mode: this.getBackendMode(),
      started_at: event.eventType === 'stream.started' ? eventTime : undefined,
      completed_at: event.eventType === 'stream.completed' ? eventTime : undefined,
      persisted_at: event.eventType === 'stream.persisted' ? eventTime : undefined,
      failed_at: event.eventType === 'stream.failed' ? eventTime : undefined,
      cancelled_at: event.eventType === 'stream.cancelled' ? eventTime : undefined,
    };
  }

  private async persistEventToDatabase(event: AIStreamEvent, snapshot: AIStreamSnapshot): Promise<void> {
    if (!this.enableDatabasePersistence) return;

    try {
      const prisma = loadPrisma();
      const sessionData = this.buildSessionPersistencePayload(event, snapshot);
      await prisma.aIStreamSession.upsert({
        where: { stream_id: event.streamId },
        create: {
          stream_id: event.streamId,
          created_at: new Date(event.createdAt),
          ...sessionData,
        },
        update: sessionData,
      });

      if (event.eventType !== 'stream.heartbeat') {
        await prisma.aIStreamEventRecord.create({
          data: {
            stream_id: event.streamId,
            request_id: event.requestId,
            scope_type: event.scopeType,
            scope_id: event.scopeId,
            seq: event.seq,
            event_type: event.eventType,
            actor_role: event.actorRole ?? null,
            message_id: event.messageId ?? null,
            delta_text: event.deltaText ?? null,
            full_text: event.fullText ?? null,
            phase: event.phase ?? null,
            metadata: event.metadata ?? null,
            error: event.error ?? null,
            created_at: new Date(event.createdAt),
          },
        });
      }
    } catch (error) {
      logger.warn('AI Stream database persistence failed', {
        scopeType: event.scopeType,
        scopeId: event.scopeId,
        streamId: event.streamId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleRedisMessage(payload: string): void {
    try {
      const event = JSON.parse(payload) as AIStreamEvent;
      const state = this.getScopeState(event.scopeType, event.scopeId);
      if (state.events.some((candidate) => candidate.seq === event.seq)) {
        return;
      }
      this.applyEventToLocalState(event, true);
    } catch (error) {
      logger.warn('AI Stream Redis event parse failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readEventsFromRedis(scopeType: AIStreamScopeType, scopeId: string): Promise<AIStreamEvent[]> {
    if (!(await this.ensureRedisReady())) return [];
    const prefix = buildRedisScopePrefix(scopeType, scopeId);
    try {
      const raw = await this.redisCommand!.lrange(`${prefix}:events`, 0, -1);
      return raw
        .map((value) => {
          try {
            return JSON.parse(value) as AIStreamEvent;
          } catch {
            return null;
          }
        })
        .filter((event): event is AIStreamEvent => Boolean(event))
        .sort((a, b) => a.seq - b.seq);
    } catch (error) {
      logger.warn('AI Stream Redis replay read failed', {
        scopeType,
        scopeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async readSnapshotsFromRedis(scopeType: AIStreamScopeType, scopeId: string): Promise<AIStreamSnapshot[]> {
    if (!(await this.ensureRedisReady())) return [];
    const prefix = buildRedisScopePrefix(scopeType, scopeId);
    try {
      const raw = await this.redisCommand!.hgetall(`${prefix}:snapshots`);
      return Object.values(raw)
        .map((value) => {
          try {
            return JSON.parse(value) as AIStreamSnapshot;
          } catch {
            return null;
          }
        })
        .filter((snapshot): snapshot is AIStreamSnapshot => Boolean(snapshot))
        .sort(sortSnapshots);
    } catch (error) {
      logger.warn('AI Stream Redis snapshot read failed', {
        scopeType,
        scopeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async readEventsFromDatabase(scopeType: AIStreamScopeType, scopeId: string, afterSeq = 0): Promise<AIStreamEvent[]> {
    if (!this.enableDatabasePersistence) return [];

    try {
      const prisma = loadPrisma();
      const records = await prisma.aIStreamEventRecord.findMany({
        where: {
          scope_type: scopeType,
          scope_id: scopeId,
          ...(afterSeq > 0 ? { seq: { gt: afterSeq } } : {}),
        },
        orderBy: { seq: afterSeq > 0 ? 'asc' : 'desc' },
        take: this.maxEventsPerScope,
      });
      const events: AIStreamEvent[] = records.map((record: Record<string, unknown>) => mapDatabaseEventRecordToEvent(record));
      return events.sort((a, b) => a.seq - b.seq);
    } catch (error) {
      logger.warn('AI Stream database replay read failed', {
        scopeType,
        scopeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async readSnapshotsFromDatabase(scopeType: AIStreamScopeType, scopeId: string): Promise<AIStreamSnapshot[]> {
    if (!this.enableDatabasePersistence) return [];

    try {
      const prisma = loadPrisma();
      const records = await prisma.aIStreamSession.findMany({
        where: {
          scope_type: scopeType,
          scope_id: scopeId,
        },
        orderBy: { updated_at: 'desc' },
        take: this.maxEventsPerScope,
      });
      return records.map((record: Record<string, unknown>) => mapDatabaseSessionRecordToSnapshot(record)).sort(sortSnapshots);
    } catch (error) {
      logger.warn('AI Stream database snapshot read failed', {
        scopeType,
        scopeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private recordTimingMetrics(event: AIStreamEvent): void {
    const timing = this.streamTiming.get(event.streamId) ?? {};
    const eventMs = Date.parse(event.createdAt);

    if (event.eventType === 'stream.created') {
      timing.createdAtMs = eventMs;
    }

    if (event.eventType === 'stream.delta' && timing.firstDeltaAtMs === undefined) {
      timing.firstDeltaAtMs = eventMs;
      if (timing.createdAtMs !== undefined) {
        aiStreamMetricsService.observeFirstDelta(event.scopeType, Math.max(0, eventMs - timing.createdAtMs));
      }
    }

    if (event.eventType === 'stream.completed') {
      timing.completedAtMs = eventMs;
    }

    if (event.eventType === 'stream.persisted') {
      timing.persistedAtMs = eventMs;
      aiStreamMetricsService.recordTerminal(event.scopeType, 'persisted');
      if (timing.completedAtMs !== undefined) {
        aiStreamMetricsService.observeCompleteToPersist(event.scopeType, Math.max(0, eventMs - timing.completedAtMs));
      }
    }

    if (event.eventType === 'stream.failed') {
      aiStreamMetricsService.recordTerminal(event.scopeType, 'failed');
    }

    if (event.eventType === 'stream.cancelled') {
      aiStreamMetricsService.recordTerminal(event.scopeType, 'cancelled');
    }

    this.streamTiming.set(event.streamId, timing);
  }

  async createStream(scopeType: AIStreamScopeType, scopeId: string, requestId = randomUUID()): Promise<AIStreamHandle> {
    const streamId = randomUUID();
    const handle = { streamId, requestId, scopeType, scopeId };
    await this.publish(handle, 'stream.created');
    await this.publish(handle, 'stream.queued');
    return handle;
  }

  async publish(handle: AIStreamHandle, eventType: AIStreamEvent['eventType'], options: PublishOptions = {}): Promise<AIStreamEvent> {
    const seq = await this.nextSeq(handle.scopeType, handle.scopeId);
    const createdAt = new Date().toISOString();
    const state = this.getScopeState(handle.scopeType, handle.scopeId);
    const previous = state.snapshots.get(handle.streamId);
    const event: AIStreamEvent = {
      eventType,
      streamId: handle.streamId,
      requestId: handle.requestId,
      scopeType: handle.scopeType,
      scopeId: handle.scopeId,
      seq,
      createdAt,
      actorRole: options.actorRole,
      phase: options.phase,
      messageId: options.messageId,
      deltaText: options.deltaText,
      fullText: options.fullText,
      metadata: options.metadata,
      error: options.error,
    };

    const snapshot = this.applyEventToLocalState(event, true);
    aiStreamMetricsService.recordEvent(handle.scopeType, eventType);
    this.recordTimingMetrics(event);
    await this.persistToRedis(event, snapshot);
    await this.persistEventToDatabase(event, snapshot);
    return event;
  }

  async start(handle: AIStreamHandle, options: PublishOptions = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.started', options);
  }

  async delta(handle: AIStreamHandle, deltaText: string, options: Omit<PublishOptions, 'deltaText'> = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.delta', { ...options, deltaText });
  }

  async phase(handle: AIStreamHandle, phase: AIStreamPhase, options: Omit<PublishOptions, 'phase'> = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.phase', { ...options, phase });
  }

  async completed(handle: AIStreamHandle, options: PublishOptions = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.completed', options);
  }

  async persisted(handle: AIStreamHandle, options: PublishOptions = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.persisted', options);
  }

  async failed(handle: AIStreamHandle, error: AIStreamErrorPayload, options: Omit<PublishOptions, 'error'> = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.failed', { ...options, error });
  }

  async cancelled(handle: AIStreamHandle, options: PublishOptions = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.cancelled', options);
  }

  async heartbeat(handle: AIStreamHandle, options: PublishOptions = {}): Promise<AIStreamEvent> {
    return this.publish(handle, 'stream.heartbeat', options);
  }

  async emitScopeHeartbeat(scopeType: AIStreamScopeType, scopeId: string): Promise<AIStreamEvent | null> {
    const snapshots = await this.getSnapshots(scopeType, scopeId);
    const latestActive = [...snapshots]
      .sort((a, b) => b.lastSeq - a.lastSeq)
      .find((snapshot) => !isTerminalStatus(snapshot.status));

    if (!latestActive) {
      return null;
    }

    return this.heartbeat({
      streamId: latestActive.streamId,
      requestId: latestActive.requestId,
      scopeType,
      scopeId,
    });
  }

  async subscribe(
    scopeType: AIStreamScopeType,
    scopeId: string,
    listener: Listener,
    options?: { afterSeq?: number }
  ): Promise<() => void> {
    const state = this.getScopeState(scopeType, scopeId);
    const afterSeq = options?.afterSeq ?? 0;
    const deliveredSeqs = new Set<number>();
    const scopedListener: Listener = (event) => {
      if (event.seq <= afterSeq || deliveredSeqs.has(event.seq)) return;
      deliveredSeqs.add(event.seq);
      listener(event);
    };

    state.listeners.add(scopedListener);

    const replayEvent = (event: AIStreamEvent, source: 'local' | 'redis' | 'database') => {
      if (source !== 'local') {
        this.applyEventToLocalState(event, false);
      }
      scopedListener(event);
    };

    const localReplay = afterSeq > 0 ? state.events.filter((event) => event.seq > afterSeq) : state.events;
    if (localReplay.length > 0) {
      localReplay.forEach((event) => replayEvent(event, 'local'));
    } else {
      const redisReplay = await this.readEventsFromRedis(scopeType, scopeId);
      const replay = afterSeq > 0 ? redisReplay.filter((event) => event.seq > afterSeq) : redisReplay;
      replay.forEach((event) => replayEvent(event, 'redis'));

      if (replay.length === 0) {
        const databaseReplay = await this.readEventsFromDatabase(scopeType, scopeId, afterSeq);
        databaseReplay.forEach((event) => replayEvent(event, 'database'));
      }

      const latestLocalReplay = afterSeq > 0 ? state.events.filter((event) => event.seq > afterSeq) : state.events;
      latestLocalReplay.forEach((event) => replayEvent(event, 'local'));
    }

    return () => {
      state.listeners.delete(scopedListener);
    };
  }

  async getSnapshots(scopeType: AIStreamScopeType, scopeId: string): Promise<AIStreamSnapshot[]> {
    const localSnapshots = Array.from(this.getScopeState(scopeType, scopeId).snapshots.values()).sort(sortSnapshots);
    if (localSnapshots.length > 0) return localSnapshots;

    const redisSnapshots = await this.readSnapshotsFromRedis(scopeType, scopeId);
    if (redisSnapshots.length > 0) {
      const state = this.getScopeState(scopeType, scopeId);
      redisSnapshots.forEach((snapshot) => {
        state.snapshots.set(snapshot.streamId, snapshot);
        state.seq = Math.max(state.seq, snapshot.lastSeq);
      });
    }
    if (redisSnapshots.length > 0) return redisSnapshots;

    const databaseSnapshots = await this.readSnapshotsFromDatabase(scopeType, scopeId);
    if (databaseSnapshots.length > 0) {
      const state = this.getScopeState(scopeType, scopeId);
      databaseSnapshots.forEach((snapshot) => {
        state.snapshots.set(snapshot.streamId, snapshot);
        state.seq = Math.max(state.seq, snapshot.lastSeq);
      });
    }
    return databaseSnapshots;
  }

  async dispose(): Promise<void> {
    const command = this.redisCommand;
    const subscriber = this.redisSubscriber;

    this.redisCommand = null;
    this.redisSubscriber = null;
    this.redisReady = false;
    this.redisInitPromise = null;

    await Promise.allSettled([
      command?.quit().catch(() => command.disconnect()),
      subscriber?.quit().catch(() => subscriber.disconnect()),
    ]);
  }

  getBackendMode(): 'redis' | 'memory' {
    return this.redisReady ? 'redis' : 'memory';
  }

  getRetentionPolicy(): Record<string, unknown> {
    return {
      sessionRetentionDays: env.AI_STREAM_SESSION_RETENTION_DAYS,
      eventRetentionDays: env.AI_STREAM_EVENT_RETENTION_DAYS,
      archiveEnabled: env.AI_STREAM_ARCHIVE_ENABLED,
      archiveBatchSize: env.AI_STREAM_ARCHIVE_BATCH_SIZE,
      backendMode: this.getBackendMode(),
    };
  }

  async getPersistenceReport(options: AIStreamReportOptions = {}): Promise<Record<string, unknown>> {
    const prisma = loadPrisma();
    const days = Math.min(Math.max(options.days ?? 7, 1), 90);
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalSessions,
      recentSessions,
      recentEvents,
      recentFailures,
      statusGroups,
      scopeGroups,
      backendModeGroups,
      activeSessions,
      archivedSessions,
      archivedEvents,
    ] = await Promise.all([
      prisma.aIStreamSession.count(),
      prisma.aIStreamSession.count({ where: { updated_at: { gte: since } } }),
      prisma.aIStreamEventRecord.count({ where: { created_at: { gte: since } } }),
      prisma.aIStreamSession.findMany({
        where: {
          updated_at: { gte: since },
          status: { in: ['failed', 'cancelled'] },
        },
        orderBy: { updated_at: 'desc' },
        take: limit,
        select: {
          stream_id: true,
          request_id: true,
          scope_type: true,
          scope_id: true,
          status: true,
          last_event_type: true,
          last_seq: true,
          error: true,
          updated_at: true,
        },
      }),
      prisma.aIStreamSession.groupBy({
        by: ['status'],
        where: { updated_at: { gte: since } },
        _count: { _all: true },
      }),
      prisma.aIStreamSession.groupBy({
        by: ['scope_type'],
        where: { updated_at: { gte: since } },
        _count: { _all: true },
      }),
      prisma.aIStreamSession.groupBy({
        by: ['backend_mode'],
        where: { updated_at: { gte: since } },
        _count: { _all: true },
      }),
      prisma.aIStreamSession.count({
        where: {
          status: { in: ['created', 'queued', 'started', 'streaming', 'completed'] },
        },
      }),
      prisma.aIStreamSessionArchive.count({ where: { archived_at: { gte: since } } }),
      prisma.aIStreamEventArchive.count({ where: { archived_at: { gte: since } } }),
    ]);

    return {
      windowDays: days,
      retentionPolicy: this.getRetentionPolicy(),
      totals: {
        totalSessions,
        recentSessions,
        recentEvents,
        activeSessions,
        archivedSessions,
        archivedEvents,
      },
      byStatus: statusGroups.map((item: { status: string; _count: { _all: number } }) => ({
        status: item.status,
        count: item._count._all,
      })),
      byScopeType: scopeGroups.map((item: { scope_type: string; _count: { _all: number } }) => ({
        scopeType: item.scope_type,
        count: item._count._all,
      })),
      byBackendMode: backendModeGroups.map((item: { backend_mode: string | null; _count: { _all: number } }) => ({
        backendMode: item.backend_mode || 'unknown',
        count: item._count._all,
      })),
      recentFailures: recentFailures.map((item: Record<string, unknown>) => ({
        streamId: item.stream_id,
        requestId: item.request_id,
        scopeType: item.scope_type,
        scopeId: item.scope_id,
        status: item.status,
        lastEventType: item.last_event_type,
        lastSeq: item.last_seq,
        error: projectAIStreamErrorForAdmin(item.error, false),
        updatedAt: item.updated_at,
      })),
    };
  }

  async listPersistenceSessions(options: AIStreamSessionListOptions = {}): Promise<Record<string, unknown>> {
    const prisma = loadPrisma();
    const days = Math.min(Math.max(options.days ?? 7, 1), 90);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const source = options.source ?? 'live';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const baseWhere = {
      ...(options.status ? { status: options.status as AIStreamStatus } : {}),
      ...(options.scopeType ? { scope_type: options.scopeType } : {}),
      ...(options.scopeId ? { scope_id: options.scopeId } : {}),
      ...(options.requestId ? { request_id: options.requestId } : {}),
      ...(options.streamId ? { stream_id: options.streamId } : {}),
    };
    const fetchSize = limit + offset;

    const mapSession = (item: Record<string, unknown>, itemSource: 'live' | 'archive') => ({
      streamId: item.stream_id,
      requestId: item.request_id,
      scopeType: item.scope_type,
      scopeId: item.scope_id,
      status: item.status,
      lastSeq: item.last_seq,
      lastEventType: item.last_event_type,
      actorRole: item.actor_role,
      phase: item.phase,
      messageId: item.message_id,
      backendMode: item.backend_mode,
      updatedAt: itemSource === 'archive' ? item.source_updated_at : item.updated_at,
      createdAt: itemSource === 'archive' ? item.source_created_at : item.created_at,
      archivedAt: itemSource === 'archive' ? item.archived_at : null,
      source: itemSource,
    });

    const fetchLive = async () => {
      const where = { ...baseWhere, updated_at: { gte: since } };
      const [total, items] = await Promise.all([
        prisma.aIStreamSession.count({ where }),
        prisma.aIStreamSession.findMany({
          where,
          orderBy: { updated_at: 'desc' },
          skip: source === 'live' ? offset : 0,
          take: source === 'live' ? limit : fetchSize,
        }),
      ]);
      return { total, items: items.map((item: Record<string, unknown>) => mapSession(item, 'live')) };
    };

    const fetchArchive = async () => {
      const where = { ...baseWhere, archived_at: { gte: since } };
      const [total, items] = await Promise.all([
        prisma.aIStreamSessionArchive.count({ where }),
        prisma.aIStreamSessionArchive.findMany({
          where,
          orderBy: { source_updated_at: 'desc' },
          skip: source === 'archive' ? offset : 0,
          take: source === 'archive' ? limit : fetchSize,
        }),
      ]);
      return { total, items: items.map((item: Record<string, unknown>) => mapSession(item, 'archive')) };
    };

    if (source === 'live') {
      const live = await fetchLive();
      return { source, total: live.total, limit, offset, items: live.items };
    }
    if (source === 'archive') {
      const archive = await fetchArchive();
      return { source, total: archive.total, limit, offset, items: archive.items };
    }

    const [live, archive] = await Promise.all([fetchLive(), fetchArchive()]);
    const merged = [...live.items, ...archive.items]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(offset, offset + limit);

    return {
      source,
      total: live.total + archive.total,
      limit,
      offset,
      items: merged,
    };
  }

  async getStreamPersistenceDetail(streamId: string, options: AIStreamDetailOptions = {}): Promise<Record<string, unknown> | null> {
    const prisma = loadPrisma();
    const eventLimit = Math.min(Math.max(options.eventLimit ?? 200, 1), 1000);
    const source = options.source ?? 'all';
    const includeSensitive = options.includeSensitive === true;

    const buildPayload = (
      session: Record<string, unknown> | null,
      events: Record<string, unknown>[],
      itemSource: 'live' | 'archive'
    ) => {
      if (!session) return null;
      return {
        source: itemSource,
        sensitiveContentIncluded: includeSensitive,
        session: {
          streamId: session.stream_id,
          requestId: session.request_id,
          scopeType: session.scope_type,
          scopeId: session.scope_id,
          status: session.status,
          lastSeq: session.last_seq,
          lastEventType: session.last_event_type,
          actorRole: session.actor_role,
          text: includeSensitive ? session.text : null,
          phase: session.phase,
          messageId: session.message_id,
          metadata: includeSensitive ? session.metadata : null,
          error: projectAIStreamErrorForAdmin(session.error, includeSensitive),
          backendMode: session.backend_mode,
          createdAt: itemSource === 'archive' ? session.source_created_at : session.created_at,
          updatedAt: itemSource === 'archive' ? session.source_updated_at : session.updated_at,
          archivedAt: itemSource === 'archive' ? session.archived_at : null,
        },
        events: events.map((event) => ({
          streamId: event.stream_id,
          requestId: event.request_id,
          scopeType: event.scope_type,
          scopeId: event.scope_id,
          seq: event.seq,
          eventType: event.event_type,
          actorRole: event.actor_role,
          messageId: event.message_id,
          deltaText: includeSensitive ? event.delta_text : null,
          fullText: includeSensitive ? event.full_text : null,
          phase: event.phase,
          metadata: includeSensitive ? event.metadata : null,
          error: projectAIStreamErrorForAdmin(event.error, includeSensitive),
          createdAt: itemSource === 'archive' ? event.source_created_at : event.created_at,
          archivedAt: itemSource === 'archive' ? event.archived_at : null,
          source: itemSource,
        })),
      };
    };

    const fetchLive = async () => {
      const session = await prisma.aIStreamSession.findUnique({ where: { stream_id: streamId } });
      if (!session) return null;
      const events = await prisma.aIStreamEventRecord.findMany({
        where: { stream_id: streamId },
        orderBy: { seq: 'asc' },
        take: eventLimit,
      });
      return buildPayload(session as Record<string, unknown>, events as Record<string, unknown>[], 'live');
    };

    const fetchArchive = async () => {
      const session = await prisma.aIStreamSessionArchive.findUnique({ where: { stream_id: streamId } });
      if (!session) return null;
      const events = await prisma.aIStreamEventArchive.findMany({
        where: { stream_id: streamId },
        orderBy: { seq: 'asc' },
        take: eventLimit,
      });
      return buildPayload(session as Record<string, unknown>, events as Record<string, unknown>[], 'archive');
    };

    if (source === 'live') return fetchLive();
    if (source === 'archive') return fetchArchive();
    return (await fetchLive()) ?? fetchArchive();
  }

  async cleanupPersistence(options: AIStreamCleanupOptions = {}): Promise<Record<string, unknown>> {
    const prisma = loadPrisma();
    const sessionRetentionDays = Math.min(Math.max(options.sessionRetentionDays ?? env.AI_STREAM_SESSION_RETENTION_DAYS, 7), 365);
    const eventRetentionDays = Math.min(Math.max(options.eventRetentionDays ?? env.AI_STREAM_EVENT_RETENTION_DAYS, 3), 180);
    const archiveEnabled = options.archiveEnabled ?? env.AI_STREAM_ARCHIVE_ENABLED;
    const archiveBatchSize = Math.min(Math.max(options.archiveBatchSize ?? env.AI_STREAM_ARCHIVE_BATCH_SIZE, 50), 2000);
    const dryRun = options.dryRun === true;
    const sessionCutoff = new Date(Date.now() - sessionRetentionDays * 24 * 60 * 60 * 1000);
    const eventCutoff = new Date(Date.now() - eventRetentionDays * 24 * 60 * 60 * 1000);
    const archiveBatchKey = buildArchiveBatchKey();

    const oldEventWhere = { created_at: { lt: eventCutoff } };
    const oldSessionWhere = {
      updated_at: { lt: sessionCutoff },
      status: { in: ['persisted', 'failed', 'cancelled'] },
    };

    if (dryRun) {
      const [candidateEvents, candidateSessions] = await Promise.all([
        prisma.aIStreamEventRecord.count({ where: oldEventWhere }),
        prisma.aIStreamSession.count({ where: oldSessionWhere }),
      ]);
      return {
        dryRun,
        archiveEnabled,
        archiveBatchSize,
        archiveBatchKey,
        eventRetentionDays,
        sessionRetentionDays,
        candidateEvents,
        candidateSessions,
        deletedEvents: 0,
        deletedSessions: 0,
        archivedEvents: 0,
        archivedSessions: 0,
      };
    }

    let archivedEvents = 0;
    let archivedSessions = 0;
    let deletedEvents = 0;
    let deletedSessions = 0;

    while (true) {
      const events = await prisma.aIStreamEventRecord.findMany({
        where: oldEventWhere,
        orderBy: { created_at: 'asc' },
        take: archiveBatchSize,
      });
      if (events.length === 0) break;

      if (archiveEnabled) {
        await prisma.aIStreamEventArchive.createMany({
          data: events.map((event: Record<string, unknown>) => ({
            archive_batch_key: archiveBatchKey,
            stream_id: event.stream_id,
            request_id: event.request_id,
            scope_type: event.scope_type,
            scope_id: event.scope_id,
            seq: event.seq,
            event_type: event.event_type,
            actor_role: event.actor_role,
            message_id: event.message_id,
            delta_text: event.delta_text,
            full_text: event.full_text,
            phase: event.phase,
            metadata: event.metadata,
            error: event.error,
            source_created_at: event.created_at,
          })),
          skipDuplicates: true,
        });
        archivedEvents += events.length;
      }

      const deleted = await prisma.aIStreamEventRecord.deleteMany({
        where: { id: { in: events.map((event: Record<string, unknown>) => String(event.id)) } },
      });
      deletedEvents += deleted.count;

      if (events.length < archiveBatchSize) break;
    }

    while (true) {
      const sessions = await prisma.aIStreamSession.findMany({
        where: oldSessionWhere,
        orderBy: { updated_at: 'asc' },
        take: archiveBatchSize,
      });
      if (sessions.length === 0) break;

      if (archiveEnabled) {
        await prisma.aIStreamSessionArchive.createMany({
          data: sessions.map((session: Record<string, unknown>) => ({
            archive_batch_key: archiveBatchKey,
            stream_id: session.stream_id,
            request_id: session.request_id,
            scope_type: session.scope_type,
            scope_id: session.scope_id,
            status: session.status,
            last_seq: session.last_seq,
            last_event_type: session.last_event_type,
            actor_role: session.actor_role,
            text: session.text,
            phase: session.phase,
            message_id: session.message_id,
            metadata: session.metadata,
            error: session.error,
            backend_mode: session.backend_mode,
            started_at: session.started_at,
            completed_at: session.completed_at,
            persisted_at: session.persisted_at,
            failed_at: session.failed_at,
            cancelled_at: session.cancelled_at,
            source_created_at: session.created_at,
            source_updated_at: session.updated_at,
          })),
          skipDuplicates: true,
        });
        archivedSessions += sessions.length;
      }

      const deleted = await prisma.aIStreamSession.deleteMany({
        where: { id: { in: sessions.map((session: Record<string, unknown>) => String(session.id)) } },
      });
      deletedSessions += deleted.count;

      if (sessions.length < archiveBatchSize) break;
    }

    return {
      archiveEnabled,
      archiveBatchSize,
      archiveBatchKey,
      dryRun,
      eventRetentionDays,
      sessionRetentionDays,
      archivedEvents,
      archivedSessions,
      deletedEvents,
      deletedSessions,
    };
  }
}

export const aiStreamService = new AIStreamService();
