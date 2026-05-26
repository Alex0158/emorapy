import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '@/types/chat';
import ChatMessageComposer from './ChatMessageComposer';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));

const replyTo: ChatMessage = {
  id: 'msg-1',
  room_id: 'room-1',
  sender_participant_id: 'participant-1',
  content: '需要回覆的訊息',
  message_type: 'user_text',
  visibility_scope: 'all',
  safety_flag: false,
  created_at: '2026-04-05T00:00:00.000Z',
};

describe('ChatMessageComposer', () => {
  it('reply clear icon button has an accessible name', async () => {
    const user = userEvent.setup();
    const onClearReply = vi.fn();

    render(
      <ChatMessageComposer
        visibilityScope="all"
        onVisibilityScopeChange={vi.fn()}
        messageInput=""
        onMessageInputChange={vi.fn()}
        replyTo={replyTo}
        onClearReply={onClearReply}
        disableSend={false}
        sending={false}
        onSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'chat.dismiss' }));

    expect(onClearReply).toHaveBeenCalledOnce();
  });
});
