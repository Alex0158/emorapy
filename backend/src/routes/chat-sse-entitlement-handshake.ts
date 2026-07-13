import { Errors } from '../utils/errors';
import {
  ChatStreamEntitlementService,
  chatStreamEntitlementService,
} from '../services/chat-stream-entitlement.service';

type Cleanup = () => void;
type DurableScopeValidator = (participantId: string) => Promise<boolean>;

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
    private readonly validateDurableScope?: DurableScopeValidator,
  ) {}

  static async prepare<TEvent>(input: {
    participantId: string;
    deliver: (event: TEvent) => void;
    onRevoked: () => void;
    entitlementService?: ChatStreamEntitlementService;
    validateDurableScope?: DurableScopeValidator;
    signal?: AbortSignal;
  }): Promise<ChatSseEntitlementHandshake<TEvent>> {
    const handshake = new ChatSseEntitlementHandshake(
      input.participantId,
      input.deliver,
      input.onRevoked,
      input.entitlementService ?? chatStreamEntitlementService,
      input.validateDurableScope,
    );
    if (input.signal?.aborted) {
      handshake.close(false);
      throw Errors.FORBIDDEN('聊天室參與者權限已失效');
    }
    const handleAbort = () => handshake.close(false);
    input.signal?.addEventListener('abort', handleAbort, { once: true });
    try {
      handshake.unregisterEntitlement = handshake.entitlementService.watchParticipant(
        input.participantId,
        () => handshake.close(true),
      );
      if (
        handshake.closed
        || !await handshake.revalidateDurableAccess()
        || handshake.closed
      ) {
        handshake.close(false);
        throw Errors.FORBIDDEN('聊天室參與者權限已失效');
      }
      return handshake;
    } finally {
      input.signal?.removeEventListener('abort', handleAbort);
    }
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
      || !await this.revalidateDurableAccess()
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

  /**
   * Activates a stream whose initial payload is sensitive (for example an AI
   * stream ready event containing snapshots). Buffered events already
   * represented by that initial payload are delivered first so existing
   * reducers can let the snapshot establish canonical state. Events newer than
   * the snapshot are delivered afterwards. Every item still receives its own
   * durable delivery-time check.
   */
  activateWithInitialAndFlush(
    initialEvent: TEvent,
    isRepresentedByInitial: (event: TEvent) => boolean = () => false,
  ): Promise<void> {
    if (this.closed) {
      throw Errors.FORBIDDEN('聊天室參與者權限已失效');
    }
    this.ready = true;
    const events = this.bufferedEvents;
    this.bufferedEvents = [];
    events
      .filter(isRepresentedByInitial)
      .forEach(event => this.enqueueForDelivery(event));
    this.enqueueForDelivery(initialEvent);
    events
      .filter(event => !isRepresentedByInitial(event))
      .forEach(event => this.enqueueForDelivery(event));
    return this.deliveryQueue;
  }

  isClosed(): boolean {
    return this.closed;
  }

  dispose(): void {
    this.close(false);
  }

  /**
   * Every payload-bearing event is authorized against durable membership and
   * its exact scope at delivery time. A single serial queue preserves publish
   * order and prevents a later event from overtaking an in-flight check.
   */
  private enqueueForDelivery(event: TEvent): Promise<void> {
    this.deliveryQueue = this.deliveryQueue
      .then(async () => {
        if (this.closed) return;
        const isActive = await this.revalidateDurableAccess();
        if (!isActive || this.closed) {
          this.close(true);
          return;
        }
        this.deliver(event);
      })
      .catch(() => {
        // Delivery and entitlement failures both fail closed. The durable
        // validator already converts database errors to false; this guard also
        // prevents response write failures from leaving a live subscription.
        this.close(true);
      });
    return this.deliveryQueue;
  }

  private async revalidateDurableAccess(): Promise<boolean> {
    try {
      if (!await this.entitlementService.revalidateParticipantNow(this.participantId)) {
        return false;
      }
      if (!this.validateDurableScope) return true;
      return await this.validateDurableScope(this.participantId);
    } catch {
      return false;
    }
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
