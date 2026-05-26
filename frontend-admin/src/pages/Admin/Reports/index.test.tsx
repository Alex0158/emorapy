import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, error: null }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getReportOverview: vi.fn(),
    getReportFunnel: vi.fn(),
    getCustomReport: vi.fn(),
    getReportCosts: vi.fn(),
    getReportAIStreams: vi.fn(),
    listReportAIStreamSessions: vi.fn(),
    getReportAIStreamDetail: vi.fn(),
    downloadReportOverviewCsv: vi.fn(),
  },
}));

import AdminReportsPage from './index';

describe('AdminReportsPage', () => {
  it('應渲染自定義報表輸入的 label 與 placeholder', () => {
    const html = renderToStaticMarkup(<AdminReportsPage />);
    expect(html).toContain('for="admin-custom-metrics"');
    expect(html).toContain('id="admin-custom-metrics"');
    expect(html).toContain('admin.reports.customMetricsLabel');
    expect(html).toContain('admin.reports.metricsPlaceholder');
  });
});
