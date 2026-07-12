import type { MediaProviderFormValues } from './types';

export function buildMediaProviderSaveValue(input: {
	formValues: MediaProviderFormValues;
	providerType: 'image' | 'video';
	secretConfigured: boolean;
}): Record<string, unknown> | null {
	const { formValues, providerType, secretConfigured } = input;
	const apiKey = formValues.apiKey?.trim();
	if (!apiKey && !secretConfigured) return null;

	const value: Record<string, unknown> = {};
	if (apiKey) value.apiKey = apiKey;
	if (formValues.baseUrl?.trim()) value.baseUrl = formValues.baseUrl.trim();
	if (formValues.model?.trim()) value.model = formValues.model.trim();
	if (typeof formValues.timeoutMs === 'number') value.timeoutMs = formValues.timeoutMs;
	if (providerType === 'video' && formValues.sourceImageUrl?.trim()) {
		value.sourceImageUrl = formValues.sourceImageUrl.trim();
	}
	return value;
}
