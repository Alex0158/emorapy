/**
 * FileService 單元測試（mock env、jwt、fs、sharp、ffmpeg）
 * 覆蓋 getFileUrl、signUrl、validateFile、processImage、processVideo、deleteFile 邏輯分支
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEnvRef = {
  NODE_ENV: 'test',
  UPLOAD_DIR: 'uploads',
  FILE_BASE_URL: 'http://localhost:3001',
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  JWT_SECRET: 'test-secret',
};

jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef;
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('fs', () => ({
  statSync: jest.fn(() => ({ size: 100, mtimeMs: 1000 })),
  readFileSync: jest.fn(() => Buffer.from('x')),
}));
const mockOpen = jest.fn() as jest.Mock;
const mockUnlink = jest.fn() as jest.Mock;
const mockStat = jest.fn() as jest.Mock;
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  open: (...args: unknown[]) => mockOpen(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  stat: (...args: unknown[]) => mockStat(...args),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn((payload: unknown, _secret: string, _opts: unknown) => `token.${JSON.stringify(payload).slice(0, 20)}`),
}));

const mockSharp = jest.fn();
jest.mock('sharp', () => mockSharp);

const mockFfmpeg = jest.fn();
jest.mock('fluent-ffmpeg', () => {
  const fn = (...args: unknown[]) => mockFfmpeg(...args);
  (fn as any).setFfmpegPath = jest.fn();
  return { __esModule: true, default: fn };
});
jest.mock('ffmpeg-static', () => ({ __esModule: true, default: '/fake/ffmpeg' }));

import { FileService, fileService } from '../../../src/services/file.service';

describe('FileService', () => {
  let service: FileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FileService();
    mockEnvRef.NODE_ENV = 'test';
    mockEnvRef.FILE_BASE_URL = 'http://localhost:3001';
    mockEnvRef.UPLOAD_DIR = 'uploads';
    mockEnvRef.MAX_FILE_SIZE = 5 * 1024 * 1024;
    delete process.env.CDN_URL;
    delete process.env.ALLOW_PUBLIC_UPLOADS;
    // 預設 fs/promises open 回傳可讀 handle（魔數驗證用）
    const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
    (mockOpen as any).mockResolvedValue({
      read: jest.fn().mockImplementation((buf: unknown) => {
        if (Buffer.isBuffer(buf)) jpegSignature.copy(buf, 0);
        return Promise.resolve({ bytesRead: jpegSignature.length });
      }),
      close: (jest.fn() as any).mockResolvedValue(undefined),
    });
    (mockUnlink as any).mockResolvedValue(undefined);
    (mockStat as any).mockResolvedValue({ size: 200 });
  });

  describe('getFileUrl', () => {
    it('非生產環境應返回 FILE_BASE_URL/uploads/filename', () => {
      mockEnvRef.NODE_ENV = 'test';
      const url = service.getFileUrl('foo.jpg');
      expect(url).toBe('http://localhost:3001/uploads/foo.jpg');
    });

    it('生產環境且有 CDN_URL 應返回 CDN_URL/filename', () => {
      mockEnvRef.NODE_ENV = 'production';
      process.env.CDN_URL = 'https://cdn.example.com';
      const url = service.getFileUrl('foo.jpg');
      expect(url).toBe('https://cdn.example.com/foo.jpg');
    });

    it('生產環境無 CDN 應返回 FILE_BASE_URL/uploads/filename', () => {
      mockEnvRef.NODE_ENV = 'production';
      mockEnvRef.UPLOAD_DIR = 'uploads';
      const url = service.getFileUrl('foo.jpg');
      expect(url).toBe('http://localhost:3001/uploads/foo.jpg');
    });

    it('生產環境無 CDN 且 UPLOAD_DIR 為絕對路徑時應記錄 warn 並返回 FILE_BASE_URL/uploads/filename', () => {
      mockEnvRef.NODE_ENV = 'production';
      mockEnvRef.UPLOAD_DIR = '/absolute/uploads';
      const url = service.getFileUrl('foo.jpg');
      expect(url).toBe('http://localhost:3001/uploads/foo.jpg');
      const logger = require('../../../src/config/logger').default;
      expect(logger.warn).toHaveBeenCalledWith('生產環境未配置CDN，使用本地文件路徑', { uploadDir: '/absolute/uploads' });
    });
  });

  describe('signUrl', () => {
    it('ALLOW_PUBLIC_UPLOADS 為 true 時應直接返回原 URL', () => {
      process.env.ALLOW_PUBLIC_UPLOADS = 'true';
      const url = service.signUrl('http://localhost:3001/uploads/bar.jpg');
      expect(url).toBe('http://localhost:3001/uploads/bar.jpg');
    });

    it('未開啟公開時應返回帶 token 的 URL', () => {
      const url = service.signUrl('http://localhost:3001/uploads/bar.jpg');
      expect(url).toContain('token=');
      expect(url).toContain('bar.jpg');
    });

    it('FILE_BASE_URL 為 127.0.0.1 而資源 URL 為 localhost 時仍應簽名（本機混用主機名）', () => {
      mockEnvRef.FILE_BASE_URL = 'http://127.0.0.1:3001';
      const url = service.signUrl('http://localhost:3001/uploads/bar.jpg');
      expect(url).toContain('token=');
      expect(url).toContain('bar.jpg');
    });

    it('相對路徑應能解析並簽名', () => {
      const url = service.signUrl('/uploads/baz.jpg');
      expect(url).toContain('token=');
    });

    it('簽名過程拋錯時應記錄 warn 並返回原 URL', () => {
      const jwt = require('jsonwebtoken');
      (jwt.sign as jest.Mock).mockImplementationOnce(() => {
        throw new Error('jwt error');
      });
      const original = 'http://localhost:3001/uploads/bar.jpg';
      const url = service.signUrl(original);
      expect(url).toBe(original);
      const logger = require('../../../src/config/logger').default;
      expect(logger.warn).toHaveBeenCalledWith('Failed to sign url', expect.objectContaining({ url: original }));
    });
  });

  describe('validateFile', () => {
    it('文件超過大小限制應拋出 FILE_TOO_LARGE', async () => {
      const file = {
        size: 10 * 1024 * 1024,
        originalname: 'big.jpg',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: 'x.jpg',
      } as Express.Multer.File;
      mockEnvRef.MAX_FILE_SIZE = 5 * 1024 * 1024;

      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
      });
    });

    it('不支持的擴展名應拋出 INVALID_FILE_TYPE', async () => {
      const file = {
        size: 100,
        originalname: 'x.exe',
        mimetype: 'application/octet-stream',
        destination: 'uploads',
        filename: 'x.exe',
      } as Express.Multer.File;

      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'INVALID_FILE_TYPE',
      });
    });

    it('originalname 為空字串時應拋出 INVALID_FILE_TYPE（候選功能邊界：無擴展名防禦）', async () => {
      const file = {
        size: 100,
        originalname: '',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: '123.jpg',
      } as Express.Multer.File;

      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'INVALID_FILE_TYPE',
      });
    });

    it('魔數驗證通過應不拋錯', async () => {
      const file = {
        size: 100,
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: '123-a.jpg',
      } as Express.Multer.File;
      await expect(fileService.validateFile(file)).resolves.toBeUndefined();
      expect(mockOpen).toHaveBeenCalled();
    });

    it('魔數驗證失敗應刪除文件並拋出 INVALID_FILE_TYPE', async () => {
      (mockOpen as any).mockResolvedValueOnce({
        read: (jest.fn() as any).mockResolvedValue({ bytesRead: 3 }), // 不寫入 JPEG 魔數，buffer 保持為 0
        close: (jest.fn() as any).mockResolvedValue(undefined),
      });
      const file = {
        size: 100,
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: '123-a.jpg',
      } as Express.Multer.File;
      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'INVALID_FILE_TYPE',
        message: expect.stringContaining('文件內容與聲稱的類型不匹配'),
      });
      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('123-a.jpg'));
    });

    it('讀取文件魔數時拋錯應拋出 INVALID_FILE_TYPE', async () => {
      (mockOpen as any).mockRejectedValueOnce(new Error('open failed'));
      const file = {
        size: 100,
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: '123-a.jpg',
      } as Express.Multer.File;
      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'INVALID_FILE_TYPE',
      });
    });

    it('讀取文件魔數時 read 拋錯應記錄 error 並拋出 INVALID_FILE_TYPE', async () => {
      (mockOpen as any).mockResolvedValueOnce({
        read: (jest.fn() as any).mockRejectedValueOnce(new Error('read failed')),
        close: (jest.fn() as any).mockResolvedValue(undefined),
      });
      const file = {
        size: 100,
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: '123-a.jpg',
      } as Express.Multer.File;
      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'INVALID_FILE_TYPE',
        message: expect.stringContaining('文件內容與聲稱的類型不匹配'),
      });
      const logger = require('../../../src/config/logger').default;
      expect(logger.error).toHaveBeenCalledWith('Failed to validate file signature', expect.objectContaining({
        filePath: expect.stringContaining('123-a.jpg'),
        expectedMimeType: 'image/jpeg',
      }));
    });

    it('MIME 類型與擴展名不一致時應記錄 warn 並繼續魔數驗證', async () => {
      const file = {
        size: 100,
        originalname: 'a.jpg',
        mimetype: 'image/png',
        destination: 'uploads',
        filename: '123-a.jpg',
      } as Express.Multer.File;
      await expect(fileService.validateFile(file)).resolves.toBeUndefined();
      const logger = require('../../../src/config/logger').default;
      expect(logger.warn).toHaveBeenCalledWith('File MIME type mismatch', expect.objectContaining({
        filename: 'a.jpg',
        declared: 'image/png',
        expected: 'image/jpeg',
      }));
    });

    it('魔數驗證失敗且刪除無效文件時 unlink 拋錯應記錄 error 並仍拋出 INVALID_FILE_TYPE', async () => {
      (mockOpen as any).mockResolvedValueOnce({
        read: (jest.fn() as any).mockResolvedValue({ bytesRead: 0 }),
        close: (jest.fn() as any).mockResolvedValue(undefined),
      });
      (mockUnlink as any).mockRejectedValueOnce(new Error('unlink failed'));
      const file = {
        size: 100,
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        destination: 'uploads',
        filename: '123-a.jpg',
      } as Express.Multer.File;
      await expect(fileService.validateFile(file)).rejects.toMatchObject({
        code: 'INVALID_FILE_TYPE',
        message: expect.stringContaining('文件內容與聲稱的類型不匹配'),
      });
      const logger = require('../../../src/config/logger').default;
      expect(logger.error).toHaveBeenCalledWith('Failed to delete invalid file', expect.objectContaining({ filePath: expect.stringContaining('123-a.jpg') }));
    });
  });

  describe('processImage', () => {
    it('成功應壓縮並返回新檔名與 mimetype', async () => {
      mockSharp.mockReturnValue({
        rotate: () => ({
          resize: () => ({
            jpeg: () => ({
              toFile: () => Promise.resolve(),
            }),
          }),
        }),
      });
      mockStat.mockResolvedValue({ size: 150 } as never);
      const file = {
        destination: 'uploads',
        filename: 'orig.jpg',
        size: 500,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const result = await fileService.processImage(file);
      expect(result.filename).toBe('orig-compressed.jpg');
      expect(result.size).toBe(150);
      expect(result.mimetype).toBe('image/jpeg');
      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('orig.jpg'));
    });

    it('壓縮失敗應返回原文件資訊並記錄 logger.error', async () => {
      mockSharp.mockReturnValueOnce({
        rotate: () => ({
          resize: () => ({
            jpeg: () => ({
              toFile: () => Promise.reject(new Error('sharp error')),
            }),
          }),
        }),
      });
      (mockStat as any).mockRejectedValueOnce(new Error('stat fail'));
      const file = {
        destination: 'uploads',
        filename: 'orig.jpg',
        size: 500,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const result = await fileService.processImage(file);
      expect(result.filename).toBe('orig.jpg');
      expect(result.size).toBe(500);
      expect(result.mimetype).toBe('image/jpeg');
      const logger = require('../../../src/config/logger').default;
      expect(logger.error).toHaveBeenCalledWith('Image processing failed', expect.objectContaining({ file: 'orig.jpg', error: expect.any(Error) }));
    });

    it('壓縮成功但刪除原文件失敗時應仍返回壓縮後檔案', async () => {
      mockSharp.mockReturnValue({
        rotate: () => ({
          resize: () => ({
            jpeg: () => ({
              toFile: () => Promise.resolve(),
            }),
          }),
        }),
      });
      (mockUnlink as any)
        .mockRejectedValueOnce(new Error('unlink failed'))
        .mockResolvedValueOnce(undefined);
      (mockStat as any).mockResolvedValue({ size: 150 } as never);
      const file = {
        destination: 'uploads',
        filename: 'orig.jpg',
        size: 500,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const result = await fileService.processImage(file);
      expect(result.filename).toBe('orig-compressed.jpg');
      expect(result.size).toBe(150);
      expect(result.mimetype).toBe('image/jpeg');
    });
  });

  describe('processVideo', () => {
    it('成功應轉碼並返回新檔名與 mimetype', async () => {
      let endCb: () => void;
      const runChain = {
        on: () => ({ run: () => { endCb(); } }),
        run: () => { endCb(); },
      };
      const chain = {
        videoCodec: () => chain,
        audioCodec: () => chain,
        size: () => chain,
        outputOptions: () => chain,
        output: () => chain,
        on: (ev: string, cb: () => void) => {
          if (ev === 'end') endCb = cb;
          return runChain;
        },
      };
      mockFfmpeg.mockReturnValue(chain);
      (mockStat as any).mockResolvedValue({ size: 300 });
      const file = {
        destination: 'uploads',
        filename: 'vid.mp4',
        size: 1000,
        mimetype: 'video/mp4',
      } as Express.Multer.File;
      const result = await fileService.processVideo(file);
      expect(result.filename).toBe('vid-transcoded.mp4');
      expect(result.size).toBe(300);
      expect(result.mimetype).toBe('video/mp4');
    });

    it('轉碼失敗應返回原文件資訊並記錄 logger.error', async () => {
      let errorCb: (err: Error) => void;
      const failChain = {
        videoCodec: () => failChain,
        audioCodec: () => failChain,
        size: () => failChain,
        outputOptions: () => failChain,
        output: () => failChain,
        on: (ev: string, cb: (err: Error) => void) => {
          if (ev === 'error') errorCb = cb;
          return { on: () => ({ run: () => { errorCb(new Error('ffmpeg error')); } }) };
        },
      };
      mockFfmpeg.mockReturnValueOnce(failChain);
      (mockStat as any).mockRejectedValueOnce(new Error('stat fail'));
      const file = {
        destination: 'uploads',
        filename: 'vid.mp4',
        size: 1000,
        mimetype: 'video/mp4',
      } as Express.Multer.File;
      const result = await fileService.processVideo(file);
      expect(result.filename).toBe('vid.mp4');
      expect(result.size).toBe(1000);
      expect(result.mimetype).toBe('video/mp4');
      const logger = require('../../../src/config/logger').default;
      expect(logger.error).toHaveBeenCalledWith('Video processing failed', expect.objectContaining({ file: 'vid.mp4', error: expect.any(Error) }));
    });
  });

  describe('deleteFile', () => {
    it('應調用 fs.unlink 不拋錯', async () => {
      mockUnlink.mockResolvedValue(undefined as never);

      await expect(fileService.deleteFile('old.jpg')).resolves.toBeUndefined();
      expect(mockUnlink).toHaveBeenCalled();
    });

    it('unlink 拋錯時應記錄 error 且不拋出', async () => {
      (mockUnlink as any).mockRejectedValueOnce(new Error('unlink failed'));
      await expect(fileService.deleteFile('old.jpg')).resolves.toBeUndefined();
      const logger = require('../../../src/config/logger').default;
      expect(logger.error).toHaveBeenCalledWith('Failed to delete file', expect.objectContaining({ filename: 'old.jpg' }));
    });
  });
});
