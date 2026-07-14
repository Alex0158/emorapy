export interface EmailTransportMessage {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailTransportResult {
  accepted: string[];
  rejected: string[];
  messageId: string;
}

export interface EmailTransport {
  verify(): Promise<true>;
  sendMail(message: EmailTransportMessage): Promise<EmailTransportResult>;
}

type FetchLike = typeof fetch;

interface ResendErrorPayload {
  name?: unknown;
  message?: unknown;
}

function providerError(status: number, payload: ResendErrorPayload): Error {
  const error = new Error(
    typeof payload.message === 'string' ? payload.message : `Resend API request failed (${status})`
  ) as Error & { code?: string; rejected?: string[] };
  error.code = `RESEND_${status}`;
  if (status === 422) error.rejected = ['recipient'];
  return error;
}

export function createResendApiTransport(
  apiKey: string,
  baseUrl: string,
  timeoutMs: number,
  fetchImpl: FetchLike = fetch
): EmailTransport {
  return {
    // Resend has no non-mutating endpoint that is guaranteed to work with a
    // sending-only key. Config is validated here; the release canary proves
    // provider acceptance before the deployment is declared successful.
    async verify() {
      if (!apiKey || !baseUrl.startsWith('https://')) throw providerError(0, {});
      return true;
    },

    async sendMail(message) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/emails`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Emorapy/1.5.0',
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({})) as ResendErrorPayload & { id?: unknown };
        if (!response.ok) throw providerError(response.status, payload);
        if (typeof payload.id !== 'string' || !payload.id) throw providerError(response.status, payload);
        return {
          accepted: [message.to],
          rejected: [],
          messageId: payload.id,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw Object.assign(new Error('Resend API request timed out'), { code: 'TIMEOUT' });
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
