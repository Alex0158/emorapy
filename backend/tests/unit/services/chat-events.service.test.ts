import { describe, expect, it } from '@jest/globals';
import { ChatEventsService } from '../../../src/services/chat-events.service';

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
});
