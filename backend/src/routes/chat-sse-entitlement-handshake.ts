import { Errors } from '../utils/errors';
import {
  ChatStreamEntitlementService,
  chatStreamEntitlementService,
} from '../services/chat-stream-entitlement.service';

type Cleanup = () => void;

export class ChatSseEntitlementHandshake<TEvent> {
  private bufferedEvents: TEvent[] = [];
  private subscriptionCleanup: Cleanup = () => undefined;
  private unregisterEntitlement: Cleanup = () => undefined;
  private deliveryQueue: Promise<void> = Promise.resolve();
  private closed = false;
  private ready = false;

  private constructor(
    private readonly participantId: string,
    private readonly deliver: (event: TEvent) => void,
    private readonly onRevoked: () => void,
    private readonly entitlementService: ChatStreamEntitlementService,
  ) {}

  static async prepare<TEvent>(input: {
    participantId: string;
    deliver: (event: TEvent) => void;
    onRevoked: () => void;
    entitlementService?: ChatStreamEntitlementService;
  }): Promise<ChatSseEntitlementHandshake<TEvent>> {
    const handshake = new ChatSseEntitlementHandshake(
      input.participantId,
      input.deliver,
      input.onRevoked,
      input.entitlementService ?? chatStreamEntitlementService,
    );
    handshake.unregisterEntitlement = handshake.entitlementService.watchParticipant(
      input.participantId,
      () => handshake.close(true),
    );
    if (
      handshake.closed
      || !await handshake.entitlementService.revalidateParticipantNow(input.participantId)
    ) {
      handshake.close(false);
      throw Errors.FORBIDDEN('聊天室參與者權限已失效');
    }
    return handshake;
  }

  bindSubscription(cleanup: Cleanup): void {
    if (this.closed) {
      cleanup();
      return;
    }
    this.subscriptionCleanup = cleanup;
  }

  push(event: TEvent): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (!this.ready) {
      this.bufferedEvents.push(event);
      return Promise.resolve();
    }
    return this.enqueueForDelivery(event);
  }

  async confirmBeforeHeaders(): Promise<void> {
    if (
      this.closed
      || !await this.entitlementService.revalidateParticipantNow(this.participantId)
      || this.closed
    ) {
      this.close(false);
      throw Errors.FORBIDDEN('聊天室參與者權限已失效');
    }
  }

  activateAndFlush(writeReady: () => void): Promise<void> {
    if (this.closed) {
      throw Errors.FORBIDDEN('聊天室參與者權限已失效');
    }
    this.ready = true;
    writeReady();
    const events = this.bufferedEvents;
    this.bufferedEvents = [];
    events.forEach(event => this.enqueueForDelivery(event));
    return this.deliveryQueue;
  }

  isClosed(): boolean {
    return this.closed;
  }

  dispose(): void {
    this.close(false);
  }

  /**
   * Every payload-bearing event is authorized against durable membership at
   * delivery time. A single serial queue preserves publish order and prevents
   * a later event from overtaking an entitlement check already in flight.
   */
  private enqueueForDelivery(event: TEvent): Promise<void> {
    this.deliveryQueue = this.deliveryQueue
      .then(async () => {
        if (this.closed) return;
        const isActive = await this.entitlementService.revalidateParticipantNow(
          this.participantId,
        );
        if (!isActive || this.closed) {
          this.close(false);
          return;
        }
        this.deliver(event);
      })
      .catch(() => {
        // Delivery and entitlement failures both fail closed. The durable
        // validator already converts database errors to false; this guard also
        // prevents response write failures from leaving a live subscription.
        this.close(false);
      });
    return this.deliveryQueue;
  }

  private close(notify: boolean): void {
    if (this.closed) return;
    this.closed = true;
    this.bufferedEvents = [];
    this.subscriptionCleanup();
    this.unregisterEntitlement();
    if (notify) this.onRevoked();
  }
}
