import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '@/utils/i18n';
import ListeningDemo from './ListeningDemo';

describe('ListeningDemo', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  it('初始只顯示對話開頭，不提前露出 Emorapy 梳理', () => {
    render(<ListeningDemo />);

    expect(screen.getByText('拖一下時間線，看 Emorapy 怎麼聽出話裡沒說完的意思。')).toBeInTheDocument();
    expect(screen.getByText('碗盤又放在水槽了')).toBeInTheDocument();
    expect(screen.queryByText('你每次都說明天')).not.toBeInTheDocument();
    expect(screen.queryByText('Emorapy · 聽見 12:14')).not.toBeInTheDocument();
    expect(screen.queryByText('我這輪已經不想再解釋了。')).not.toBeInTheDocument();
  });

  it('拖動時間線時才逐步顯示訊息與梳理數', async () => {
    render(<ListeningDemo />);

    const scrubber = screen.getByRole('slider', { name: '拖動對話時間線' });
    expect(scrubber).toHaveAttribute('max', '12');
    fireEvent.change(scrubber, { target: { value: '5' } });

    expect(screen.getByText('5 則訊息 · 1 個重點')).toBeInTheDocument();
    expect(screen.getByText('Emorapy · 聽見 12:14')).toBeInTheDocument();
    expect(screen.getByText('我這輪已經不想再解釋了。')).toBeInTheDocument();

    fireEvent.change(scrubber, { target: { value: '12' } });

    expect(screen.getByText('12 則訊息 · 4 個重點')).toBeInTheDocument();
    expect(screen.getByText('你還願不願意回來跟我好好說一次。')).toBeInTheDocument();
  });
});
