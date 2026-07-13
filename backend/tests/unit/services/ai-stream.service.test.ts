import { describe, expect, it, jest } from '@jest/globals';
import { AIStreamService } from '../../../src/services/ai-stream.service';
import type { AIStreamEvent } from '../../../src/types/ai-stream';

describe('AIStreamService', () => {
  it('roleB replay cutoff excludes every event and snapshot from streams created before join', async () => {
    jest.useFakeTimers();
    try {
      const service = new AIStreamService({ enabled: false });
      jest.setSystemTime(new Date('2026-07-12T19:00:00.000Z'));
      const prejoin = await service.createStream(
        'chat_room',
        'room-cutoff',
        '11111111-1111-4111-8111-111111111111',
      );
      await service.persisted(prejoin, { fullText: 'PREJOIN_SECRET' });

      jest.setSystemTime(new Date('2026-07-12T21:00:00.000Z'));
      const postjoin = await service.createStream(
        'chat_room',
        'room-cutoff',
        '22222222-2222-4222-8222-222222222222',
      );
      await service.persisted(postjoin, { fullText: 'postjoin safe' });

      const received: AIStreamEvent[] = [];
      const unsubscribe = await service.subscribe(
        'chat_room',
        'room-cutoff',
        event => received.push(event),
        { notBefore: new Date('2026-07-12T20:00:00.000Z') },
      );
      const snapshots = await service.getSnapshots('chat_room', 'room-cutoff', {
        notBefore: new Date('2026-07-12T20:00:00.000Z'),
      });
      unsubscribe();

      expect(new Set(received.map(event => event.streamId))).toEqual(new Set([postjoin.streamId]));
      expect(snapshots.map(snapshot => snapshot.streamId)).toEqual([postjoin.streamId]);
      expect(JSON.stringify({ received, snapshots })).not.toContain('PREJOIN_SECRET');
    } finally {
      jest.useRealTimers();
    }
  });

  it('應建立事件序列並更新快照文本與狀態', async () => {
    const service = new AIStreamService({ enabled: false });
    const handle = await service.createStream('chat_room', 'room-1', '11111111-1111-4111-8111-111111111111');

    await service.start(handle, { actorRole: 'aiMediator', phase: 'thinking' });
    await service.delta(handle, 'Hello');
    await service.delta(handle, ' world');
    await service.completed(handle, { fullText: 'Hello world', phase: 'completed' });
    await service.persisted(handle, { messageId: 'msg-1', fullText: 'Hello world', phase: 'completed' });

    const snapshots = await service.getSnapshots('chat_room', 'room-1');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      streamId: handle.streamId,
      requestId: '11111111-1111-4111-8111-111111111111',
      status: 'persisted',
      text: 'Hello world',
      phase: 'completed',
      messageId: 'msg-1',
    });
    expect(snapshots[0].lastSeq).toBe(7);
  });

  it('訂閱時應按 afterSeq 補發後續事件，並持續接收新事件', async () => {
    const service = new AIStreamService({ enabled: false });
    const handle = await service.createStream('case_judgment', 'case-1', '22222222-2222-4222-8222-222222222222');

    await service.start(handle, { phase: 'collecting_context' });
    await service.phase(handle, 'analyzing_emotion');

    const received = [] as string[];
    const unsubscribe = await service.subscribe(
      'case_judgment',
      'case-1',
      (event) => received.push(event.eventType),
      { afterSeq: 2 }
    );

    expect(received).toEqual(['stream.started', 'stream.phase']);

    await service.completed(handle, { fullText: 'done', phase: 'completed' });
    unsubscribe();

    expect(received).toEqual(['stream.started', 'stream.phase', 'stream.completed']);
  });

  it('訂閱建立期間即使 replay 仍在等待，也不應錯過快速完成的 live 事件', async () => {
    const service = new AIStreamService({ enabled: false, persistToDatabase: false });
    let releaseReplay: (events: unknown[]) => void = () => undefined;
    (service as any).readEventsFromRedis = jest.fn(() => new Promise((resolve) => {
      releaseReplay = resolve;
    }));

    const received: string[] = [];
    const subscribePromise = service.subscribe(
      'repair_track',
      'track-race',
      (event) => received.push(event.eventType)
    );

    await Promise.resolve();
    const handle = await service.createStream('repair_track', 'track-race', '66666666-6666-4666-8666-666666666666');
    await service.start(handle, { actorRole: 'aiMediator' });
    await service.persisted(handle, { messageId: 'plan-1' });

    expect(received).toEqual(['stream.created', 'stream.queued', 'stream.started', 'stream.persisted']);

    releaseReplay([]);
    const unsubscribe = await subscribePromise;
    unsubscribe();
  });

  it('失敗事件應將錯誤信息保留到快照', async () => {
    const service = new AIStreamService({ enabled: false });
    const handle = await service.createStream('interview_session', 'session-1', '33333333-3333-4333-8333-333333333333');

    await service.failed(handle, {
      code: 'AI_STREAM_FAILED',
      message: 'upstream disconnected',
      retryable: true,
    });

    const [snapshot] = await service.getSnapshots('interview_session', 'session-1');
    expect(snapshot.status).toBe('failed');
    expect(snapshot.error).toEqual({
      code: 'AI_STREAM_FAILED',
      message: 'upstream disconnected',
      retryable: true,
    });
  });

  it('scope heartbeat 應發送標準 stream.heartbeat 並保留既有 streaming 狀態', async () => {
    const service = new AIStreamService({ enabled: false });
    const handle = await service.createStream('chat_room', 'room-heartbeat', '44444444-4444-4444-8444-444444444444');

    await service.start(handle, { actorRole: 'aiMediator' });
    await service.delta(handle, 'Hello');

    const heartbeat = await service.emitScopeHeartbeat('chat_room', 'room-heartbeat');

    expect(heartbeat).not.toBeNull();
    expect(heartbeat?.eventType).toBe('stream.heartbeat');

    const [snapshot] = await service.getSnapshots('chat_room', 'room-heartbeat');
    expect(snapshot.status).toBe('streaming');
    expect(snapshot.text).toBe('Hello');
    expect(snapshot.lastSeq).toBe(5);
  });

  it('scope 無活動 stream 時不應發送 heartbeat', async () => {
    const service = new AIStreamService({ enabled: false });
    const handle = await service.createStream('chat_room', 'room-terminal', '55555555-5555-4555-8555-555555555555');

    await service.completed(handle, { fullText: 'done' });
    await service.persisted(handle, { fullText: 'done', messageId: 'msg-1' });

    await expect(service.emitScopeHeartbeat('chat_room', 'room-terminal')).resolves.toBeNull();
  });
});
