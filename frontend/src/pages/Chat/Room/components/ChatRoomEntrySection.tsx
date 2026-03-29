/**
 * Chat room entry section - create room and join by invite code
 */

import { Alert, Button, Input, Select } from 'antd';
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
  errorText,
  visibilityMode,
  onVisibilityModeChange,
  inviteCodeInput,
  onInviteCodeInputChange,
  creatingRoom,
  joiningInvite,
  decliningInvite,
  onCreateRoom,
  onAcceptInvite,
  onDeclineInvite,
}: ChatRoomEntrySectionProps) {
  return (
    <div className="chat-room-entry">
      <div className="chat-room-entry__ambient">
        <div className="chat-room-entry__orb chat-room-entry__orb--1" />
        <div className="chat-room-entry__orb chat-room-entry__orb--2" />
        <div className="chat-room-entry__orb chat-room-entry__orb--3" />
        <div className="chat-room-entry__vignette" aria-hidden />
      </div>
      <div className="chat-room-entry__panel">
        <header className="chat-room-entry__header">
          <h1 className="chat-room-entry__title">{t('chat.title')}</h1>
          <p className="chat-room-entry__subtitle">{t('chat.subtitle')}</p>
        </header>
        {errorText ? (
          <Alert
            type="error"
            showIcon
            title={errorText}
            className="chat-room-entry__alert"
          />
        ) : null}
        <section className="chat-room-entry__create" aria-labelledby="chat-create-heading">
          <h2 id="chat-create-heading" className="chat-room-entry__section-title">
            {t('chat.createRoom')}
          </h2>
          <div className="chat-room-entry__create-actions">
            <Select
              value={visibilityMode}
              onChange={(value) => onVisibilityModeChange(value)}
              options={[
                { value: 'share_full_history', label: t('chat.visibility.share_full_history') },
                { value: 'share_summary_only', label: t('chat.visibility.share_summary_only') },
                { value: 'share_from_join_time', label: t('chat.visibility.share_from_join_time') },
              ]}
              className="chat-room-entry__visibility-select"
            />
            <Button
              type="primary"
              size="large"
              loading={creatingRoom}
              onClick={onCreateRoom}
              className="chat-room-entry__cta"
            >
              {t('chat.createRoom')}
            </Button>
          </div>
        </section>
        <div className="chat-room-entry__divider" aria-hidden />
        <section className="chat-room-entry__join" aria-labelledby="chat-join-heading">
          <h2 id="chat-join-heading" className="chat-room-entry__section-title">
            {t('chat.joinByInvite')}
          </h2>
          <div className="chat-room-entry__join-row">
            <Input
              value={inviteCodeInput}
              onChange={(e) => onInviteCodeInputChange(e.target.value)}
              placeholder={t('chat.inviteCodePlaceholder')}
              className="chat-room-entry__invite-input"
              size="large"
            />
            <div className="chat-room-entry__join-btns">
              <Button
                type="primary"
                ghost
                size="large"
                loading={joiningInvite}
                onClick={onAcceptInvite}
              >
                {t('chat.joinByInvite')}
              </Button>
              <Button
                size="large"
                loading={decliningInvite}
                onClick={onDeclineInvite}
                className="chat-room-entry__decline-btn"
              >
                {t('chat.declineInvite')}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
