/**
 * Single chat message item
 */

import { Alert, Button, Space, Tag, Typography } from 'antd';
import { LinkOutlined, RollbackOutlined } from '@ant-design/icons';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';

const { Text, Paragraph } = Typography;

interface ChatMessageItemProps {
  msg: ChatMessage;
  roleLabel: string;
  side: 'left' | 'right' | 'center';
  isGroupStart: boolean;
  isGroupEnd: boolean;
  showDayDivider: boolean;
  currentDay: string;
  linkUrl: string;
  replyTargetContent: string | null;
  disableSendMessage: boolean;
  onReply: (msg: ChatMessage) => void;
  onAnchorTarget: (targetId: string) => void;
  setMessageAnchor: (messageId: string, opts?: { replace?: boolean }) => void;
  getVisibilityScopeLabel: (scope: string | null | undefined) => string;
  getMessageTypeLabel: (type: string | null | undefined) => string;
  getAiStrategyLabel: (strategy: string | null | undefined) => string;
  isReplyTarget: boolean;
  isHighlighted: boolean;
}

export default function ChatMessageItem({
  msg,
  roleLabel,
  side,
  isGroupStart,
  isGroupEnd,
  showDayDivider,
  currentDay,
  linkUrl,
  replyTargetContent,
  disableSendMessage,
  onReply,
  onAnchorTarget,
  setMessageAnchor,
  getVisibilityScopeLabel,
  getMessageTypeLabel,
  getAiStrategyLabel,
  isReplyTarget,
  isHighlighted,
}: ChatMessageItemProps) {
  const anchorId = `msg-${msg.id}`;

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(msg);
  };

  const handleCopyLinkClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessageAnchor(msg.id, { replace: true });
    if (linkUrl) await copyToClipboard(linkUrl);
  };

  const handleReplyPreviewClick = () => {
    const targetId = msg.reply_to_message_id!;
    setMessageAnchor(targetId, { replace: true });
    onAnchorTarget(targetId);
  };

  const handleReplyPreviewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const targetId = msg.reply_to_message_id!;
      setMessageAnchor(targetId, { replace: true });
      onAnchorTarget(targetId);
    }
  };

  const actionButtons = msg.message_type !== 'safety_notice' ? (
    <>
      <Button
        size="small"
        type="text"
        icon={<RollbackOutlined />}
        disabled={disableSendMessage}
        aria-label={t('chat.reply')}
        onClick={handleReplyClick}
      >
        {isGroupStart ? t('chat.reply') : undefined}
      </Button>
      <Button
        size="small"
        type="text"
        icon={<LinkOutlined />}
        aria-label={t('chat.copyLink')}
        onClick={handleCopyLinkClick}
      >
        {isGroupStart ? t('chat.copyLink') : undefined}
      </Button>
    </>
  ) : null;

  return (
    <div>
      {showDayDivider ? (
        <div className="chat-room-page__date-divider">
          <Text type="secondary">{currentDay}</Text>
        </div>
      ) : null}

      <div className={`chat-room-page__message-row chat-room-page__message-row--${side}`}>
        <div
          id={anchorId}
          className={[
            'chat-room-page__message-item',
            `chat-room-page__message-item--${side}`,
            msg.message_type === 'safety_notice' ? 'chat-room-page__message-item--safety' : null,
            isReplyTarget ? 'chat-room-page__message-item--reply-target' : null,
            isHighlighted ? 'chat-room-page__message-item--reply-target' : null,
            !isGroupStart ? 'chat-room-page__message-item--grouped' : null,
          ].filter(Boolean).join(' ')}
        >
          {isGroupStart ? (
            <div className="chat-room-page__message-head">
              <Space size={6} wrap align="center">
                <Tag color="default">{roleLabel}</Tag>
                <Tag color="purple">{getVisibilityScopeLabel(msg.visibility_scope)}</Tag>
                {(msg.message_type !== 'user_text' || msg.ai_strategy) ? (
                  <span className="chat-room-page__message-strategy">
                    {msg.message_type !== 'user_text' ? getMessageTypeLabel(msg.message_type) : ''}
                    {msg.message_type !== 'user_text' && msg.ai_strategy ? ' · ' : ''}
                    {msg.ai_strategy ? getAiStrategyLabel(msg.ai_strategy) : ''}
                  </span>
                ) : null}
              </Space>
              <div className="chat-room-page__message-actions">
                {actionButtons}
              </div>
            </div>
          ) : (
            <div className="chat-room-page__message-actions chat-room-page__message-actions--floating">
              {actionButtons}
            </div>
          )}

          {msg.reply_to_message_id ? (
            <div
              className="chat-room-page__reply-preview"
              role="button"
              tabIndex={0}
              onClick={handleReplyPreviewClick}
              onKeyDown={handleReplyPreviewKeyDown}
            >
              <Text type="secondary">{t('chat.replyReference')}</Text>
              <Paragraph className="chat-room-page__reply-preview-content">
                {replyTargetContent ?? t('chat.replyReferenceMissing')}
              </Paragraph>
            </div>
          ) : null}

          {msg.message_type === 'safety_notice' ? (
            <Alert
              type="warning"
              showIcon
              title={t('chat.safetyMessageTitle')}
              description={msg.content}
            />
          ) : (
            <Paragraph className="chat-room-page__message-content">{msg.content}</Paragraph>
          )}

          {isGroupEnd ? (
            <div className="chat-room-page__message-foot">
              <Text type="secondary">{new Date(msg.created_at).toLocaleString()}</Text>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
