import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AIThinkingIndicator from './AIThinkingIndicator';
import AIStreamingText from './AIStreamingText';
import AIStreamingBubble from './AIStreamingBubble';
import AIRecoveryBadge from './AIRecoveryBadge';
import AIErrorState from './AIErrorState';

describe('AI streaming common components', () => {
  it('AIThinkingIndicator 應渲染文案與省略號', () => {
    render(<AIThinkingIndicator text="thinking" />);
    expect(screen.getByText('thinking')).toBeInTheDocument();
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('AIStreamingText 在 showCursor=true 時應顯示 cursor', () => {
    const { container } = render(
      <div>
        <AIStreamingText text="hello" cursorClassName="cursor" />
      </div>
    );
    expect(container.querySelector('.cursor')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('AIStreamingBubble 無文本時應使用 thinking indicator', () => {
    render(
      <AIStreamingBubble
        text=""
        fallbackText="waiting"
        wrapperClassName="wrapper"
        bodyClassName="body"
        contentClassName="content"
        cursorClassName="cursor"
      />
    );
    expect(screen.getByText('waiting')).toBeInTheDocument();
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('AIRecoveryBadge 應輸出恢復標記', () => {
    render(<AIRecoveryBadge text="recovering" />);
    expect(screen.getByText('recovering')).toHaveAttribute('data-ai-recovery-badge', 'true');
  });

  it('AIErrorState 應輸出統一錯誤容器與 footer', () => {
    render(
      <AIErrorState
        title="load failed"
        description="try again"
        footer={<button type="button">back</button>}
      />
    );
    expect(screen.getByText('load failed').closest('[data-ai-error-state="true"]')).toHaveAttribute('data-ai-error-type', 'error');
    expect(screen.getByText('try again')).toBeInTheDocument();
    expect(screen.getByText('back').closest('[data-ai-error-footer="true"]')).toBeInTheDocument();
  });
});
