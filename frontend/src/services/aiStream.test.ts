import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectAIStream } from './aiStream';
import { setLocale, t } from '@/utils/i18n';

vi.mock('@/config/env', () => ({
	env: { apiBaseURL: 'https://api.test' },
}));

async function setLocaleReady(locale: 'zh-TW' | 'en-US'): Promise<void> {
	setLocale(locale);
	for (let attempt = 0; attempt < 20; attempt += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		const message = t('stream.error.httpStatus', { status: 503 });
		if (locale === 'zh-TW' || message === 'Real-time connection request failed (status 503)') return;
	}
}

describe('connectAIStream', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		localStorage.clear();
		sessionStorage.clear();
		setLocale('zh-TW');
	});

	it('localizes HTTP fallback errors when the backend message is unavailable', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: () => Promise.reject(new Error('invalid json')),
		}));
		const onError = vi.fn();

		await connectAIStream('quick_case', 'case-1', { onError });

		expect(onError).toHaveBeenCalledWith(expect.objectContaining({
			code: 'HTTP_500',
			message: '即時連線請求失敗（狀態碼 500）',
			status: 500,
		}));

		await setLocaleReady('en-US');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 503,
			json: () => Promise.reject(new Error('invalid json')),
		}));

		await connectAIStream('quick_case', 'case-1', { onError });

		expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({
			code: 'HTTP_503',
			message: 'Real-time connection request failed (status 503)',
			status: 503,
		}));
	});

	it('does not expose backend-provided stream error messages', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			json: () => Promise.resolve({ error: { code: 'FORBIDDEN', message: '固定繁中錯誤' } }),
		}));
		const onError = vi.fn();

		await setLocaleReady('en-US');
		await connectAIStream('quick_case', 'case-1', { onError });

		expect(onError).toHaveBeenCalledWith(expect.objectContaining({
			code: 'FORBIDDEN',
			message: 'Real-time connection request failed (status 403)',
			status: 403,
		}));
	});

	it('localizes body-missing and disconnected fallback errors', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));
		const onError = vi.fn();

		await connectAIStream('quick_case', 'case-1', { onError });

		expect(onError).toHaveBeenCalledWith(expect.objectContaining({
			code: 'STREAM_BODY_MISSING',
			message: '即時連線回應內容不可讀，請稍後再試',
		}));

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			body: {
				getReader: () => ({
					read: vi.fn().mockRejectedValue(new Error('network error')),
				}),
			},
		}));

		await connectAIStream('quick_case', 'case-1', { onError });
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({
			code: 'STREAM_DISCONNECTED',
			message: '即時連線已中斷，請稍後再試',
		}));
	});
});
