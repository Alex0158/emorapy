/**
 * SEO 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SEO from './index';

const mockInitSEO = vi.fn();
vi.mock('@/utils/seo', () => ({
  initSEO: (opts: unknown) => mockInitSEO(opts),
}));

const SEOWithRouter = ({ title, description, keywords, image }: {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
}) => (
  <MemoryRouter initialEntries={['/test-path']}>
    <SEO title={title} description={description} keywords={keywords} image={image} />
  </MemoryRouter>
);

describe('SEO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', pathname: '/' },
      writable: true,
    });
  });

  it('應調用 initSEO 並傳入 title、description、url', () => {
    render(
      <SEOWithRouter title="頁面標題" description="頁面描述" />
    );
    expect(mockInitSEO).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '頁面標題',
        description: '頁面描述',
        url: expect.stringContaining('example.com'),
      })
    );
  });

  it('應傳入 keywords 與 image 當有提供時', () => {
    render(
      <SEOWithRouter
        title="T"
        description="D"
        keywords="關鍵字"
        image="https://example.com/og.png"
      />
    );
    expect(mockInitSEO).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: '關鍵字',
        image: 'https://example.com/og.png',
      })
    );
  });

  it('應返回 null（不渲染 DOM）', () => {
    const { container } = render(
      <SEOWithRouter title="T" description="D" />
    );
    expect(container.firstChild).toBeNull();
  });
});
