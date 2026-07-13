/**
 * Chat message list with Virtuoso - virtualized scroll, history load, anchor, streaming
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Virtuoso, type ListRange, type VirtuosoHandle } from 'react-virtuoso';
import { getLocale, t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';
import type { AIStreamDraft } from '@/utils/aiStreamState';
import { getMessageSide, getGroupKey, getIsGroupStart, getIsGroupEnd, shouldShowDayDivider } from '../utils/chatMessageHelpers';
import ChatMessageItem from './ChatMessageItem';
import ChatStreamingBubble from './ChatStreamingBubble';

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
  setReplyTo: (msg: ChatMessage | null) => void;
  hasUnread: boolean;
  jumpBackState: { originMessageId: string | null; wasAtBottom: boolean } | null;
  onJumpBack: () => void;
  onDismissJumpBack: () => void;
  onJumpToLatest: () => void;
  emptyMessageKey?: string;
}

export default function ChatMessageList({
  messages, firstItemIndex, virtuosoRef, messagesContainerRef, onRangeChanged, onAtBottomChange, onStartReached,
  canRequestMoreHistory, canLoadMoreHistory, loadingMoreHistory, historyBlockedByCache, onLoadMoreHistory,
  aiDraft, currentHrefWithoutHash, messageById, replyTo, highlightMessageId, disableSendMessage,
  setMessageAnchor, handleAnchorTarget, getRoleLabel, getVisibilityScopeLabel,
  setReplyTo, hasUnread, jumpBackState, onJumpBack, onDismissJumpBack, onJumpToLatest,
  emptyMessageKey = 'chat.emptyMessages',
}: ChatMessageListProps) {
  return (
    <div className="chat-room-page__messages" role="log" aria-label={t('chat.messagesLogAria')}>
      {messages.length === 0 ? (
        <div className="chat-room-page__messages-empty"><span className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">{t(emptyMessageKey)}</span></div>
      ) : (
        <>
          <Virtuoso
            ref={virtuosoRef}
            className="chat-room-page__virtuoso"
            style={{ height: '100%' }}
            data={messages}
            firstItemIndex={firstItemIndex}
            computeItemKey={(_index, item) => (item as ChatMessage).id}
            scrollerRef={(node) => { (messagesContainerRef as React.MutableRefObject<HTMLElement | null>).current = node instanceof HTMLElement ? node : null; }}
            rangeChanged={onRangeChanged}
            atBottomStateChange={onAtBottomChange}
            startReached={onStartReached}
            followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
            components={{
              Header: () => canRequestMoreHistory ? (
                <div className="chat-room-page__history-bar">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" disabled={!canLoadMoreHistory || loadingMoreHistory} onClick={onLoadMoreHistory}>
                      {loadingMoreHistory && <Loader2 className="size-3 animate-spin" />}{t('chat.loadMore')}
                    </Button>
                    {historyBlockedByCache && <span className="text-xs text-muted-foreground">{t('chat.historyCacheFullHint')}</span>}
                  </div>
                </div>
              ) : null,
              Footer: () => (
                <div style={{ padding: '0 12px' }}>
                  {aiDraft && <ChatStreamingBubble text={aiDraft.text} status={aiDraft.status} />}
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
              const isGroupStart = getIsGroupStart(msg, prev, prev ? getGroupKey(prev) : null, groupKey);
              const isGroupEnd = getIsGroupEnd(msg, next, next ? getGroupKey(next) : null, groupKey);
              const locale = getLocale();
              const showDayDivider = shouldShowDayDivider(msg, prev, locale);
              const currentDay = new Date(msg.created_at).toLocaleDateString(locale);
              const anchorId = `msg-${msg.id}`;
              const linkUrl = currentHrefWithoutHash ? `${currentHrefWithoutHash}#${anchorId}` : '';
              const replyTargetContent = messageById.get(msg.reply_to_message_id ?? '')?.content ?? null;
              return <ChatMessageItem key={msg.id} msg={msg} roleLabel={roleLabel} side={side} isGroupStart={isGroupStart} isGroupEnd={isGroupEnd} showDayDivider={showDayDivider} currentDay={currentDay} linkUrl={linkUrl} replyTargetContent={replyTargetContent} disableSendMessage={disableSendMessage} onReply={setReplyTo} onAnchorTarget={handleAnchorTarget} setMessageAnchor={setMessageAnchor} getVisibilityScopeLabel={getVisibilityScopeLabel} isReplyTarget={replyTo?.id === msg.id} isHighlighted={highlightMessageId === msg.id} />;
            }}
          />
          {(hasUnread || jumpBackState) && (
            <div className="chat-room-page__bottom-bar">
              <div className="chat-room-page__bottom-bar-left">
                {jumpBackState && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onJumpBack}>{t('chat.jumpBack')}</Button>
                    <button type="button" aria-label={t('chat.dismiss')} onClick={onDismissJumpBack} className="text-muted-foreground hover:text-foreground text-lg">×</button>
                  </div>
                )}
              </div>
              <div className="chat-room-page__bottom-bar-right">
                {hasUnread && <Button size="sm" onClick={onJumpToLatest}>{t('chat.jumpToLatest')}</Button>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
