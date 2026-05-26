import { env } from '../config/env';

type PushFetch = typeof fetch;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  priority?: 'default' | 'normal' | 'high';
  data?: Record<string, unknown>;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: Record<string, unknown>;
}

export interface PushNotificationServiceOptions {
  endpoint?: string;
  receiptsEndpoint?: string;
  accessToken?: string | null;
  fetcher?: PushFetch;
}

const DEFAULT_EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_EXPO_PUSH_RECEIPTS_ENDPOINT = 'https://exp.host/--/api/v2/push/getReceipts';

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function normalizeTicket(input: unknown): ExpoPushTicket | null {
  const record = readRecord(input);
  const status = record.status === 'ok' || record.status === 'error' ? record.status : null;
  if (!status) return null;
  const details = readRecord(record.details);
  return {
    status,
    ...(typeof record.id === 'string' ? { id: record.id } : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
    ...(Object.keys(details).length ? { details } : {}),
  };
}

function normalizeTickets(body: unknown): ExpoPushTicket[] {
  const record = readRecord(body);
  const data = record.data;
  const rawTickets = Array.isArray(data) ? data : data ? [data] : [];
  return rawTickets
    .map((ticket) => normalizeTicket(ticket))
    .filter((ticket): ticket is ExpoPushTicket => !!ticket);
}

function normalizeReceipt(input: unknown): ExpoPushReceipt | null {
  const record = readRecord(input);
  const status = record.status === 'ok' || record.status === 'error' ? record.status : null;
  if (!status) return null;
  const details = readRecord(record.details);
  return {
    status,
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
    ...(Object.keys(details).length ? { details } : {}),
  };
}

function normalizeReceipts(body: unknown): Record<string, ExpoPushReceipt> {
  const record = readRecord(body);
  const data = readRecord(record.data);
  return Object.fromEntries(
    Object.entries(data)
      .map(([id, receipt]) => [id, normalizeReceipt(receipt)] as const)
      .filter((entry): entry is readonly [string, ExpoPushReceipt] => !!entry[1])
  );
}

export function redactPushTokens(input: string): string {
  return input.replace(/\b(?:Expo|Exponent)PushToken\[[^\]]+\]/g, '[push-token]');
}

export class PushNotificationService {
  private readonly endpoint: string;
  private readonly receiptsEndpoint: string;
  private readonly accessToken: string | null;
  private readonly fetcher: PushFetch;

  constructor(options: PushNotificationServiceOptions = {}) {
    this.endpoint = options.endpoint || env.EXPO_PUSH_ENDPOINT || DEFAULT_EXPO_PUSH_ENDPOINT;
    this.receiptsEndpoint = options.receiptsEndpoint
      || env.EXPO_PUSH_RECEIPTS_ENDPOINT
      || DEFAULT_EXPO_PUSH_RECEIPTS_ENDPOINT;
    this.accessToken = options.accessToken ?? env.EXPO_PUSH_ACCESS_TOKEN ?? null;
    this.fetcher = options.fetcher || fetch;
  }

  async sendMessages(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) return [];

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = text ? `: ${redactPushTokens(text).slice(0, 500)}` : '';
      throw new Error(`Expo push send failed: ${response.status} ${response.statusText}${detail}`);
    }

    const body = await response.json();
    const tickets = normalizeTickets(body);
    if (tickets.length === 0) {
      throw new Error('Expo push response did not include ticket data');
    }
    return tickets;
  }

  async getReceipts(ids: string[]): Promise<Record<string, ExpoPushReceipt>> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) return {};

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetcher(this.receiptsEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: uniqueIds }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = text ? `: ${redactPushTokens(text).slice(0, 500)}` : '';
      throw new Error(`Expo push receipt fetch failed: ${response.status} ${response.statusText}${detail}`);
    }

    return normalizeReceipts(await response.json());
  }
}

export const pushNotificationService = new PushNotificationService();
