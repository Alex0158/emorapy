import prisma from '../config/database';

type RevocationListener = () => void;
export type ParticipantEntitlementValidator = (participantId: string) => Promise<boolean>;

const DEFAULT_REVALIDATION_INTERVAL_MS = 15_000;

const validatePersistedParticipantEntitlement: ParticipantEntitlementValidator = async (
  participantId,
) => {
  const participant = await prisma.chatParticipant.findFirst({
    where: {
      id: participantId,
      participant_type: 'user',
      is_active: true,
      left_at: null,
    },
    select: { id: true },
  });
  return Boolean(participant);
};

/**
 * Tracks live chat connections by immutable participant identity. Membership
 * changes revoke every registered room/channel/AI stream for that participant.
 */
export class ChatStreamEntitlementService {
  private readonly listeners = new Map<string, Set<RevocationListener>>();
  private readonly revokedParticipants = new Set<string>();

  constructor(
    private readonly validateParticipant: ParticipantEntitlementValidator = validatePersistedParticipantEntitlement,
    private readonly revalidationIntervalMs = DEFAULT_REVALIDATION_INTERVAL_MS,
  ) {}

  register(participantId: string, listener: RevocationListener): () => void {
    if (this.revokedParticipants.has(participantId)) {
      listener();
      return () => undefined;
    }
    const listeners = this.listeners.get(participantId) ?? new Set<RevocationListener>();
    listeners.add(listener);
    this.listeners.set(participantId, listeners);

    return () => {
      const current = this.listeners.get(participantId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(participantId);
    };
  }

  /**
   * Uses the process-local registry for immediate teardown and periodically
   * revalidates idle connections. Payload-bearing events additionally perform
   * a durable delivery-time check in ChatSseEntitlementHandshake, so this timer
   * is not the security boundary for cross-instance revocation.
   */
  watchParticipant(participantId: string, listener: RevocationListener): () => void {
    let closed = false;
    let validationInFlight = false;
    let unregisterLocal: () => void = () => undefined;
    let timer: NodeJS.Timeout | undefined;

    const close = () => {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      unregisterLocal();
      listener();
    };

    unregisterLocal = this.register(participantId, close);
    if (closed) return () => undefined;

    timer = setInterval(() => {
      if (closed || validationInFlight) return;
      validationInFlight = true;
      void this.validateParticipant(participantId)
        .then((isActive) => {
          if (!isActive) close();
        })
        .catch(() => {
          // Access checks fail closed: a stream must not remain authorized when
          // its durable entitlement cannot be confirmed.
          close();
        })
        .finally(() => {
          validationInFlight = false;
        });
    }, this.revalidationIntervalMs);
    timer.unref?.();

    return () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      unregisterLocal();
    };
  }

  async revalidateParticipantNow(participantId: string): Promise<boolean> {
    try {
      const isActive = await this.validateParticipant(participantId);
      if (!isActive) this.revokeParticipant(participantId);
      return isActive;
    } catch {
      // A transient database failure must close every currently authorized
      // stream, but it must not poison future reconnects for the lifetime of
      // this process. A confirmed inactive participant remains sticky via
      // revokeParticipant until an explicit activation occurs.
      this.disconnectParticipant(participantId);
      return false;
    }
  }

  revokeParticipant(participantId: string): void {
    this.revokedParticipants.add(participantId);
    this.disconnectParticipant(participantId);
  }

  private disconnectParticipant(participantId: string): void {
    const listeners = this.listeners.get(participantId);
    if (!listeners) return;
    this.listeners.delete(participantId);
    for (const listener of [...listeners]) {
      listener();
    }
  }

  activateParticipant(participantId: string): void {
    this.revokedParticipants.delete(participantId);
  }

  getConnectionCount(participantId: string): number {
    return this.listeners.get(participantId)?.size ?? 0;
  }
}

export const chatStreamEntitlementService = new ChatStreamEntitlementService();
