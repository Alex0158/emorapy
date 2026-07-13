import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/utils/i18n';
import ChatTrustCheckpoint from './ChatTrustCheckpoint';

describe('ChatTrustCheckpoint', () => {
  it('先說明三個資料邊界，選擇後才提交 adaptation decision', async () => {
    setLocale('zh-TW');
    const onDecision = vi.fn();
    render(<ChatTrustCheckpoint open saving={false} onDecision={onDecision} />);

    expect(screen.getByText('共同對話')).toBeInTheDocument();
    expect(screen.getByText('我與 AI')).toBeInTheDocument();
    expect(screen.getByText('正式梳理')).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: '確認並進入共同對話' });
    expect(continueButton).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /只使用通用調解方式/ }));
    expect(onDecision).not.toHaveBeenCalled();
    await userEvent.click(continueButton);
    expect(onDecision).toHaveBeenCalledWith('declined');
  });
});
