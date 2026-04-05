import type { ReactNode } from 'react';
import AIThinkingIndicator from './AIThinkingIndicator';
import AIStreamingText from './AIStreamingText';

export type AIStreamingBubbleStatus = 'thinking' | 'streaming' | 'persisting' | 'cancelled';

interface AIStreamingBubbleProps {
  text: string;
  fallbackText: string;
  status?: AIStreamingBubbleStatus;
  wrapperClassName: string;
  itemClassName?: string;
  bodyClassName: string;
  contentClassName: string;
  cursorClassName: string;
  thinkingClassName?: string;
  thinkingDotsClassName?: string;
  avatar?: ReactNode;
  head?: ReactNode;
}

export default function AIStreamingBubble({
  text,
  fallbackText,
  status = 'thinking',
  wrapperClassName,
  itemClassName,
  bodyClassName,
  contentClassName,
  cursorClassName,
  thinkingClassName,
  thinkingDotsClassName,
  avatar,
  head,
}: AIStreamingBubbleProps) {
  const hasText = Boolean(text);

  return (
    <div
      className={wrapperClassName}
      aria-live="polite"
      aria-busy={status !== 'persisting' && status !== 'cancelled'}
      data-ai-stream-status={status}
    >
      <div className={itemClassName}>
        {avatar}
        <div className={bodyClassName}>
          {head}
          <div className={contentClassName}>
            {hasText ? (
              <AIStreamingText
                text={text}
                cursorClassName={cursorClassName}
                showCursor={status !== 'cancelled'}
              />
            ) : (
              <AIThinkingIndicator
                text={fallbackText}
                className={thinkingClassName}
                dotsClassName={thinkingDotsClassName}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
