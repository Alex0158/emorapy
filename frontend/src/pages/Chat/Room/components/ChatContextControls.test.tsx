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
});
