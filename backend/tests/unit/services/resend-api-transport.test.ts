import { describe, expect, it, jest } from '@jest/globals';
import { createResendApiTransport } from '../../../src/services/resend-api-transport';

describe('createResendApiTransport', () => {
  it('sends through HTTPS and returns the provider id without exposing it', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ id: 'provider-message-id' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    const transport = createResendApiTransport('re_secret', 'https://api.resend.com', 1000, fetchMock);

    const result = await transport.sendMail({
      from: 'Emorapy <no-reply@emorapy.com>',
      to: 'person@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result).toEqual({
      accepted: ['person@example.com'],
      rejected: [],
      messageId: 'provider-message-id',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer re_secret' }),
    }));
  });

  it('maps provider validation failures to recipient rejection', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ name: 'validation_error', message: 'invalid recipient' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    ));
    const transport = createResendApiTransport('re_secret', 'https://api.resend.com', 1000, fetchMock);

    await expect(transport.sendMail({
      from: 'Emorapy <no-reply@emorapy.com>',
      to: 'invalid',
      subject: 'Test',
    })).rejects.toMatchObject({ code: 'RESEND_422', rejected: ['recipient'] });
  });
});
