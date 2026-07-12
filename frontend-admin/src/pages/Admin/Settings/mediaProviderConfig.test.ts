import { describe, expect, it } from 'vitest';
import { buildMediaProviderSaveValue } from './mediaProviderConfig';

describe('buildMediaProviderSaveValue', () => {
	it('已設定 secret 時可只儲存非 secret 欄位', () => {
		expect(buildMediaProviderSaveValue({
			formValues: {
				apiKey: '',
				baseUrl: ' https://api.example.com ',
				model: ' image-v2 ',
				timeoutMs: 8000,
			},
			providerType: 'image',
			secretConfigured: true,
		})).toEqual({
			baseUrl: 'https://api.example.com',
			model: 'image-v2',
			timeoutMs: 8000,
		});
	});

	it('未設定 secret 時必須先提供 apiKey', () => {
		expect(buildMediaProviderSaveValue({
			formValues: { apiKey: '', baseUrl: 'https://api.example.com' },
			providerType: 'image',
			secretConfigured: false,
		})).toBeNull();
	});

	it('提供新 apiKey 時應明確送出 rotation', () => {
		expect(buildMediaProviderSaveValue({
			formValues: { apiKey: ' rotated-secret ', sourceImageUrl: ' https://image.example.com/source.png ' },
			providerType: 'video',
			secretConfigured: true,
		})).toEqual({
			apiKey: 'rotated-secret',
			sourceImageUrl: 'https://image.example.com/source.png',
		});
	});
});
