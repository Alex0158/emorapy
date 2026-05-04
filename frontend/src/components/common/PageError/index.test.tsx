import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageError } from './index';

describe('PageError', () => {
  it('渲染預設 generic variant', () => {
    render(<PageError />);
    expect(screen.getByText('出了點小問題')).toBeInTheDocument();
    expect(screen.getByText(/別擔心/)).toBeInTheDocument();
  });

  it('渲染 network variant', () => {
    render(<PageError variant="network" />);
    expect(screen.getByText('連接出了點問題')).toBeInTheDocument();
  });

  it('渲染 notFound variant', () => {
    render(<PageError variant="notFound" />);
    expect(screen.getByText('找不到這個頁面')).toBeInTheDocument();
  });

  it('渲染 permission variant', () => {
    render(<PageError variant="permission" />);
    expect(screen.getByText('沒有權限查看')).toBeInTheDocument();
  });

  it('渲染 server variant', () => {
    render(<PageError variant="server" />);
    expect(screen.getByText('服務暫時有問題')).toBeInTheDocument();
  });

  it('自定義 title 和 description', () => {
    render(<PageError title="自定義標題" description="自定義描述" />);
    expect(screen.getByText('自定義標題')).toBeInTheDocument();
    expect(screen.getByText('自定義描述')).toBeInTheDocument();
  });

  it('有 onRetry 時渲染重試按鈕', () => {
    const onRetry = vi.fn();
    render(<PageError onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: /再試一次/ });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('有 onBack 時渲染返回按鈕', () => {
    const onBack = vi.fn();
    render(<PageError onBack={onBack} />);
    const button = screen.getByRole('button', { name: /返回/ });
    fireEvent.click(button);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('自定義按鈕文案', () => {
    render(
      <PageError
        onRetry={() => {}}
        onBack={() => {}}
        retryLabel="Retry"
        backLabel="Go Back"
      />,
    );
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go Back/ })).toBeInTheDocument();
  });

  it('設置 role="alert" 用於無障礙', () => {
    const { container } = render(<PageError />);
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  it('沒有 onRetry 和 onBack 時不渲染按鈕', () => {
    render(<PageError />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
