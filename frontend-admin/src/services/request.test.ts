import type { AxiosAdapter, AxiosResponse } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import request from './request';
import { adminApi } from './api/admin';
import { setLocale } from '@/utils/i18n';

const originalAdapter = request.defaults.adapter;

afterEach(() => {
  request.defaults.adapter = originalAdapter;
  setLocale('zh-TW');
});

describe('admin request locale header', () => {
  it('sends the selected Admin locale to the backend', async () => {
    setLocale('en-US');

    const seenLocales: unknown[] = [];
    request.defaults.adapter = (async (config) => {
      seenLocales.push(config.headers.get('X-Locale'));
      return {
        config,
        data: { success: true, data: { ok: true } },
        headers: {},
        status: 200,
        statusText: 'OK',
      } satisfies AxiosResponse;
    }) satisfies AxiosAdapter;

    await request.get('/admin/me');

    expect(seenLocales).toEqual(['en-US']);
  });

  it('localizes fallback request errors when the backend does not provide a message', async () => {
    setLocale('zh-TW');

    request.defaults.adapter = (async (config) => {
      return Promise.reject({
        config,
        response: { status: 404, data: { success: false } },
      });
    }) satisfies AxiosAdapter;

    await expect(request.get('/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: '找不到這項資料，可能已過期或被移除',
    });

    request.defaults.adapter = (async (config) => {
      return Promise.reject({ config, request: {} });
    }) satisfies AxiosAdapter;

    await expect(request.get('/network')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: '網路連線失敗，請檢查連線後再試',
    });

    request.defaults.adapter = (async (config) => {
      return Promise.reject({ config, code: 'ERR_CANCELED' });
    }) satisfies AxiosAdapter;

    await expect(request.get('/canceled')).rejects.toMatchObject({
      code: 'REQUEST_CANCELED',
      message: '請求已取消',
    });

    request.defaults.adapter = (async (config) => {
      return Promise.reject({ config });
    }) satisfies AxiosAdapter;

    await expect(request.get('/unknown')).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: '發生未知錯誤，請稍後再試',
    });

    setLocale('en-US');

    request.defaults.adapter = (async (config) => {
      return Promise.reject({
        config,
        response: { status: 429, data: { success: false } },
      });
    }) satisfies AxiosAdapter;

    await expect(request.get('/rate-limit')).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      message: 'Too many actions. Please try again later.',
    });
  });

  it('preserves backend-provided messages over Admin fallback messages', async () => {
    setLocale('en-US');

    request.defaults.adapter = (async (config) => {
      return Promise.reject({
        config,
        response: {
          status: 403,
          data: {
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access requires ops permission.' },
          },
        },
      });
    }) satisfies AxiosAdapter;

    await expect(request.get('/admin/ops/jobs')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Access requires ops permission.',
    });
  });

  it('localizes invalid Admin identity response fallbacks', async () => {
    setLocale('zh-TW');

    request.defaults.adapter = (async (config) => ({
      config,
      data: { success: true, data: { admin: {} } },
      headers: {},
      status: 200,
      statusText: 'OK',
    })) satisfies AxiosAdapter;

    await expect(adminApi.getMe()).rejects.toThrow('管理員身份回應格式異常，請稍後再試');

    setLocale('en-US');

    await expect(adminApi.getMe()).rejects.toThrow(
      'The admin identity response could not be read. Please try again later.'
    );
  });
});
