import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, error: null }),
}));
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import AdminAuditLogsPage from './index';

describe('AdminAuditLogsPage form contract', () => {
  it('filter inputs expose labels and autocomplete', () => {
    const html = renderToStaticMarkup(<AdminAuditLogsPage />);
    for (const id of [
      'admin-audit-entity-type',
      'admin-audit-action',
      'admin-audit-from',
      'admin-audit-to',
    ]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html.match(/autoComplete="off"/g)).toHaveLength(4);
  });
});
