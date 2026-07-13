import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContextUsageReceipt } from '@/types/chat';
import { setLocale } from '@/utils/i18n';
import ChatContextUsageReceipts from './ChatContextUsageReceipts';

describe('ChatContextUsageReceipts', () => {
  it('只顯示低敏 category、數量、scope 與 policy version', async () => {
    setLocale('en-US');
    const receipt: ContextUsageReceipt = {
      scope: 'room_aggregate',
      purpose: 'shared_mediation_adaptation',
      decision: 'allowed',
      category: 'adaptation_use',
      source_type_counts: {
        chat_message: 0,
        context_capsule: 0,
        personal_memory: 0,
        joint_memory: 0,
        formal_evidence: 0,
      },
      authorization_count: 0,
      policy_version: 'chat-context-policy@v1',
      prompt_version: 'chat-mediation@v1',
      created_at: '2026-07-13T19:00:00.000Z',
    };
    const onRefresh = vi.fn();
    render(
      <ChatContextUsageReceipts
        error={false}
        loading={false}
        receipts={[receipt]}
        onRefresh={onRefresh}
      />,
    );

    await userEvent.click(screen.getByText('What was used this time'));
    expect(screen.getByText('Private background used only for process adjustment')).toBeInTheDocument();
    expect(screen.getByText('Room-level aggregate without owner or reason · Allowed or completed')).toBeInTheDocument();
    expect(screen.getByText('Policy version: chat-context-policy@v1')).toBeInTheDocument();
    expect(screen.queryByText(/participant|capsule-|hash|reason_code/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
