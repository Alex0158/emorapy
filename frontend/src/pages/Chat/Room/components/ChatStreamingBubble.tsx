/**
 * AI streaming response placeholder
 */

import { Badge } from '@/components/ui/badge';
import AIStreamingBubble, { type AIStreamingBubbleStatus } from '@/components/common/AIStreamingBubble';
import { t } from '@/utils/i18n';

interface ChatStreamingBubbleProps {
  text: string;
  status?: AIStreamingBubbleStatus;
}

export default function ChatStreamingBubble({ text, status = 'thinking' }: ChatStreamingBubbleProps) {
  return (
    <AIStreamingBubble
      text={text}
      fallbackText={t('chat.thinking')}
      status={status}
      wrapperClassName="chat-room-page__message-row chat-room-page__message-row--left"
      itemClassName="chat-room-page__message-item chat-room-page__message-item--left chat-room-page__message-item--streaming"
      bodyClassName="chat-room-page__message-body"
      contentClassName="chat-room-page__message-content"
      cursorClassName="chat-room-page__streaming-cursor"
      thinkingClassName="chat-room-page__thinking-indicator"
      thinkingDotsClassName="chat-room-page__thinking-dots"
      head={(
        <div className="chat-room-page__message-head">
          <Badge variant="secondary" className="text-[10px]">{t('chat.role.aiMediator')}</Badge>
        </div>
      )}
    />
  );
}
