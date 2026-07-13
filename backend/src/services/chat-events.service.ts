import { Errors } from '../utils/errors';
import {
  ChatStreamEntitlementService,
  chatStreamEntitlementService,
} from './chat-stream-entitlement.service';

type ChatStreamEventType = 'message' | 'invite' | 'room_status' | 'system';

export type ChatStreamEvent = {
  type: ChatStreamEventType;
  roomId: string;
  channelId?: string;
  payload: Record<string, unknown>;
  at: string;
};

type Listener = (event: ChatStreamEvent) => void;

export class ChatEventsService {
  private roomListeners = new Map<string, Set<Listener>>();
  private channelListeners = new Map<string, Set<Listener>>();
  private readonly maxListenersPerRoom = 200;

  constructor(
    private readonly entitlementService: ChatStreamEntitlementService = chatStreamEntitlementService,
  ) {}

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

  subscribeForParticipant(
    roomId: string,
    participantId: string,
    listener: Listener,
    onEntitlementRevoked?: () => void,
  ): () => void {
    const unsubscribeRoom = this.subscribe(roomId, listener);
    const unregisterEntitlement = this.entitlementService.watchParticipant(
      participantId,
      () => {
        unsubscribeRoom();
        onEntitlementRevoked?.();
      },
    );
    return () => {
      unregisterEntitlement();
      unsubscribeRoom();
    };
  }

  getListenerCount(roomId: string): number {
    return this.roomListeners.get(roomId)?.size ?? 0;
  }

  subscribeChannel(channelId: string, listener: Listener): () => void {
    const listeners = this.channelListeners.get(channelId) ?? new Set<Listener>();
    if (!listeners.has(listener) && listeners.size >= this.maxListenersPerRoom) {
      throw Errors.RATE_LIMIT_EXCEEDED('對話空間即時連線已達上限，請稍後重試');
    }
    listeners.add(listener);
    this.channelListeners.set(channelId, listeners);

    return () => {
      const current = this.channelListeners.get(channelId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.channelListeners.delete(channelId);
    };
  }

  subscribeChannelForParticipant(
    channelId: string,
    participantId: string,
    listener: Listener,
    onEntitlementRevoked?: () => void,
  ): () => void {
    const unsubscribeChannel = this.subscribeChannel(channelId, listener);
    const unregisterEntitlement = this.entitlementService.watchParticipant(
      participantId,
      () => {
        unsubscribeChannel();
        onEntitlementRevoked?.();
      },
    );
    return () => {
      unregisterEntitlement();
      unsubscribeChannel();
    };
  }

  getChannelListenerCount(channelId: string): number {
    return this.channelListeners.get(channelId)?.size ?? 0;
  }

  publish(event: ChatStreamEvent): void {
    const listeners = this.roomListeners.get(event.roomId);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach((listener) => {
      listener(event);
    });
  }

  publishToChannel(event: ChatStreamEvent & { channelId: string }): void {
    const listeners = this.channelListeners.get(event.channelId);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach((listener) => listener(event));
  }
}

export const chatEventsService = new ChatEventsService();
