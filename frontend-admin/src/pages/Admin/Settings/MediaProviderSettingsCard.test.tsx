import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

import MediaProviderSettingsCard from './MediaProviderSettingsCard';

const catalog = [
  {
    providerKey: 'openai',
    providerType: 'image' as const,
    displayName: 'OpenAI',
    defaultModel: 'gpt-image-1',
    defaultBaseUrl: 'https://api.openai.com/v1',
    description: 'desc',
    secretLabel: 'API Key',
  },
];

describe('MediaProviderSettingsCard', () => {
  it('應提供 programmatic label 與 autocomplete', () => {
    const html = renderToStaticMarkup(
      <MediaProviderSettingsCard
        formValues={{ apiKey: '', baseUrl: '', timeoutMs: undefined, model: '', prompt: '', count: undefined, durationSeconds: undefined, sourceImageUrl: '' }}
        onFormChange={vi.fn()}
        catalog={catalog}
        selectedProvider={catalog[0]}
        selectedProviderKey="openai"
        testResult={null}
        saveLoading={false}
        testLoading={false}
        onProviderChange={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        getConfigValue={vi.fn()}
      />
    );

    expect(html).toContain('for="admin-media-provider-api-key"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('id="admin-media-provider-base-url"');
    expect(html).toContain('autoComplete="url"');
    expect(html).toContain('id="admin-media-provider-model"');
    expect(html).toContain('id="admin-media-provider-prompt"');
  });
});
