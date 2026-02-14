/**
 * ConfirmModal 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfirmModal from './index';

describe('ConfirmModal', () => {
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
    expect(screen.getByRole('button', { name: '確認' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '刪除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
  });

  it('type 為 warning 時應顯示警示圖標', () => {
    const { container } = render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="warning">
        內容
      </ConfirmModal>
    );
    expect(container.querySelector('.anticon-exclamation-circle')).toBeInTheDocument();
  });

  it('type 為 danger 時應顯示警示圖標', () => {
    const { container } = render(
      <ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} type="danger">
        內容
      </ConfirmModal>
    );
    expect(container.querySelector('.anticon-exclamation-circle')).toBeInTheDocument();
  });
});
