/**
 * Chat message input and visibility selector
 */

import { Alert, Button, Input, Select, Space } from 'antd';
import { t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';

interface ChatMessageComposerProps {
  visibilityScope: 'all' | 'owner_only' | 'summary_only';
  onVisibilityScopeChange: (value: 'all' | 'owner_only' | 'summary_only') => void;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  disableSend: boolean;
  sending: boolean;
  onSend: () => void;
}

export default function ChatMessageComposer({
  visibilityScope,
  onVisibilityScopeChange,
  messageInput,
  onMessageInputChange,
  replyTo,
  onClearReply,
  disableSend,
  sending,
  onSend,
}: ChatMessageComposerProps) {
  return (
    <>
      {replyTo ? (
        <Alert
          type="info"
          showIcon
          title={t('chat.replyingTo')}
          description={replyTo.content}
          closable
          onClose={onClearReply}
        />
      ) : null}

      <Space style={{ width: '100%', marginBottom: 8 }}>
        <Select
          value={visibilityScope}
          onChange={onVisibilityScopeChange}
          options={[
            { value: 'all', label: t('chat.visibility.all') },
            { value: 'summary_only', label: t('chat.visibility.summary_only') },
            { value: 'owner_only', label: t('chat.visibility.owner_only') },
          ]}
          style={{ width: 180 }}
        />
      </Space>

      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={messageInput}
          maxLength={2000}
          onChange={(e) => onMessageInputChange(e.target.value)}
          onPressEnter={onSend}
          placeholder={t('chat.messagePlaceholder')}
        />
        <Button type="primary" disabled={disableSend} loading={sending} onClick={onSend}>
          {t('chat.send')}
        </Button>
      </Space.Compact>
    </>
  );
}
