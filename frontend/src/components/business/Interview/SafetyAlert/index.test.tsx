/**
 * SafetyAlert 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SafetyAlert from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('SafetyAlert', () => {
  it('應渲染安全標題和訊息', () => {
    render(<SafetyAlert message="請注意安全" />);
    expect(screen.getByText('safety.title')).toBeInTheDocument();
    expect(screen.getByText('請注意安全')).toBeInTheDocument();
  });

  it('severity 為 critical 時應顯示危機資源', () => {
    render(<SafetyAlert message="嚴重" severity="critical" />);
    expect(screen.getByText(/safety\.resources/)).toBeInTheDocument();
    expect(screen.getByText(/1925/)).toBeInTheDocument();
    expect(screen.getByText(/1995/)).toBeInTheDocument();
    expect(screen.getByText(/1980/)).toBeInTheDocument();
  });

  it('severity 非 critical 時不應顯示危機資源', () => {
    render(<SafetyAlert message="提醒" severity="warning" />);
    expect(screen.queryByText(/safety\.resources/)).not.toBeInTheDocument();
  });

  it('有 onDismiss 時應可關閉', () => {
    render(<SafetyAlert message="test" onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
