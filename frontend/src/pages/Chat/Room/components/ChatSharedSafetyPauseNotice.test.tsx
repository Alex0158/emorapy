import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/utils/i18n';
import ChatSharedSafetyPauseNotice from './ChatSharedSafetyPauseNotice';

describe('ChatSharedSafetyPauseNotice', () => {
  beforeEach(() => setLocale('zh-TW'));

  it('shows a source-free pause and routes the user to their private lane', () => {
    const onSwitchToPrivate = vi.fn();
    render(
      <ChatSharedSafetyPauseNotice
        loading={false}
        status="paused"
        unavailable={false}
        onSwitchToPrivate={onSwitchToPrivate}
      />,
    );

    expect(screen.getByText('共同對話暫時停一停')).toBeInTheDocument();
    expect(screen.getByText(/不會顯示暫停原因/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '前往「我與 AI」' }));
    expect(onSwitchToPrivate).toHaveBeenCalledTimes(1);
  });

  it('fails closed with neutral copy when the sanitized status is unavailable', () => {
    render(
      <ChatSharedSafetyPauseNotice
        loading={false}
        status={null}
        unavailable
        onSwitchToPrivate={vi.fn()}
      />,
    );

    expect(screen.getByText('暫時無法確認共同對話狀態')).toBeInTheDocument();
    expect(screen.getByText(/不代表任何一方做錯/)).toBeInTheDocument();
  });
});
