/**
 * SafetyAlert 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('severity 為 critical 時應把焦點移到持續提示，且不假設單一地區電話', () => {
    const onDismiss = vi.fn();
    render(<SafetyAlert message="嚴重" severity="critical" onDismiss={onDismiss} />);
    expect(screen.getByText('safety.resources')).toBeInTheDocument();
    expect(screen.getByText('safety.resourcesEmergency')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'safety.resourcesGlobalLink' })).toHaveAttribute(
      'href',
      'https://findahelpline.com/',
    );
    expect(screen.queryByText(/1925|1995|1980/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.dismiss' })).not.toBeInTheDocument();
    expect(screen.getByText('嚴重').closest('[data-critical="true"]')).toHaveFocus();
  });

  it('severity 非 critical 時不應顯示危機資源', () => {
    render(<SafetyAlert message="提醒" severity="warning" />);
    expect(screen.queryByText('safety.resources')).not.toBeInTheDocument();
  });

  it('有 onDismiss 時應可關閉', () => {
    const onDismiss = vi.fn();
    render(<SafetyAlert message="test" onDismiss={onDismiss} />);
    const closeButton = screen.getByRole('button', { name: 'common.dismiss' });
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
