// @ts-nocheck
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUpsert = jest.fn();
const mockCreate = jest.fn();
const mockSessionFindMany = jest.fn();
const mockEventFindMany = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    aIStreamSession: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findMany: (...args: unknown[]) => mockSessionFindMany(...args),
    },
    aIStreamEventRecord: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
    },
  },
}));

describe('AIStreamService persistence', () => {
  beforeEach(() => {
    jest.resetModules();
    mockUpsert.mockReset();
    mockCreate.mockReset();
    mockUpsert.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockSessionFindMany.mockReset().mockResolvedValue([]);
    mockEventFindMany.mockReset().mockResolvedValue([]);
  });

  it('應持久化 ai_stream_sessions 與非 heartbeat 事件', async () => {
    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: true });

    const handle = await service.createStream('chat_room', 'room-persist', '66666666-6666-4666-8666-666666666666');
    await service.start(handle, { actorRole: 'aiMediator', phase: 'thinking' });
    await service.delta(handle, 'Hello');
    await service.completed(handle, { fullText: 'Hello', phase: 'completed' });
    await service.persisted(handle, { fullText: 'Hello', messageId: 'msg-1', phase: 'completed' });

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();

    const lastUpsertArg = mockUpsert.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(lastUpsertArg.where).toEqual({ stream_id: handle.streamId });
    expect(lastUpsertArg.update).toEqual(expect.objectContaining({
      request_id: handle.requestId,
      scope_type: 'chat_room',
      scope_id: 'room-persist',
      status: 'persisted',
      message_id: 'msg-1',
    }));

    const persistedEventArg = mockCreate.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(persistedEventArg.data).toEqual(expect.objectContaining({
      stream_id: handle.streamId,
      request_id: handle.requestId,
      scope_type: 'chat_room',
      scope_id: 'room-persist',
      event_type: 'stream.persisted',
      message_id: 'msg-1',
      full_text: 'Hello',
    }));
  });

  it('heartbeat 應只更新 session，不寫入 ai_stream_events', async () => {
    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: true });

    const handle = await service.createStream('chat_room', 'room-heartbeat-db', '77777777-7777-4777-8777-777777777777');
    await service.start(handle, { actorRole: 'aiMediator' });
    await service.heartbeat(handle);

    const heartbeatEventCalls = mockCreate.mock.calls.filter(
      (call) => (call[0] as Record<string, any>).data.event_type === 'stream.heartbeat'
    );

    expect(mockUpsert).toHaveBeenCalled();
    expect(heartbeatEventCalls).toHaveLength(0);
  });

  it('subscribe 應能在 memory/Redis 空白時從 live DB events 做 after_seq replay', async () => {
    mockEventFindMany.mockResolvedValueOnce([
      {
        stream_id: 'stream-db-1',
        request_id: 'request-db-1',
        scope_type: 'repair_track',
        scope_id: 'track-db',
        seq: 7,
        event_type: 'stream.completed',
        actor_role: 'aiMediator',
        message_id: null,
        delta_text: null,
        full_text: 'done',
        phase: 'completed',
        metadata: null,
        error: null,
        created_at: new Date('2026-05-08T06:00:00.000Z'),
      },
      {
        stream_id: 'stream-db-1',
        request_id: 'request-db-1',
        scope_type: 'repair_track',
        scope_id: 'track-db',
        seq: 8,
        event_type: 'stream.persisted',
        actor_role: 'aiMediator',
        message_id: 'plan-db-1',
        delta_text: null,
        full_text: null,
        phase: null,
        metadata: { plan_id: 'plan-db-1' },
        error: null,
        created_at: new Date('2026-05-08T06:00:01.000Z'),
      },
    ]);

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: true });
    const received: string[] = [];

    const unsubscribe = await service.subscribe(
      'repair_track',
      'track-db',
      (event) => received.push(event.eventType),
      { afterSeq: 7 }
    );
    unsubscribe();

    expect(mockEventFindMany).toHaveBeenCalledWith({
      where: {
        scope_type: 'repair_track',
        scope_id: 'track-db',
        seq: { gt: 7 },
      },
      orderBy: { seq: 'asc' },
      take: 400,
    });
    expect(received).toEqual(['stream.persisted']);
  });

  it('getSnapshots 應能在 memory/Redis 空白時從 live DB session 恢復 terminal snapshot', async () => {
    mockSessionFindMany.mockResolvedValueOnce([
      {
        stream_id: 'stream-db-2',
        request_id: 'request-db-2',
        scope_type: 'repair_track',
        scope_id: 'track-db-2',
        status: 'persisted',
        last_seq: 8,
        last_event_type: 'stream.persisted',
        actor_role: 'aiMediator',
        text: 'done',
        phase: 'completed',
        message_id: 'plan-db-2',
        metadata: { plan_id: 'plan-db-2' },
        error: null,
        backend_mode: 'memory',
        created_at: new Date('2026-05-08T06:00:00.000Z'),
        updated_at: new Date('2026-05-08T06:00:01.000Z'),
      },
    ]);

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: true });

    const snapshots = await service.getSnapshots('repair_track', 'track-db-2');

    expect(mockSessionFindMany).toHaveBeenCalledWith({
      where: {
        scope_type: 'repair_track',
        scope_id: 'track-db-2',
      },
      orderBy: { updated_at: 'desc' },
      take: 400,
    });
    expect(snapshots).toEqual([
      expect.objectContaining({
        streamId: 'stream-db-2',
        requestId: 'request-db-2',
        scopeType: 'repair_track',
        scopeId: 'track-db-2',
        status: 'persisted',
        lastSeq: 8,
        text: 'done',
        messageId: 'plan-db-2',
      }),
    ]);
  });
});
