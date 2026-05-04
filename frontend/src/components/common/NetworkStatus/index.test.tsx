/**
 * NetworkStatus 組件單元測試
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import NetworkStatus from './index';

const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock('lucide-react', () => ({
  WifiOff: (props: Record<string, unknown>) => <svg data-testid="wifi-off-icon" {...props} />,
}));

describe('NetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('在線時應不渲染內容', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const { container } = render(<NetworkStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('離線時應顯示網絡斷開提示', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<NetworkStatus />);
    expect(screen.getByText('網絡連接已斷開')).toBeInTheDocument();
    expect(screen.getByText(/請檢查您的網絡連接/)).toBeInTheDocument();
  });

  it('離線後觸發 online 事件應隱藏提示', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<NetworkStatus />);
    expect(screen.getByText('網絡連接已斷開')).toBeInTheDocument();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(screen.queryByText('網絡連接已斷開')).not.toBeInTheDocument();
    });
  });
});
