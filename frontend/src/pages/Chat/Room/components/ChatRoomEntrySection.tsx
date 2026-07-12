/**
 * Chat room entry section - create room and join by invite code
 */

import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/utils/i18n';
import type { ChatHistoryVisibilityMode } from '@/types/chat';

interface ChatRoomEntrySectionProps {
  errorText: string;
  visibilityMode: ChatHistoryVisibilityMode;
  onVisibilityModeChange: (value: ChatHistoryVisibilityMode) => void;
  inviteCodeInput: string;
  onInviteCodeInputChange: (value: string) => void;
  creatingRoom: boolean;
  joiningInvite: boolean;
  decliningInvite: boolean;
  onCreateRoom: () => void;
  onAcceptInvite: () => void;
  onDeclineInvite: () => void;
}

export default function ChatRoomEntrySection({
  errorText, visibilityMode, onVisibilityModeChange, inviteCodeInput, onInviteCodeInputChange,
  creatingRoom, joiningInvite, decliningInvite, onCreateRoom, onAcceptInvite, onDeclineInvite,
}: ChatRoomEntrySectionProps) {
  return (
    <div className="chat-room-entry">
      <div className="chat-room-entry__panel">
        <header className="chat-room-entry__header">
          <h1 className="chat-room-entry__title">{t('chat.title')}</h1>
          <p className="chat-room-entry__subtitle">{t('chat.subtitle')}</p>
        </header>
        {errorText && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-4">
            <AlertCircle className="size-4 mt-0.5 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{errorText}</p>
          </div>
        )}
        <section className="chat-room-entry__create" aria-labelledby="chat-create-heading">
          <h2 id="chat-create-heading" className="chat-room-entry__section-title">{t('chat.createRoom')}</h2>
          <div className="chat-room-entry__create-actions">
            <Select value={visibilityMode} onValueChange={(v: string) => onVisibilityModeChange(v as ChatHistoryVisibilityMode)}>
              <SelectTrigger className="chat-room-entry__visibility-select w-[220px]" aria-label={t('chat.visibility.label')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="share_full_history">{t('chat.visibility.share_full_history')}</SelectItem>
                <SelectItem value="share_summary_only">{t('chat.visibility.share_summary_only')}</SelectItem>
                <SelectItem value="share_from_join_time">{t('chat.visibility.share_from_join_time')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="lg"
              disabled={creatingRoom}
              onClick={onCreateRoom}
              className="min-h-11 rounded-lg text-base font-medium shadow-none"
            >
              {creatingRoom && <Loader2 className="size-4 animate-spin" />}{t('chat.createRoom')}
            </Button>
          </div>
        </section>
        <div className="chat-room-entry__divider" aria-hidden />
        <section className="chat-room-entry__join" aria-labelledby="chat-join-heading">
          <h2 id="chat-join-heading" className="chat-room-entry__section-title">{t('chat.joinByInvite')}</h2>
          <div className="chat-room-entry__join-row">
            <div className="chat-room-entry__invite-field">
              <Label htmlFor="chat-invite-code">{t('chat.inviteCodeInputLabel')}</Label>
              <Input
                id="chat-invite-code"
                value={inviteCodeInput}
                onChange={(e) => onInviteCodeInputChange(e.target.value)}
                placeholder={t('chat.inviteCodePlaceholder')}
                className="h-auto rounded-lg border-border bg-background px-4 py-3 text-base hover:border-primary/30 focus-visible:border-primary"
                autoComplete="off"
              />
            </div>
            <div className="chat-room-entry__join-btns">
              <Button variant="outline" size="lg" disabled={joiningInvite} onClick={onAcceptInvite}>
                {joiningInvite && <Loader2 className="size-4 animate-spin" />}{t('chat.joinByInvite')}
              </Button>
              <Button variant="ghost" size="lg" disabled={decliningInvite} onClick={onDeclineInvite}>
                {t('chat.declineInvite')}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
