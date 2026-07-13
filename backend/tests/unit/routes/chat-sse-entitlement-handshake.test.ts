import { ChatSseEntitlementHandshake } from '../../../src/routes/chat-sse-entitlement-handshake';
import { ChatStreamEntitlementService } from '../../../src/services/chat-stream-entitlement.service';

describe('ChatSseEntitlementHandshake', () => {
  it.each(['room', 'channel'])('%s stream drops every buffered event when durable access is revoked during handshake', async scope => {
    const validate = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const entitlement = new ChatStreamEntitlementService(validate, 60_000);
    const delivered: Array<{ scope: string; secret: string }> = [];
    const onRevoked = jest.fn();
    const unsubscribe = jest.fn();
    const handshake = await ChatSseEntitlementHandshake.prepare<{
      scope: string;
      secret: string;
    }>({
      participantId: 'participant-b',
      entitlementService: entitlement,
      deliver: event => delivered.push(event),
      onRevoked,
    });
    handshake.bindSubscription(unsubscribe);
    handshake.push({ scope, secret: 'must-not-cross-revocation' });

    await expect(handshake.confirmBeforeHeaders()).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(delivered).toEqual([]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it('flushes buffered events only after both entitlement confirmations', async () => {
    const validate = jest.fn().mockResolvedValue(true);
    const entitlement = new ChatStreamEntitlementService(validate, 60_000);
    const delivered: string[] = [];
    const handshake = await ChatSseEntitlementHandshake.prepare<string>({
      participantId: 'participant-a',
      entitlementService: entitlement,
      deliver: event => delivered.push(event),
      onRevoked: jest.fn(),
    });
    handshake.push('buffered');
    expect(delivered).toEqual([]);

    await handshake.confirmBeforeHeaders();
    expect(delivered).toEqual([]);
    await handshake.activateAndFlush(() => delivered.push('ready'));

    expect(validate).toHaveBeenCalledTimes(3);
    expect(delivered).toEqual(['ready', 'buffered']);
    handshake.dispose();
  });

  it('writes neither ready nor buffered data when locally revoked before activation', async () => {
    const validate = jest.fn().mockResolvedValue(true);
    const entitlement = new ChatStreamEntitlementService(validate, 60_000);
    const writes: string[] = [];
    const handshake = await ChatSseEntitlementHandshake.prepare<string>({
      participantId: 'participant-b',
      entitlementService: entitlement,
      deliver: event => writes.push(event),
      onRevoked: jest.fn(),
    });
    handshake.push('buffered');
    await handshake.confirmBeforeHeaders();
    entitlement.revokeParticipant('participant-b');

    expect(() => handshake.activateAndFlush(() => writes.push('ready'))).toThrow();
    expect(writes).toEqual([]);
  });

  it.each(['room', 'channel'])(
    '%s active stream drops the next event after cross-instance durable revocation',
    async scope => {
      const validate = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      const entitlement = new ChatStreamEntitlementService(validate, 60_000);
      const delivered: Array<{ scope: string; secret: string }> = [];
      const onRevoked = jest.fn();
      const unsubscribe = jest.fn();
      const handshake = await ChatSseEntitlementHandshake.prepare<{
        scope: string;
        secret: string;
      }>({
        participantId: 'participant-b',
        entitlementService: entitlement,
        deliver: event => delivered.push(event),
        onRevoked,
      });
      handshake.bindSubscription(unsubscribe);
      await handshake.confirmBeforeHeaders();
      await handshake.activateAndFlush(() => undefined);

      await handshake.push({ scope, secret: 'must-not-cross-revocation' });

      expect(delivered).toEqual([]);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(onRevoked).toHaveBeenCalledTimes(1);
      expect(handshake.isClosed()).toBe(true);
    },
  );

  it('serializes delivery-time entitlement checks and preserves event order', async () => {
    const validate = jest.fn().mockResolvedValue(true);
    const entitlement = new ChatStreamEntitlementService(validate, 60_000);
    const delivered: string[] = [];
    const handshake = await ChatSseEntitlementHandshake.prepare<string>({
      participantId: 'participant-a',
      entitlementService: entitlement,
      deliver: event => delivered.push(event),
      onRevoked: jest.fn(),
    });
    await handshake.confirmBeforeHeaders();
    await handshake.activateAndFlush(() => undefined);

    const first = handshake.push('first');
    const second = handshake.push('second');
    await Promise.all([first, second]);

    expect(delivered).toEqual(['first', 'second']);
    expect(validate).toHaveBeenCalledTimes(4);
    handshake.dispose();
  });
});
