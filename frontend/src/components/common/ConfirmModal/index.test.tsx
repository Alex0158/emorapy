/**
 * ConfirmModal 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfirmModal from './index';

// Mock i18n so default confirm/cancel use known values; component uses t('common.confirm') / t('common.cancel')
vi.mock('@/utils/i18n', () => ({
  t: (key: string) =>
    ({ 'common.confirm': '確認', 'common.cancel': '取消' }[key] ?? key),
}));

describe('ConfirmModal', () => {
  beforeEach(() => {
    // antd Modal / testing-library use getComputedStyle in jsdom which is not fully implemented
    const stubStyle = { getPropertyValue: () => '' };
    Object.defineProperty(window, 'getComputedStyle', {
      value: () => stubStyle,
      configurable: true,
    });
  });

  it('應渲染並顯示 children', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()}>
        確定要刪除嗎？
      </ConfirmModal>
    );
    expect(screen.getByText('確定要刪除嗎？')).toBeInTheDocument();
  });

  it('預設應顯示確認與取消按鈕文字', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()}>
        內容
      </ConfirmModal>
    );
    // Modal has Close + cancel + confirm; exclude Close to get ok/cancel (i18n t() may render key or translation)
    const buttons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close');
    expect(buttons).toHaveLength(2);
  });

  it('應支援自定義 confirmText 與 cancelText', () => {
    render(
      <ConfirmModal
        open
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmText="刪除"
        cancelText="返回"
      >
        內容
      </ConfirmModal>
    );
    const buttons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close');
    expect(buttons).toHaveLength(2);
    const texts = buttons.map((b) => (b.textContent ?? '').trim());
    expect(texts.some((t) => t.replace(/\s/g, '') === '刪除')).toBe(true);
    expect(texts.some((t) => t.replace(/\s/g, '') === '返回')).toBe(true);
  });

  it('type 為 warning 時應顯示警示圖標', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="warning">
        內容
      </ConfirmModal>
    );
    // Modal renders in a portal so query document
    expect(document.querySelector('[class*="exclamation-circle"]')).toBeInTheDocument();
  });

  it('type 為 danger 時應顯示警示圖標', () => {
    render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="danger">
        內容
      </ConfirmModal>
    );
    expect(document.querySelector('[class*="exclamation-circle"]')).toBeInTheDocument();
  });
});
