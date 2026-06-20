import { createM5ApiClient } from '@emorapy/api-client';

import { appApiClient } from '@/src/platform/api/client';

export const m5Api = createM5ApiClient(appApiClient.instance);

export function normalizeM5Error(error: unknown): { code: string; message: string } {
  const normalized = appApiClient.normalizeError(error);
  return {
    code: normalized.code,
    message: normalized.message,
  };
}
