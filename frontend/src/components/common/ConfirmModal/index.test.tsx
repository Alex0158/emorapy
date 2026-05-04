/**
 * ConfirmModal 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfirmModal from './index';

// Mock i18n so default confirm/cancel use known values; component uses t('common.confirm') / t('common.cancel')
vi.mock('@/utils/i18n', () => ({
  t: (key: string) =>
    ({ 'common.confirm': '確認', 'common.cancel': '取消' }[key] ?? key),
}));

describe('ConfirmModal', () => {
  it('應渲染並顯示 children', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} title="提示">
        確定要刪除嗎？
      </ConfirmModal>
    );
    expect(screen.getByText('確定要刪除嗎？')).toBeInTheDocument();
  });

  it('預設應顯示確認與取消按鈕文字', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} title="提示">
        內容
      </ConfirmModal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('確認')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('應支援自定義 confirmText 與 cancelText', () => {
    render(
      <ConfirmModal
        open
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmText="刪除"
        cancelText="返回"
        title="提示"
      >
        內容
      </ConfirmModal>
    );
    expect(screen.getByText('刪除')).toBeInTheDocument();
    expect(screen.getByText('返回')).toBeInTheDocument();
  });

  it('type 為 warning 時應顯示警示圖標', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="warning" title="警告">
        內容
      </ConfirmModal>
    );
    // AlertTriangle from lucide renders an SVG with class containing "text-warning"
    // Dialog renders in a portal, so query document directly
    const svg = document.body.querySelector('svg[class*="text-warning"]');
    expect(svg).toBeInTheDocument();
  });

  it('type 為 danger 時應顯示警示圖標', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="danger" title="危險">
        內容
      </ConfirmModal>
    );
    // AlertCircle from lucide renders an SVG with class containing "text-destructive"
    const svg = document.body.querySelector('svg[class*="text-destructive"]');
    expect(svg).toBeInTheDocument();
  });
});
