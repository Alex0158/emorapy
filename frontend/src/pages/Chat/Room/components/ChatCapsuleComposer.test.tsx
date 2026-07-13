import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/types/chat';
import { setLocale } from '@/utils/i18n';
import ChatCapsuleComposer from './ChatCapsuleComposer';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/api/chat', () => ({
  createChatContextCapsule: (...args: unknown[]) => mocks.create(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

describe('ChatCapsuleComposer', () => {
  it('只建立 private draft，不會在同一 mutation 自動擴大 audience', async () => {
    setLocale('en-US');
    mocks.create.mockResolvedValue({ id: 'capsule-1', status: 'draft' });
    const onSaved = vi.fn();
    const messages = [{
      id: 'message-1',
      room_id: 'room-1',
      channel_id: 'private-1',
      sender_participant_id: 'participant-a',
      content: 'A private source',
      message_type: 'user_text',
      visibility_scope: 'owner_only',
      ai_context_eligible: true,
      safety_flag: false,
      created_at: '2026-07-13T00:00:00.000Z',
    }] as ChatMessage[];

    render(
      <ChatCapsuleComposer
        roomId="room-1"
        privateChannelId="private-1"
        messages={messages}
        onSaved={onSaved}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prepare something to share' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(mocks.create).toHaveBeenCalledWith('room-1', {
      source_channel_id: 'private-1',
      source_message_ids: ['message-1'],
      summary: 'A private source',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith('Shareable draft saved privately; it is not in use yet');
  });
});
