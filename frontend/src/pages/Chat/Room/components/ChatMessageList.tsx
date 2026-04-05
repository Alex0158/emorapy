/**
 * Chat message list with Virtuoso - virtualized scroll, history load, anchor, streaming
 */

import { Button, Space, Typography } from 'antd';
import { Virtuoso, type ListRange, type VirtuosoHandle } from 'react-virtuoso';
import { t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';
import type { AIStreamDraft } from '@/utils/aiStreamState';
import {
  getMessageSide,
  getGroupKey,
  getIsGroupStart,
  getIsGroupEnd,
  shouldShowDayDivider,
} from '../utils/chatMessageHelpers';
import ChatMessageItem from './ChatMessageItem';
import ChatStreamingBubble from './ChatStreamingBubble';

const { Text } = Typography;

interface ChatMessageListProps {
  messages: ChatMessage[];
  firstItemIndex: number;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  messagesContainerRef: React.RefObject<HTMLElement | null>;
  onRangeChanged: (range: ListRange) => void;
  onAtBottomChange: (atBottom: boolean) => void;
  onStartReached: () => void;
  canRequestMoreHistory: boolean;
  canLoadMoreHistory: boolean;
  loadingMoreHistory: boolean;
  historyBlockedByCache: boolean;
  onLoadMoreHistory: () => void;
  aiDraft: AIStreamDraft | null;
  currentHrefWithoutHash: string;
  messageById: Map<string, ChatMessage>;
  replyTo: ChatMessage | null;
  highlightMessageId: string | null;
  disableSendMessage: boolean;
  setMessageAnchor: (messageId: string, opts?: { replace?: boolean }) => void;
  handleAnchorTarget: (targetId: string) => void;
  getRoleLabel: (role: string | null | undefined) => string;
  getVisibilityScopeLabel: (scope: string | null | undefined) => string;
  getMessageTypeLabel: (type: string | null | undefined) => string;
  getAiStrategyLabel: (strategy: string | null | undefined) => string;
  setReplyTo: (msg: ChatMessage | null) => void;
  hasUnread: boolean;
  jumpBackState: { originMessageId: string | null; wasAtBottom: boolean } | null;
  onJumpBack: () => void;
  onDismissJumpBack: () => void;
  onJumpToLatest: () => void;
}

export default function ChatMessageList({
  messages,
  firstItemIndex,
  virtuosoRef,
  messagesContainerRef,
  onRangeChanged,
  onAtBottomChange,
  onStartReached,
  canRequestMoreHistory,
  canLoadMoreHistory,
  loadingMoreHistory,
  historyBlockedByCache,
  onLoadMoreHistory,
  aiDraft,
  currentHrefWithoutHash,
  messageById,
  replyTo,
  highlightMessageId,
  disableSendMessage,
  setMessageAnchor,
  handleAnchorTarget,
  getRoleLabel,
  getVisibilityScopeLabel,
  getMessageTypeLabel,
  getAiStrategyLabel,
  setReplyTo,
  hasUnread,
  jumpBackState,
  onJumpBack,
  onDismissJumpBack,
  onJumpToLatest,
}: ChatMessageListProps) {
  return (
    <div
      className="chat-room-page__messages"
      role="log"
      aria-label={t('chat.messagesLogAria')}
    >
      {messages.length === 0 ? (
        <div className="chat-room-page__messages-empty">
          <Text type="secondary">{t('chat.emptyMessages')}</Text>
        </div>
      ) : (
        <>
          <Virtuoso
            ref={virtuosoRef}
            className="chat-room-page__virtuoso"
            style={{ height: '100%' }}
            data={messages}
            firstItemIndex={firstItemIndex}
            computeItemKey={(_index, item) => (item as ChatMessage).id}
            scrollerRef={(node) => {
              (messagesContainerRef as React.MutableRefObject<HTMLElement | null>).current =
                node instanceof HTMLElement ? node : null;
            }}
            rangeChanged={onRangeChanged}
            atBottomStateChange={onAtBottomChange}
            startReached={onStartReached}
            followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
            components={{
              Header: () =>
                canRequestMoreHistory ? (
                  <div className="chat-room-page__history-bar">
                    <Space size={8} wrap>
                      <Button
                        size="small"
                        loading={loadingMoreHistory}
                        disabled={!canLoadMoreHistory}
                        onClick={onLoadMoreHistory}
                      >
                        {t('chat.loadMore')}
                      </Button>
                      {historyBlockedByCache ? (
                        <Text type="secondary">{t('chat.historyCacheFullHint')}</Text>
                      ) : null}
                    </Space>
                  </div>
                ) : null,
              Footer: () => (
                <div style={{ padding: '0 12px' }}>
                  {aiDraft ? (
                    <ChatStreamingBubble
                      text={aiDraft.text}
                      status={aiDraft.status}
                    />
                  ) : null}
                  <div style={{ height: 80 }} />
                </div>
              ),
            }}
            itemContent={(index, item) => {
              const list = messages;
              const msg = item as ChatMessage;
              const localIndex = index - firstItemIndex;

              const role = msg.sender_participant?.role_in_room ?? 'unknown';
              const roleLabel = getRoleLabel(role);
              const side = getMessageSide(msg);

              const prev = localIndex > 0 ? list[localIndex - 1] : null;
              const next = localIndex < list.length - 1 ? list[localIndex + 1] : null;
              const groupKey = getGroupKey(msg);
              const prevKey = prev ? getGroupKey(prev) : null;
              const nextKey = next ? getGroupKey(next) : null;
              const isGroupStart = getIsGroupStart(msg, prev, prevKey, groupKey);
              const isGroupEnd = getIsGroupEnd(msg, next, nextKey, groupKey);
              const showDayDivider = shouldShowDayDivider(msg, prev);
              const currentDay = new Date(msg.created_at).toLocaleDateString();
              const anchorId = `msg-${msg.id}`;
              const linkUrl = currentHrefWithoutHash ? `${currentHrefWithoutHash}#${anchorId}` : '';
              const replyTargetContent = messageById.get(msg.reply_to_message_id ?? '')?.content ?? null;

              return (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  roleLabel={roleLabel}
                  side={side}
                  isGroupStart={isGroupStart}
                  isGroupEnd={isGroupEnd}
                  showDayDivider={showDayDivider}
                  currentDay={currentDay}
                  linkUrl={linkUrl}
                  replyTargetContent={replyTargetContent}
                  disableSendMessage={disableSendMessage}
                  onReply={setReplyTo}
                  onAnchorTarget={handleAnchorTarget}
                  setMessageAnchor={setMessageAnchor}
                  getVisibilityScopeLabel={getVisibilityScopeLabel}
                  getMessageTypeLabel={getMessageTypeLabel}
                  getAiStrategyLabel={getAiStrategyLabel}
                  isReplyTarget={replyTo?.id === msg.id}
                  isHighlighted={highlightMessageId === msg.id}
                />
              );
            }}
          />

          {hasUnread || jumpBackState ? (
            <div className="chat-room-page__bottom-bar">
              <div className="chat-room-page__bottom-bar-left">
                {jumpBackState ? (
                  <Space size={8}>
                    <Button size="small" onClick={onJumpBack}>
                      {t('chat.jumpBack')}
                    </Button>
                    <Button size="small" type="text" aria-label={t('chat.dismiss')} onClick={onDismissJumpBack}>
                      ×
                    </Button>
                  </Space>
                ) : null}
              </div>
              <div className="chat-room-page__bottom-bar-right">
                {hasUnread ? (
                  <Button size="small" type="primary" onClick={onJumpToLatest}>
                    {t('chat.jumpToLatest')}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
