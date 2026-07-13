import { describe, expect, it, jest } from '@jest/globals';
import { ChatEventsService } from '../../../src/services/chat-events.service';
import { ChatStreamEntitlementService } from '../../../src/services/chat-stream-entitlement.service';

describe('ChatEventsService', () => {
  it('應能訂閱、發布與取消訂閱', () => {
    const service = new ChatEventsService();
    const received: string[] = [];

    const unsub = service.subscribe('room-1', (event) => {
      received.push(String(event.payload.value));
    });

    service.publish({
      type: 'message',
      roomId: 'room-1',
      payload: { value: 'a' },
      at: new Date().toISOString(),
    });
    expect(received).toEqual(['a']);
    expect(service.getListenerCount('room-1')).toBe(1);

    unsub();
    expect(service.getListenerCount('room-1')).toBe(0);

    service.publish({
      type: 'message',
      roomId: 'room-1',
      payload: { value: 'b' },
      at: new Date().toISOString(),
    });
    expect(received).toEqual(['a']);
  });

  it('同一房間超過連線上限時應拒絕新訂閱', () => {
    const service = new ChatEventsService();

    for (let i = 0; i < 200; i++) {
      service.subscribe('room-2', () => undefined);
    }
    expect(service.getListenerCount('room-2')).toBe(200);

    expect(() => {
      service.subscribe('room-2', () => undefined);
    }).toThrow('聊天室即時連線已達上限');
  });

  it('不同房間 listener 計數應互不影響', () => {
    const service = new ChatEventsService();
    service.subscribe('room-a', () => undefined);
    service.subscribe('room-b', () => undefined);
    service.subscribe('room-b', () => undefined);

    expect(service.getListenerCount('room-a')).toBe(1);
    expect(service.getListenerCount('room-b')).toBe(2);
  });

  it('單一 listener 失敗不應令已完成的 mutation 回報失敗或阻斷其他 listener', async () => {
    const service = new ChatEventsService();
    const received: string[] = [];
    service.subscribe('room-a', () => {
      throw new Error('listener failed');
    });
    service.subscribe('room-a', async () => {
      throw new Error('listener rejected');
    });
    service.subscribe('room-a', (event) => {
      received.push(String(event.payload.value));
    });

    expect(() => service.publish({
      type: 'message',
      roomId: 'room-a',
      payload: { value: 'delivered' },
      at: new Date().toISOString(),
    })).not.toThrow();
    await Promise.resolve();

    expect(received).toEqual(['delivered']);
  });

  it('open stream 在 participant leave/revoke 後不再收到新 room/channel activity', () => {
    const entitlements = new ChatStreamEntitlementService();
    const service = new ChatEventsService(entitlements);
    const roomEvents: string[] = [];
    const privateEvents: string[] = [];
    service.subscribeForParticipant('room-1', 'participant-b1', event => {
      roomEvents.push(String(event.payload.value));
    });
    service.subscribeChannelForParticipant('private-b1', 'participant-b1', event => {
      privateEvents.push(String(event.payload.value));
    });

    service.publish({
      type: 'message',
      roomId: 'room-1',
      payload: { value: 'before-leave' },
      at: new Date().toISOString(),
    });
    service.publishToChannel({
      type: 'message',
      roomId: 'room-1',
      channelId: 'private-b1',
      payload: { value: 'before-leave' },
      at: new Date().toISOString(),
    });

    entitlements.revokeParticipant('participant-b1');

    service.publish({
      type: 'message',
      roomId: 'room-1',
      payload: { value: 'after-leave' },
      at: new Date().toISOString(),
    });
    service.publishToChannel({
      type: 'message',
      roomId: 'room-1',
      channelId: 'private-b1',
      payload: { value: 'after-leave' },
      at: new Date().toISOString(),
    });

    expect(roomEvents).toEqual(['before-leave']);
    expect(privateEvents).toEqual(['before-leave']);
    expect(service.getListenerCount('room-1')).toBe(0);
    expect(service.getChannelListenerCount('private-b1')).toBe(0);
  });

  it('leave 與 stream registration 競態時應立即拒絕 late registration', () => {
    const entitlements = new ChatStreamEntitlementService();
    const service = new ChatEventsService(entitlements);
    const received: string[] = [];
    entitlements.revokeParticipant('participant-b1');

    service.subscribeForParticipant('room-1', 'participant-b1', event => {
      received.push(String(event.payload.value));
    });
    service.publish({
      type: 'message',
      roomId: 'room-1',
      payload: { value: 'after-leave' },
      at: new Date().toISOString(),
    });

    expect(received).toEqual([]);
    expect(service.getListenerCount('room-1')).toBe(0);
  });

  it('ongoing stream 應以 durable participant 狀態定期重驗並在失效後斷線', async () => {
    jest.useFakeTimers();
    try {
      let isActive = true;
      const validateParticipant = jest.fn(async (_participantId: string) => isActive);
      const entitlements = new ChatStreamEntitlementService(validateParticipant, 1_000);
      const service = new ChatEventsService(entitlements);
      const received: string[] = [];
      const disconnected = jest.fn();
      service.subscribeForParticipant('room-1', 'participant-b1', event => {
        received.push(String(event.payload.value));
      }, disconnected);

      service.publish({
        type: 'message',
        roomId: 'room-1',
        payload: { value: 'before-db-revoke' },
        at: new Date().toISOString(),
      });
      isActive = false;
      await jest.advanceTimersByTimeAsync(1_000);
      service.publish({
        type: 'message',
        roomId: 'room-1',
        payload: { value: 'after-db-revoke' },
        at: new Date().toISOString(),
      });

      expect(validateParticipant).toHaveBeenCalledWith('participant-b1');
      expect(disconnected).toHaveBeenCalledTimes(1);
      expect(received).toEqual(['before-db-revoke']);
      expect(service.getListenerCount('room-1')).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('replay 前的即時 durable revalidation 失敗應同步撤銷所有 watcher', async () => {
    const validateParticipant = jest.fn(async () => false);
    const entitlements = new ChatStreamEntitlementService(validateParticipant);
    const disconnected = jest.fn();
    entitlements.watchParticipant('participant-b2', disconnected);

    await expect(entitlements.revalidateParticipantNow('participant-b2')).resolves.toBe(false);

    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(entitlements.getConnectionCount('participant-b2')).toBe(0);
    const lateRegistration = jest.fn();
    entitlements.watchParticipant('participant-b2', lateRegistration);
    expect(lateRegistration).toHaveBeenCalledTimes(1);
  });

  it('transient durable validation error 應關閉當前 watcher，但不永久毒化後續連線', async () => {
    const validateParticipant = jest.fn<(_participantId: string) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error('database timeout'))
      .mockResolvedValueOnce(true);
    const entitlements = new ChatStreamEntitlementService(validateParticipant);
    const firstDisconnected = jest.fn();
    entitlements.watchParticipant('participant-b2', firstDisconnected);

    await expect(entitlements.revalidateParticipantNow('participant-b2')).resolves.toBe(false);

    expect(firstDisconnected).toHaveBeenCalledTimes(1);
    expect(entitlements.getConnectionCount('participant-b2')).toBe(0);

    const secondDisconnected = jest.fn();
    const stopSecond = entitlements.watchParticipant('participant-b2', secondDisconnected);
    expect(secondDisconnected).not.toHaveBeenCalled();
    await expect(entitlements.revalidateParticipantNow('participant-b2')).resolves.toBe(true);
    expect(entitlements.getConnectionCount('participant-b2')).toBe(1);
    stopSecond();
  });
});
