/**
 * ChatBubble 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatBubble from './index';

describe('ChatBubble', () => {
  it('AI 訊息應渲染 assistant avatar 和內容', () => {
    render(<ChatBubble content="你好" isUser={false} />);
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getByLabelText('assistant')).toBeInTheDocument();
  });

  it('使用者訊息不應渲染 avatar', () => {
    render(<ChatBubble content="我的回覆" isUser={true} />);
    expect(screen.getByText('我的回覆')).toBeInTheDocument();
    expect(screen.queryByLabelText('assistant')).not.toBeInTheDocument();
  });

  it('isStreaming 時應顯示游標', () => {
    const { container } = render(<ChatBubble content="生成中" isUser={false} isStreaming />);
    expect(container.querySelector('.chat-bubble__cursor')).toBeInTheDocument();
  });

  it('非 streaming 時不應顯示游標', () => {
    const { container } = render(<ChatBubble content="完成" isUser={false} />);
    expect(container.querySelector('.chat-bubble__cursor')).not.toBeInTheDocument();
  });

  it('有 timestamp 時應顯示時間', () => {
    render(<ChatBubble content="test" isUser={false} timestamp="2025-06-01T10:30:00Z" />);
    expect(document.querySelector('.chat-bubble__time')).toBeInTheDocument();
  });

  it('safetyFlag 時應套用 safety class', () => {
    const { container } = render(<ChatBubble content="alert" isUser={false} safetyFlag />);
    expect(container.querySelector('.chat-bubble--safety')).toBeInTheDocument();
  });
});
