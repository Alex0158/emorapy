/**
 * AI streaming response placeholder
 */

import { Tag, Typography } from 'antd';
import { t } from '@/utils/i18n';

const { Paragraph } = Typography;

interface ChatStreamingBubbleProps {
  streamingAiText: string;
}

export default function ChatStreamingBubble({ streamingAiText }: ChatStreamingBubbleProps) {
  return (
    <div className="chat-room-page__message-row chat-room-page__message-row--left">
      <div
        className="chat-room-page__message-item chat-room-page__message-item--left chat-room-page__message-item--streaming"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="chat-room-page__message-head">
          <Tag color="default">{t('chat.role.aiMediator')}</Tag>
        </div>
        <Paragraph className="chat-room-page__message-content">
          {streamingAiText ? streamingAiText : t('chat.thinking')}
          <span className="chat-room-page__streaming-cursor">|</span>
        </Paragraph>
      </div>
    </div>
  );
}
