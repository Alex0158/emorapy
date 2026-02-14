/**
 * Execution CheckIn 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExecutionCheckIn from './index';

vi.mock('@/services/api/execution', () => ({
  checkin: vi.fn(),
  getExecutionStatus: vi.fn(),
}));
vi.mock('@/services/api/case', () => ({
  uploadEvidence: vi.fn(),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ExecutionCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
