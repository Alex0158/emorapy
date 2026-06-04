import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setLocale, t } from '@/utils/i18n';
import { EmptyState } from './index';

describe('EmptyState', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  it('渲染預設 variant 的標題和描述', () => {
    render(<EmptyState />);
    expect(screen.getByText('這裡還沒有內容')).toBeInTheDocument();
    expect(screen.getByText('之後會有更多內容出現在這裡。')).toBeInTheDocument();
  });

  it('渲染 cases variant', () => {
    render(<EmptyState variant="cases" />);
    expect(screen.getByText('還沒有案件')).toBeInTheDocument();
  });

  it('渲染 executions variant', () => {
    render(<EmptyState variant="executions" />);
    expect(screen.getByText('暫無執行中的方案')).toBeInTheDocument();
    expect(screen.getByText('在收到梳理結果後，選擇和好方案即可在這裡追蹤進度。')).toBeInTheDocument();
  });

  it('渲染 notifications variant', () => {
    render(<EmptyState variant="notifications" />);
    expect(screen.getByText('沒有新通知')).toBeInTheDocument();
  });

  it('渲染 search variant', () => {
    render(<EmptyState variant="search" />);
    expect(screen.getByText('找不到相關結果')).toBeInTheDocument();
  });

  it('渲染 chat variant', () => {
    render(<EmptyState variant="chat" />);
    expect(screen.getByText('對話即將開始')).toBeInTheDocument();
  });

  it('自定義 title 和 description 覆蓋預設值', () => {
    render(
      <EmptyState
        variant="cases"
        title="Custom Title"
        description="Custom Desc"
      />,
    );
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Desc')).toBeInTheDocument();
  });

  it('有 actionLabel 和 onAction 時渲染按鈕', () => {
    const onAction = vi.fn();
    render(
      <EmptyState actionLabel="建立案件" onAction={onAction} />,
    );
    const button = screen.getByRole('button', { name: '建立案件' });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('沒有 actionLabel 時不渲染按鈕', () => {
    render(<EmptyState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('支持 className prop', () => {
    const { container } = render(<EmptyState className="my-class" />);
    expect(container.firstElementChild?.className).toContain('my-class');
  });

  it('未傳 title/description 時應跟隨 en-US locale 顯示預設空狀態', async () => {
    setLocale('en-US');
    await waitFor(() => expect(t('emptyState.search.title')).toBe('No matching results'));

    render(<EmptyState variant="search" />);

    expect(screen.getByText('No matching results')).toBeInTheDocument();
    expect(screen.getByText('Try different keywords or adjust your filters.')).toBeInTheDocument();
  });
});
