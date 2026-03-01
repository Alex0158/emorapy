/**
 * ConsentModal 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConsentModal from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Space: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

describe('ConsentModal', () => {
  const defaultProps = {
    open: true,
    onConsent: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open=true 時應渲染 Modal 內容', () => {
    render(<ConsentModal {...defaultProps} />);
    expect(screen.getByText('consent.beforeStart')).toBeInTheDocument();
    expect(screen.getByText('consent.description')).toBeInTheDocument();
    expect(screen.getByText('consent.agree')).toBeInTheDocument();
  });

  it('未勾選同意時開始按鈕應為 disabled', () => {
    render(<ConsentModal {...defaultProps} />);
    const startBtn = screen.getByText('consent.start').closest('button');
    expect(startBtn).toBeDisabled();
  });

  it('勾選同意後開始按鈕應啟用', () => {
    render(<ConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('consent.agree'));
    const startBtn = screen.getByText('consent.start').closest('button');
    expect(startBtn).not.toBeDisabled();
  });

  it('勾選同意後點擊開始應呼叫 onConsent', () => {
    render(<ConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    expect(defaultProps.onConsent).toHaveBeenCalledOnce();
  });

  it('點擊取消按鈕應呼叫 onCancel', () => {
    render(<ConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('consent.notNow'));
    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it('loading 時開始按鈕應 disabled', () => {
    render(<ConsentModal {...defaultProps} loading />);
    fireEvent.click(screen.getByText('consent.agree'));
    const startBtn = screen.getByText('consent.start').closest('button');
    expect(startBtn).toBeDisabled();
  });

  it('應顯示所有承諾要點', () => {
    render(<ConsentModal {...defaultProps} />);
    expect(screen.getByText('consent.point1')).toBeInTheDocument();
    expect(screen.getByText('consent.point2')).toBeInTheDocument();
    expect(screen.getByText('consent.point3')).toBeInTheDocument();
    expect(screen.getByText('consent.point4')).toBeInTheDocument();
    expect(screen.getByText('consent.point5')).toBeInTheDocument();
  });
});
