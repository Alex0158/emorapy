import type { AxiosAdapter, AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from './request';
import { adminApi } from './api/admin';
import { setLocale } from '@/utils/i18n';

const originalAdapter = request.defaults.adapter;

afterEach(() => {
  request.defaults.adapter = originalAdapter;
  setLocale('zh-TW');
  vi.unstubAllGlobals();
});

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

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

  it('does not expose backend-provided messages over Admin fallback messages', async () => {
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
      message: 'You do not have permission to perform this action.',
    });
  });

  it('does not expose success=false envelope messages over Admin fallback messages', async () => {
    setLocale('en-US');

    request.defaults.adapter = (async (config) => ({
      config,
      data: {
        success: false,
        error: {
          code: 'ADMIN_CONFIG_INVALID',
          message: '設定格式錯誤',
          details: { field: 'rules' },
        },
      },
      headers: {},
      status: 200,
      statusText: 'OK',
    })) satisfies AxiosAdapter;

    await expect(request.get('/admin/configs')).rejects.toMatchObject({
      code: 'ADMIN_CONFIG_INVALID',
      message: 'Request failed. Please try again later.',
      details: { field: 'rules' },
    });
  });

  it('does not expose raw runtime messages for unknown Admin request errors', async () => {
    setLocale('en-US');

    request.defaults.adapter = (async () => {
      return Promise.reject(new Error('boom'));
    }) satisfies AxiosAdapter;

    await expect(request.get('/unknown-runtime')).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred. Please try again later.',
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

  it('clears an expired admin session on 401 but preserves login credential failures', async () => {
    const sessionStorage = createStorage({ admin_token: 'header.payload.signature' });
    const localStorage = createStorage({ admin_token: 'legacy.header.signature' });
    vi.stubGlobal('window', {
      sessionStorage,
      localStorage,
      dispatchEvent: vi.fn(),
    });

    request.defaults.adapter = (async (config) => Promise.reject({
      config,
      response: {
        status: 401,
        data: { success: false, error: { code: 'UNAUTHORIZED' } },
      },
    })) satisfies AxiosAdapter;

    await expect(request.get('/admin/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(sessionStorage.getItem('admin_token')).toBeNull();
    expect(localStorage.getItem('admin_token')).toBeNull();

    sessionStorage.setItem('admin_token', 'header.payload.signature');
    request.defaults.adapter = (async (config) => Promise.reject({
      config,
      response: {
        status: 401,
        data: { success: false, error: { code: 'INVALID_CREDENTIALS' } },
      },
    })) satisfies AxiosAdapter;

    await expect(request.post('/admin/login')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(sessionStorage.getItem('admin_token')).toBe('header.payload.signature');
  });
});
