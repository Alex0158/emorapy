import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '@/utils/i18n';
import ListeningDemo from './ListeningDemo';

describe('ListeningDemo', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  it('應顯示對話流與 Emorapy 梳理標註', () => {
    render(<ListeningDemo />);

    expect(screen.getByText('拖動時間線，看 Emorapy 怎麼聽見一句話底下的意思。')).toBeInTheDocument();
    expect(screen.getByText('碗盤還在水槽裡')).toBeInTheDocument();
    expect(screen.getByText('Emorapy · 聽見 12:14')).toBeInTheDocument();
    expect(screen.getByText('這一輪我已經放棄被理解。')).toBeInTheDocument();
  });

  it('拖動時間線時會更新訊息與梳理數', async () => {
    render(<ListeningDemo />);

    const scrubber = screen.getByRole('slider', { name: '拖動對話時間線' });
    fireEvent.change(scrubber, { target: { value: '2' } });

    expect(screen.getByText('2 則訊息 · 1 個梳理')).toBeInTheDocument();
  });
});
