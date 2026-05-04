/**
 * 聊天氣泡組件
 *
 * 遷移: Ant Typography → 原生元素 + Tailwind
 * 保留: Framer Motion 動畫、MediatorAvatar
 */

import React from 'react';
import { motion } from 'framer-motion';
import MediatorAvatar from '@/components/business/MediatorAvatar';
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
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex gap-3 max-w-[85%]',
        isUser ? 'ml-auto flex-row-reverse' : '',
        safetyFlag ? 'ring-1 ring-warning/30 rounded-2xl p-1' : '',
      )}
    >
      {!isUser && (
        <div className="shrink-0 pt-1">
          <MediatorAvatar size="small" />
        </div>
      )}
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
            <span className="ml-0.5 inline-block w-[2px] h-4 bg-current animate-[blink_1s_infinite]" />
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

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
};

export default ChatBubble;
