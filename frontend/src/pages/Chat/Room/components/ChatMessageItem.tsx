/**
 * Single chat message item
 */

import { Reply, Link2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';

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
  msg, roleLabel, side, isGroupStart, isGroupEnd, showDayDivider, currentDay,
  linkUrl, replyTargetContent, disableSendMessage, onReply, onAnchorTarget,
  setMessageAnchor, getVisibilityScopeLabel, getMessageTypeLabel, getAiStrategyLabel,
  isReplyTarget, isHighlighted,
}: ChatMessageItemProps) {
  const anchorId = `msg-${msg.id}`;

  const handleReplyClick = (e: React.MouseEvent) => { e.stopPropagation(); onReply(msg); };
  const handleCopyLinkClick = async (e: React.MouseEvent) => { e.stopPropagation(); setMessageAnchor(msg.id, { replace: true }); if (linkUrl) await copyToClipboard(linkUrl); };
  const handleReplyPreviewClick = () => { const targetId = msg.reply_to_message_id!; setMessageAnchor(targetId, { replace: true }); onAnchorTarget(targetId); };
  const handleReplyPreviewKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReplyPreviewClick(); } };

  const actionButtons = msg.message_type !== 'safety_notice' ? (
    <>
      <button type="button" disabled={disableSendMessage} aria-label={t('chat.reply')} onClick={handleReplyClick} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50">
        <Reply className="size-3" />{isGroupStart ? t('chat.reply') : null}
      </button>
      <button type="button" aria-label={t('chat.copyLink')} onClick={handleCopyLinkClick} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent">
        <Link2 className="size-3" />{isGroupStart ? t('chat.copyLink') : null}
      </button>
    </>
  ) : null;

  return (
    <div>
      {showDayDivider && <div className="chat-room-page__date-divider"><span className="text-xs text-muted-foreground">{currentDay}</span></div>}

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
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{roleLabel}</Badge>
                <Badge variant="outline" className="text-[10px]">{getVisibilityScopeLabel(msg.visibility_scope)}</Badge>
                {(msg.message_type !== 'user_text' || msg.ai_strategy) && (
                  <span className="text-[10px] text-muted-foreground">
                    {msg.message_type !== 'user_text' ? getMessageTypeLabel(msg.message_type) : ''}
                    {msg.message_type !== 'user_text' && msg.ai_strategy ? ' · ' : ''}
                    {msg.ai_strategy ? getAiStrategyLabel(msg.ai_strategy) : ''}
                  </span>
                )}
              </div>
              <div className="chat-room-page__message-actions">{actionButtons}</div>
            </div>
          ) : (
            <div className="chat-room-page__message-actions chat-room-page__message-actions--floating">{actionButtons}</div>
          )}

          {msg.reply_to_message_id && (
            <div className="chat-room-page__reply-preview" role="button" tabIndex={0} onClick={handleReplyPreviewClick} onKeyDown={handleReplyPreviewKeyDown}>
              <span className="text-xs text-muted-foreground">{t('chat.replyReference')}</span>
              <p className="chat-room-page__reply-preview-content text-xs">{replyTargetContent ?? t('chat.replyReferenceMissing')}</p>
            </div>
          )}

          {msg.message_type === 'safety_notice' ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <AlertTriangle className="size-4 mt-0.5 text-warning shrink-0" />
              <div><p className="text-xs font-medium text-foreground">{t('chat.safetyMessageTitle')}</p><p className="text-xs text-muted-foreground mt-1">{msg.content}</p></div>
            </div>
          ) : (
            <p className="chat-room-page__message-content">{msg.content}</p>
          )}

          {isGroupEnd && <div className="chat-room-page__message-foot"><span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</span></div>}
        </div>
      </div>
    </div>
  );
}
