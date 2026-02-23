import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvidenceUploadSection from './EvidenceUploadSection';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/utils/constants', () => ({ MAX_IMAGE_COUNT: 5 }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy({}, {
      get: (_t: unknown, prop: string) =>
        React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
          React.createElement(prop === 'div' ? 'div' : prop, { ...props, ref }, props.children)),
    }),
  };
});

describe('EvidenceUploadSection', () => {
  it('status 為 success 時不應渲染任何內容', () => {
    const { container } = render(
      <EvidenceUploadSection status="success" caseId="c1" isUploading={false} onUploadFiles={vi.fn()} />
    );
    expect(container.querySelector('.evidence-upload-section')).not.toBeInTheDocument();
  });

  it('status 為 null 時不應渲染', () => {
    const { container } = render(
      <EvidenceUploadSection status={null} caseId="c1" isUploading={false} onUploadFiles={vi.fn()} />
    );
    expect(container.querySelector('.evidence-upload-section')).not.toBeInTheDocument();
  });

  it('caseId 為空時不應渲染', () => {
    const { container } = render(
      <EvidenceUploadSection status="failed" caseId="" isUploading={false} onUploadFiles={vi.fn()} />
    );
    expect(container.querySelector('.evidence-upload-section')).not.toBeInTheDocument();
  });

  it('status 為 failed 時應顯示失敗提示和上傳按鈕', () => {
    render(
      <EvidenceUploadSection status="failed" caseId="c1" isUploading={false} onUploadFiles={vi.fn()} />
    );
    expect(screen.getByText('evidence.title')).toBeInTheDocument();
    expect(screen.getByText('evidence.failed')).toBeInTheDocument();
    expect(screen.getByText('evidence.action.reupload')).toBeInTheDocument();
  });

  it('status 為 pending 時應顯示等待提示', () => {
    render(
      <EvidenceUploadSection status="pending" caseId="c1" isUploading={false} onUploadFiles={vi.fn()} />
    );
    expect(screen.getByText('evidence.pending')).toBeInTheDocument();
  });

  it('isUploading 時上傳按鈕應 disabled', () => {
    render(
      <EvidenceUploadSection status="failed" caseId="c1" isUploading={true} onUploadFiles={vi.fn()} />
    );
    const btn = screen.getByText('evidence.action.reupload').closest('button');
    expect(btn).toBeDisabled();
  });
});
