/**
 * ConfirmModal 組件單元測試
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { setLocale, t } from '@/utils/i18n';
import ConfirmModal from './index';

describe('ConfirmModal', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

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

  it('未傳 title 時應跟隨 en-US locale 顯示預設標題', async () => {
    setLocale('en-US');
    await waitFor(() => expect(t('confirmModal.dangerTitle')).toBe('Confirm action'));

    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="danger">
        Content
      </ConfirmModal>
    );

    expect(screen.getByText('Confirm action')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
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
