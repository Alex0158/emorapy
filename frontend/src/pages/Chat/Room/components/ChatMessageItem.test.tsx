import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLocale } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';
import ChatMessageItem from './ChatMessageItem';

vi.mock('@/utils/copyToClipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const baseMessage: ChatMessage = {
  id: 'msg-1',
  room_id: 'room-1',
  sender_participant_id: 'participant-1',
  reply_to_message_id: 'msg-0',
  content: '這是目前的訊息內容',
  message_type: 'user_text',
  visibility_scope: 'all',
  safety_flag: false,
  created_at: '2026-04-05T00:00:00.000Z',
  sender_participant: {
    id: 'participant-1',
    room_id: 'room-1',
    participant_type: 'user',
    role_in_room: 'roleA',
    joined_at: '2026-04-05T00:00:00.000Z',
    is_active: true,
  },
};

describe('ChatMessageItem', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  it('reply preview 是 native button，並可用鍵盤觸發', async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    const onAnchorTarget = vi.fn();
    const setMessageAnchor = vi.fn();

    render(
      <ChatMessageItem
        msg={baseMessage}
        roleLabel="A 方"
        side="left"
        isGroupStart
        isGroupEnd
        showDayDivider={false}
        currentDay="2026/04/05"
        linkUrl="/chat/room/room-1#msg-1"
        replyTargetContent="被引用的內容"
        disableSendMessage={false}
        onReply={onReply}
        onAnchorTarget={onAnchorTarget}
        setMessageAnchor={setMessageAnchor}
        getVisibilityScopeLabel={() => '全部'}
        isReplyTarget={false}
        isHighlighted={false}
      />,
    );

    const previewButton = screen.getByRole('button', { name: /引用/ });
    previewButton.focus();
    expect(previewButton).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(setMessageAnchor).toHaveBeenCalledWith('msg-0', { replace: true });
      expect(onAnchorTarget).toHaveBeenCalledWith('msg-0');
    });
  });

  it('對話氣泡不暴露 AI strategy 或原始 message type', () => {
    render(
      <ChatMessageItem
        msg={{ ...baseMessage, message_type: 'ai_mediation', ai_strategy: 'reflective_listening' }}
        roleLabel="調解員"
        side="center"
        isGroupStart
        isGroupEnd
        showDayDivider={false}
        currentDay="2026/04/05"
        linkUrl=""
        replyTargetContent={null}
        disableSendMessage={false}
        onReply={vi.fn()}
        onAnchorTarget={vi.fn()}
        setMessageAnchor={vi.fn()}
        getVisibilityScopeLabel={() => '全部'}
        isReplyTarget={false}
        isHighlighted={false}
      />,
    );
    expect(screen.queryByText('ai_mediation')).not.toBeInTheDocument();
    expect(screen.queryByText('reflective_listening')).not.toBeInTheDocument();
  });
});
