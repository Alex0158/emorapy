import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/utils/i18n';
import ChatContextBoundaryPanel from './ChatContextBoundaryPanel';
import ChatConversationLaneTabs from './ChatConversationLaneTabs';

describe('Chat context controls keyboard behavior', () => {
  it('conversation tabs 支援 ArrowRight 切換 lane', async () => {
    setLocale('en-US');
    const onLaneChange = vi.fn();
    render(
      <ChatConversationLaneTabs
        activeLane="private"
        sharedDisabled={false}
        sharedReadOnly={false}
        onLaneChange={onLaneChange}
      />,
    );

    const user = userEvent.setup();
    const privateTab = screen.getByRole('tab', { name: /Me and AI/i });
    await user.click(privateTab);
    onLaneChange.mockClear();
    await user.keyboard('{ArrowRight}');

    expect(onLaneChange).toHaveBeenCalledWith('shared');
  });

  it('private-context radio group 支援 ArrowDown 切換 mode', async () => {
    setLocale('en-US');
    const onModeChange = vi.fn();
    render(
      <ChatContextBoundaryPanel
        activeLane="private"
        mode="private_only"
        loading={false}
        saving={false}
        unavailable={false}
        adaptationDecision="not_set"
        roomAdaptation={null}
        onRetry={vi.fn()}
        onAdaptationDecisionChange={vi.fn()}
        onModeChange={onModeChange}
      />,
    );

    const user = userEvent.setup();
    const privateOnly = screen.getByRole('radio', { name: /Private support only/i });
    await user.click(privateOnly);
    onModeChange.mockClear();
    await user.keyboard('{ArrowDown}');
    const processControls = screen.getByRole('radio', { name: /Improve the shared process/i });
    expect(processControls).toHaveFocus();
    await user.keyboard(' ');

    expect(onModeChange).toHaveBeenCalledWith('shared_process_controls');
  });

  it('shared adaptation 以獨立 radio decision 呈現，並顯示全員進度', async () => {
    setLocale('en-US');
    const onDecision = vi.fn();
    render(
      <ChatContextBoundaryPanel
        activeLane="shared"
        mode="shared_process_controls"
        loading={false}
        saving={false}
        unavailable={false}
        adaptationDecision="not_set"
        roomAdaptation={{
          policy_version: '2026-07-13.adaptation-v1',
          enabled: false,
          active_participant_count: 2,
          accepted_participant_count: 1,
          owner_opt_in_count: 1,
        }}
        onRetry={vi.fn()}
        onAdaptationDecisionChange={onDecision}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Accepted by 1 of 2 participants/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {
      name: /Accept anonymous process adjustments/i,
    }));
    expect(onDecision).toHaveBeenCalledWith('accepted');
  });

  it('載入設定失敗時不顯示可誤操作的 mode，並提供重試', async () => {
    const onRetry = vi.fn();
    render(
      <ChatContextBoundaryPanel
        activeLane="private"
        mode="private_only"
        loading={false}
        saving={false}
        unavailable
        adaptationDecision="not_set"
        roomAdaptation={null}
        onRetry={onRetry}
        onAdaptationDecisionChange={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Private-context settings could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
