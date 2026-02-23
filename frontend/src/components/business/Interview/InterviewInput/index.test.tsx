/**
 * InterviewInput 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InterviewInput from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('InterviewInput', () => {
  it('應渲染 textarea 和送出按鈕', () => {
    render(<InterviewInput onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('interview.send')).toBeInTheDocument();
  });

  it('輸入文字後點擊送出應呼叫 onSend 並清空輸入', () => {
    const onSend = vi.fn();
    render(<InterviewInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByText('interview.send'));
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('空白輸入不應觸發 onSend', () => {
    const onSend = vi.fn();
    render(<InterviewInput onSend={onSend} />);
    fireEvent.click(screen.getByText('interview.send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('isStreaming 且有 onStop 時應顯示停止按鈕', () => {
    const onStop = vi.fn();
    render(<InterviewInput onSend={vi.fn()} onStop={onStop} isStreaming />);
    expect(screen.getByText('interview.stop')).toBeInTheDocument();
    fireEvent.click(screen.getByText('interview.stop'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('有 onSkip 且非 streaming 時應顯示跳過按鈕', () => {
    const onSkip = vi.fn();
    render(<InterviewInput onSend={vi.fn()} onSkip={onSkip} />);
    expect(screen.getByText('interview.skip')).toBeInTheDocument();
    fireEvent.click(screen.getByText('interview.skip'));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('Enter 鍵應觸發送出', () => {
    const onSend = vi.fn();
    render(<InterviewInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('test');
  });

  it('Shift+Enter 不應觸發送出', () => {
    const onSend = vi.fn();
    render(<InterviewInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('placeholder 應正確顯示', () => {
    render(<InterviewInput onSend={vi.fn()} placeholder="自定義提示" />);
    expect(screen.getByPlaceholderText('自定義提示')).toBeInTheDocument();
  });
});
