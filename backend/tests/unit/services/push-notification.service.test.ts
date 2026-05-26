import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../../src/config/env', () => ({
  __esModule: true,
  env: {
    EXPO_PUSH_ENDPOINT: 'https://exp.test/push/send',
    EXPO_PUSH_RECEIPTS_ENDPOINT: 'https://exp.test/push/getReceipts',
    EXPO_PUSH_ACCESS_TOKEN: 'test-access-token',
  },
}));

import { PushNotificationService, redactPushTokens } from '../../../src/services/push-notification.service';

describe('PushNotificationService', () => {
  it('sendMessages 應呼叫 Expo push endpoint 並回傳 ticket', async () => {
    const fetcher = jest.fn();
    (fetcher as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
      text: async () => '',
    } as Response);
    const service = new PushNotificationService({ fetcher: fetcher as typeof fetch });

    const tickets = await service.sendMessages([
      {
        to: 'ExpoPushToken[test]',
        title: '提醒',
        body: '回來看看',
        data: { path: '/notifications' },
      },
    ]);

    expect(tickets).toEqual([{ status: 'ok', id: 'ticket-1' }]);
    expect(fetcher).toHaveBeenCalledWith('https://exp.test/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify([
        {
          to: 'ExpoPushToken[test]',
          title: '提醒',
          body: '回來看看',
          data: { path: '/notifications' },
        },
      ]),
    });
  });

  it('sendMessages 對 provider 非 2xx 錯誤應清洗 push token', async () => {
    const fetcher = jest.fn();
    (fetcher as any).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({}),
      text: async () => 'invalid ExpoPushToken[secret]',
    } as Response);
    const service = new PushNotificationService({
      endpoint: 'https://exp.test/custom',
      accessToken: null,
      fetcher: fetcher as typeof fetch,
    });

    await expect(service.sendMessages([
      { to: 'ExpoPushToken[secret]', title: 'T', body: 'B' },
    ])).rejects.toThrow('invalid [push-token]');
  });

  it('sendMessages 沒有 ticket data 時應拒絕', async () => {
    const fetcher = jest.fn();
    (fetcher as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [] }),
      text: async () => '',
    } as Response);
    const service = new PushNotificationService({ fetcher: fetcher as typeof fetch });

    await expect(service.sendMessages([
      { to: 'ExpoPushToken[test]', title: 'T', body: 'B' },
    ])).rejects.toThrow('ticket data');
  });

  it('redactPushTokens 應支援 Expo 與 Exponent token 格式', () => {
    expect(redactPushTokens('ExpoPushToken[a] ExponentPushToken[b]')).toBe('[push-token] [push-token]');
  });

  it('getReceipts 應呼叫 Expo receipts endpoint 並正規化 receipt map', async () => {
    const fetcher = jest.fn();
    (fetcher as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: {
          'ticket-1': { status: 'ok' },
          'ticket-2': { status: 'error', message: 'Device not registered', details: { error: 'DeviceNotRegistered' } },
        },
      }),
      text: async () => '',
    } as Response);
    const service = new PushNotificationService({ fetcher: fetcher as typeof fetch });

    const receipts = await service.getReceipts(['ticket-1', 'ticket-2', 'ticket-1']);

    expect(receipts).toEqual({
      'ticket-1': { status: 'ok' },
      'ticket-2': {
        status: 'error',
        message: 'Device not registered',
        details: { error: 'DeviceNotRegistered' },
      },
    });
    expect(fetcher).toHaveBeenCalledWith('https://exp.test/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({ ids: ['ticket-1', 'ticket-2'] }),
    });
  });

  it('getReceipts 對 provider 非 2xx 錯誤應清洗 push token', async () => {
    const fetcher = jest.fn();
    (fetcher as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
      text: async () => 'failed for ExpoPushToken[secret]',
    } as Response);
    const service = new PushNotificationService({ fetcher: fetcher as typeof fetch });

    await expect(service.getReceipts(['ticket-1'])).rejects.toThrow('failed for [push-token]');
  });
});
