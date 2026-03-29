import { Errors } from '../utils/errors';

type ChatStreamEventType = 'message' | 'invite' | 'room_status' | 'system' | 'ai_start' | 'ai_token' | 'ai_end';

export type ChatStreamEvent = {
  type: ChatStreamEventType;
  roomId: string;
  payload: Record<string, unknown>;
  at: string;
};

type Listener = (event: ChatStreamEvent) => void;

export class ChatEventsService {
  private roomListeners = new Map<string, Set<Listener>>();
  private readonly maxListenersPerRoom = 200;

  subscribe(roomId: string, listener: Listener): () => void {
    const listeners = this.roomListeners.get(roomId) ?? new Set<Listener>();
    if (!listeners.has(listener) && listeners.size >= this.maxListenersPerRoom) {
      throw Errors.RATE_LIMIT_EXCEEDED('聊天室即時連線已達上限，請稍後重試');
    }
    listeners.add(listener);
    this.roomListeners.set(roomId, listeners);

    return () => {
      const current = this.roomListeners.get(roomId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.roomListeners.delete(roomId);
      }
    };
  }

  getListenerCount(roomId: string): number {
    return this.roomListeners.get(roomId)?.size ?? 0;
  }

  publish(event: ChatStreamEvent): void {
    const listeners = this.roomListeners.get(event.roomId);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach((listener) => {
      listener(event);
    });
  }
}

export const chatEventsService = new ChatEventsService();
