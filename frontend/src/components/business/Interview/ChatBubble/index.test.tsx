/**
 * ChatBubble 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatBubble from './index';

vi.mock('@/components/business/MediatorAvatar', () => ({
  default: () => <div data-testid="mediator-avatar" />,
}));

vi.mock('@/utils/i18n', () => ({
  getLocale: () => 'zh-TW',
}));

describe('ChatBubble', () => {
  it('引導訊息應直接渲染內容，不加入人物或 AI avatar', () => {
    render(<ChatBubble content="你好" isUser={false} />);
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.queryByTestId('mediator-avatar')).not.toBeInTheDocument();
  });

  it('使用者訊息不應渲染 avatar', () => {
    render(<ChatBubble content="我的回覆" isUser={true} />);
    expect(screen.getByText('我的回覆')).toBeInTheDocument();
    expect(screen.queryByTestId('mediator-avatar')).not.toBeInTheDocument();
  });

  it('isStreaming 時應顯示游標', () => {
    render(<ChatBubble content="生成中" isUser={false} isStreaming />);
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
  });

  it('非 streaming 時不應顯示游標', () => {
    const { container } = render(<ChatBubble content="完成" isUser={false} />);
    expect(container.querySelector('.animate-\\[blink_1s_infinite\\]')).not.toBeInTheDocument();
  });

  it('有 timestamp 時應顯示時間', () => {
    const { container } = render(<ChatBubble content="test" isUser={false} timestamp="2025-06-01T10:30:00Z" />);
    expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument();
  });

  it('safetyFlag 時應套用 safety class', () => {
    const { container } = render(<ChatBubble content="alert" isUser={false} safetyFlag />);
    expect(container.querySelector('.ring-1')).toBeInTheDocument();
  });
});
