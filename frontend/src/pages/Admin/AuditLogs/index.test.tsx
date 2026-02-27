import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminAuditLogsPage from './index';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    listAuditLogs: vi.fn(),
    downloadAuditLogsCsv: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: {
        items: [{ id: 'log1', created_at: '2026-01-01T00:00:00.000Z', actor_id: 'admin-1', entity_type: 'user', action: 'user_activate', detail: {} }],
      },
      error: null,
      isLoading: false,
    });
  });

  it('應顯示審計日誌列表', () => {
    render(<AdminAuditLogsPage />);
    expect(screen.getByText('admin.audit.heading')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });
});

