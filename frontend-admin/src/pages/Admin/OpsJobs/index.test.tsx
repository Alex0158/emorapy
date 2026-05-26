import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/useAdminTokenEditor', () => ({
  useAdminTokenEditor: () => ({
    tokenInput: '',
    setTokenInput: vi.fn(),
    saveToken: vi.fn(),
    clearToken: vi.fn(),
    tokenState: {
      tokenReady: false,
      showInlineInvalid: false,
      showInlineNotApplied: false,
    },
  }),
}));
vi.mock('@/hooks/useAdminAccess', () => ({
  useAdminAccess: () => ({
    adminMeQuery: { isLoading: false, error: null },
    hasPermission: false,
  }),
}));
vi.mock('@/hooks/useAdminJobStats', () => ({
  useAdminJobStats: () => ({
    data: undefined,
    error: null,
    isLoading: false,
  }),
}));

import OpsJobsStatsPage from './index';

describe('OpsJobsStatsPage form contract', () => {
  it('token and query inputs expose labels and autocomplete', () => {
    const html = renderToStaticMarkup(<OpsJobsStatsPage />);
    expect(html).toContain('for="admin-ops-token"');
    expect(html).toContain('id="admin-ops-token"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('for="admin-ops-days"');
    expect(html).toContain('id="admin-ops-days"');
    expect(html).toContain('for="admin-ops-max-rows"');
    expect(html).toContain('id="admin-ops-max-rows"');
  });
});
