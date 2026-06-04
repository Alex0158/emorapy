import type { AxiosAdapter, AxiosResponse } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import request from './request';
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
});
