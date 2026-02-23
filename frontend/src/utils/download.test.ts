/**
 * 下載工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadFile, downloadText, downloadJSON } from './download';

describe('download', () => {
  let mockLink: { href: string; download: string; target: string; click: ReturnType<typeof vi.fn> };
  let appendChild: ReturnType<typeof vi.fn>;
  let removeChild: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      target: '',
      click: vi.fn(),
    };
    appendChild = vi.fn();
    removeChild = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChild as (node: Node) => Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChild as (node: Node) => Node);
  });

  describe('downloadFile', () => {
    it('應創建 a 標籤、設置 href 與 download、點擊並移除', () => {
      downloadFile('https://example.com/file.pdf', 'file.pdf');
      expect(mockLink.href).toBe('https://example.com/file.pdf');
      expect(mockLink.download).toBe('file.pdf');
      expect(mockLink.target).toBe('_blank');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChild).toHaveBeenCalledWith(mockLink);
      expect(removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('無 filename 時 download 為空字串', () => {
      downloadFile('https://example.com/file');
      expect(mockLink.download).toBe('');
    });

    it('應拒絕不安全的 URL scheme 並拋出', () => {
      expect(() => downloadFile('javascript:alert(1)')).toThrow(
        'Blocked download from unsafe URL scheme: javascript'
      );
      expect(() => downloadFile('vbscript:msgbox')).toThrow(
        'Blocked download from unsafe URL scheme: vbscript'
      );
      expect(mockLink.click).not.toHaveBeenCalled();
    });

    it('應允許 blob: 與 data: scheme', () => {
      downloadFile('blob:http://localhost/abc', 'file.bin');
      expect(mockLink.click).toHaveBeenCalled();
      mockLink.click.mockClear();
      downloadFile('data:text/plain;base64,SGVsbG8=', 'file.txt');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('downloadText', () => {
    it('應創建 Blob 並調用 downloadFile', () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      downloadText('hello', 'test.txt', 'text/plain');
      expect(createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
    });
  });

  describe('downloadJSON', () => {
    it('應將 data 序列化為 JSON 並下載', () => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      downloadJSON({ a: 1 }, 'data.json');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('預設 filename 為 data.json', () => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      downloadJSON({});
      expect(mockLink.download).toBe('data.json');
    });
  });
});
