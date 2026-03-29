/**
 * FileUpload 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from './index';
import { deleteEvidence } from '@/services/api/case';

const mockMessageError = vi.fn();

vi.mock('@/services/api/case', () => ({
  uploadEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
  getCase: vi.fn(),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: { ...actual.message, error: (...args: unknown[]) => mockMessageError(...args) },
  };
});

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應渲染上傳區域', () => {
    render(<FileUpload />);
    expect(screen.getByText('fileUpload.uploadBtn')).toBeInTheDocument();
  });

  it('disabled 時應禁用上傳', () => {
    render(<FileUpload disabled />);
    const upload = document.querySelector('.ant-upload-disabled');
    expect(upload).toBeInTheDocument();
  });

  it('應支援 value 與 onChange', () => {
    const onChange = vi.fn();
    render(<FileUpload value={[]} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('caseId 時刪除證據應二次確認，確認後呼叫 deleteEvidence 並更新列表（F03 證據刪除流程）', async () => {
    const onChange = vi.fn();
    const fileWithEvidence = {
      uid: 'e1',
      name: 'photo.jpg',
      status: 'done' as const,
      response: { id: 'ev1' },
    };
    vi.mocked(deleteEvidence).mockResolvedValue(undefined);

    render(<FileUpload caseId="c1" value={[fileWithEvidence]} onChange={onChange} />);

    const removeBtn = screen.getByTitle('Remove file');
    await userEvent.click(removeBtn);

    expect(screen.getByText('fileUpload.confirmRemoveTitle')).toBeInTheDocument();
    const confirmBtn = await screen.findByRole('button', { name: 'common.confirm' });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteEvidence).toHaveBeenCalledWith('c1', 'ev1', undefined);
    });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('deleteEvidence 失敗時應顯示錯誤且不更新列表（F03 證據刪除錯誤處理）', async () => {
    const onChange = vi.fn();
    const fileWithEvidence = {
      uid: 'e1',
      name: 'photo.jpg',
      status: 'done' as const,
      response: { id: 'ev1' },
    };
    vi.mocked(deleteEvidence).mockRejectedValue(new Error('刪除失敗'));

    render(<FileUpload caseId="c1" value={[fileWithEvidence]} onChange={onChange} />);

    const removeBtn = screen.getByTitle('Remove file');
    await userEvent.click(removeBtn);
    const confirmBtn = await screen.findByRole('button', { name: 'common.confirm' });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteEvidence).toHaveBeenCalledWith('c1', 'ev1', undefined);
    });
    expect(mockMessageError).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
