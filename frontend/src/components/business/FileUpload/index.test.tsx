/**
 * FileUpload 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FileUpload from './index';

vi.mock('@/services/api/case', () => ({
  uploadEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
  getCase: vi.fn(),
}));

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應渲染上傳區域', () => {
    render(<FileUpload />);
    expect(screen.getByText(/上傳|點擊|拖拽/)).toBeInTheDocument();
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
});
