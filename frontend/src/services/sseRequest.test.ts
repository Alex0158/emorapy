/**
 * sseRequest 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sseRequest, SSEError } from './sseRequest';

vi.mock('@/config/env', () => ({
  env: { apiBaseURL: 'https://api.test' },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
  getLocale: () => 'zh-TW',
}));

function makeReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

describe('sseRequest', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    localStorage.setItem('token', 'test-token');
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it('應發送 POST 請求帶 Authorization 和 X-Locale', async () => {
    const body = makeReadableStream(['event: complete\ndata: {}\n\n']);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body, status: 200 });
    const callbacks = { onComplete: vi.fn() };
    await sseRequest('/test', { msg: 'hi' }, callbacks);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Locale': 'zh-TW',
        }),
        body: JSON.stringify({ msg: 'hi' }),
      })
    );
  });

  it('HTTP 錯誤應拋出 SSEError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: { code: 'SERVER_ERROR', message: 'bad' } }),
    });
    await expect(sseRequest('/test', {}, {})).rejects.toThrow(SSEError);
    try {
      await sseRequest('/test', {}, {});
    } catch (e) {
      const err = e as SSEError;
      expect(err.status).toBe(500);
      expect(err.code).toBe('SERVER_ERROR');
    }
  });

  it('無 response body 時應拋錯', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: null });
    await expect(sseRequest('/test', {}, {})).rejects.toThrow('No response body');
  });

  it('應正確解析 token 事件並呼叫 onToken', async () => {
    const body = makeReadableStream([
      'event: token\ndata: {"text":"hello"}\n\n',
      'event: token\ndata: {"text":" world"}\n\n',
      'event: complete\ndata: {"status":"done"}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body });
    const onToken = vi.fn();
    const onComplete = vi.fn();
    await sseRequest('/test', {}, { onToken, onComplete });
    expect(onToken).toHaveBeenCalledWith('hello');
    expect(onToken).toHaveBeenCalledWith(' world');
    expect(onComplete).toHaveBeenCalledWith({ status: 'done' });
  });

  it('應正確解析 metadata / safety_alert / error 事件', async () => {
    const body = makeReadableStream([
      'event: metadata\ndata: {"intent":"explore"}\n\n',
      'event: safety_alert\ndata: {"message":"warn","severity":"warning"}\n\n',
      'event: error\ndata: {"code":"RATE_LIMIT","message":"slow down"}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body });
    const onMetadata = vi.fn();
    const onSafetyAlert = vi.fn();
    const onError = vi.fn();
    await sseRequest('/test', {}, { onMetadata, onSafetyAlert, onError });
    expect(onMetadata).toHaveBeenCalledWith({ intent: 'explore' });
    expect(onSafetyAlert).toHaveBeenCalledWith({ message: 'warn', severity: 'warning' });
    expect(onError).toHaveBeenCalledWith({ code: 'RATE_LIMIT', message: 'slow down' });
  });

  it('無 token 時不應加 Authorization header', async () => {
    localStorage.clear();
    sessionStorage.clear();
    const body = makeReadableStream(['event: complete\ndata: {}\n\n']);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body });
    await sseRequest('/test', {}, {});
    const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it('JSON 解析失敗的事件應被忽略', async () => {
    const body = makeReadableStream([
      'event: token\ndata: not-json\n\n',
      'event: complete\ndata: {}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body });
    const onToken = vi.fn();
    const onComplete = vi.fn();
    await sseRequest('/test', {}, { onToken, onComplete });
    expect(onToken).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({});
  });
});
