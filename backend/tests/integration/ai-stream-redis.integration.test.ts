import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import Redis from 'ioredis';

const TEST_REDIS_URL = process.env.TEST_REDIS_URL || process.env.REDIS_URL || '';
const describeIfRedis = TEST_REDIS_URL ? describe : describe.skip;

type AIStreamServiceModule = typeof import('../../src/services/ai-stream.service');

async function waitFor<T>(
  getter: () => T | Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 8000,
  intervalMs = 100
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await getter();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor timeout after ${timeoutMs}ms`);
}

describeIfRedis('AI Stream Redis multi-instance integration', () => {
  let redis: Redis | null = null;
  let serviceModule: AIStreamServiceModule;
  let serviceA: InstanceType<AIStreamServiceModule['AIStreamService']>;
  let serviceB: InstanceType<AIStreamServiceModule['AIStreamService']>;
  let scopeId: string;

  beforeAll(async () => {
    if (!TEST_REDIS_URL) return;
    process.env.REDIS_URL = TEST_REDIS_URL;
    redis = new Redis(TEST_REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await redis.connect();

    jest.resetModules();
    serviceModule = await import('../../src/services/ai-stream.service');
    const { AIStreamService } = serviceModule;
    serviceA = new AIStreamService({
      enabled: true,
      persistToDatabase: false,
      replayTtlSeconds: 60,
      maxEventsPerScope: 50,
    });
    serviceB = new AIStreamService({
      enabled: true,
      persistToDatabase: false,
      replayTtlSeconds: 60,
      maxEventsPerScope: 50,
    });

    await waitFor(
      () => [serviceA.getBackendMode(), serviceB.getBackendMode()],
      (modes) => modes[0] === 'redis' && modes[1] === 'redis'
    );
  });

  afterAll(async () => {
    await Promise.allSettled([serviceA?.dispose(), serviceB?.dispose(), serviceModule?.aiStreamService?.dispose()]);
    if (redis) {
      if (scopeId) {
        const base = `ai-stream:scope:chat_room:${scopeId}`;
        await redis.del(`${base}:seq`, `${base}:events`, `${base}:snapshots`);
      }
      await redis.quit();
    }
  });

  it('應跨實例分發 stream.delta 並可從 Redis replay / snapshot 恢復', async () => {
    scopeId = `redis-integration-${Date.now()}`;
    const observedEventTypes: string[] = [];
    const observedDeltaTexts: string[] = [];

    const unsubscribe = await serviceB.subscribe(
      'chat_room',
      scopeId,
      (event) => {
        observedEventTypes.push(event.eventType);
        if (event.deltaText) {
          observedDeltaTexts.push(event.deltaText);
        }
      }
    );

    const handle = await serviceA.createStream('chat_room', scopeId, '11111111-1111-4111-8111-111111111111');
    await serviceA.start(handle, { actorRole: 'aiMediator' });
    await serviceA.delta(handle, 'hello ');
    await serviceA.delta(handle, 'redis');
    await serviceA.completed(handle, { fullText: 'hello redis' });

    await waitFor(
      () => observedEventTypes,
      (items) => items.includes('stream.delta') && items.includes('stream.completed')
    );
    expect(observedDeltaTexts.join('')).toBe('hello redis');

    const replayedEventTypes: string[] = [];
    const replayedUnsubscribe = await serviceB.subscribe(
      'chat_room',
      scopeId,
      (event) => {
        replayedEventTypes.push(event.eventType);
      },
      { afterSeq: 2 }
    );

    await waitFor(
      () => replayedEventTypes,
      (items) => items.includes('stream.delta') && items.includes('stream.completed')
    );

    const snapshots = await serviceB.getSnapshots('chat_room', scopeId);
    expect(snapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          streamId: handle.streamId,
          requestId: handle.requestId,
          scopeType: 'chat_room',
          scopeId,
          status: 'completed',
          text: 'hello redis',
        }),
      ])
    );

    replayedUnsubscribe();
    unsubscribe();
  });
});
