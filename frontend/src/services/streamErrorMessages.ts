import { t } from '@/utils/i18n';

export function getStreamHttpFallbackMessage(status: number): string {
	return t('stream.error.httpStatus', { status });
}

export function getStreamBodyMissingMessage(): string {
	return t('stream.error.bodyMissing');
}

export function getStreamDisconnectedMessage(): string {
	return t('stream.error.disconnected');
}

export function getSseResponseBodyMissingMessage(): string {
	return t('stream.error.responseBodyMissing');
}
