import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegisterPromptSection from './RegisterPromptSection';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('RegisterPromptSection', () => {
  it('show=false 時不應渲染任何內容', () => {
    const { container } = render(
      <RegisterPromptSection show={false} onRegister={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.querySelector('.register-prompt-section')).not.toBeInTheDocument();
  });

  it('show=true 時應渲染提示標題和按鈕', () => {
    render(
      <RegisterPromptSection show={true} onRegister={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('register.prompt.title')).toBeInTheDocument();
    expect(screen.getByText('register.prompt.desc')).toBeInTheDocument();
    expect(screen.getByText('register.action.now')).toBeInTheDocument();
    expect(screen.getByText('register.action.later')).toBeInTheDocument();
  });

  it('點擊註冊按鈕應呼叫 onRegister', () => {
    const onRegister = vi.fn();
    render(
      <RegisterPromptSection show={true} onRegister={onRegister} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText('register.action.now'));
    expect(onRegister).toHaveBeenCalledOnce();
  });

  it('點擊稍後按鈕應呼叫 onClose', () => {
    const onClose = vi.fn();
    render(
      <RegisterPromptSection show={true} onRegister={vi.fn()} onClose={onClose} />
    );
    fireEvent.click(screen.getByText('register.action.later'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
