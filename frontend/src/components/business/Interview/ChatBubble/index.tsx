/**
 * 聊天氣泡組件
 *
 * Guided Reflection：訊息本身承接角色差異，不使用人物或 AI avatar 裝飾。
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { getLocale } from '@/utils/i18n';

interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
  timestamp?: string;
  safetyFlag?: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ content, isUser, isStreaming, timestamp, safetyFlag }) => {
  const locale = getLocale();

  return (
    <div
      className={cn(
        'flex max-w-[85%]',
        isUser ? 'ml-auto flex-row-reverse' : '',
        safetyFlag ? 'ring-1 ring-warning/30 rounded-2xl p-1' : '',
      )}
    >
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border text-foreground rounded-tl-md shadow-xs',
          )}
        >
          <span className="whitespace-pre-wrap">{content}</span>
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-4 w-px bg-current"
              data-testid="streaming-cursor"
              aria-hidden="true"
            />
          )}
        </div>
        {timestamp && (
          <span className={cn(
            'text-[11px] text-muted-foreground px-1',
            isUser ? 'text-right' : 'text-left',
          )}>
            {new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
