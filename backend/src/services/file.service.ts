import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { statSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { Errors } from '../utils/errors';
import { env } from '../config/env';
import logger from '../config/logger';
import fs from 'fs/promises';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';

/**
 * 文件上傳配置
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // 確保上傳目錄存在
      await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
      cb(null, env.UPLOAD_DIR);
    } catch (error) {
      cb(error as Error, env.UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名，防止路徑遍歷
    const ext = path.extname(file.originalname);
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.mp4'];
    
    if (!allowedExts.includes(ext.toLowerCase())) {
      return cb(new Error('不支持的文件類型'), '');
    }

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
  
  // 驗證MIME類型
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('不支持的文件類型'));
  }
  
  // 驗證文件擴展名（防止MIME類型偽造）
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.mp4'];
  if (!allowedExts.includes(ext)) {
    return cb(new Error('不支持的文件擴展名'));
  }
  
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE, // 5MB
    files: 3, // 最多3個文件
  },
});

/**
 * 文件魔數（Magic Number）對照表
 * 用於驗證文件的實際類型，防止偽造擴展名
 */
const FILE_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/gif': [
    Buffer.from('GIF87a', 'ascii'),
    Buffer.from('GIF89a', 'ascii'),
  ],
  'video/mp4': [
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // MP4 ftyp
    Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // MP4 ftyp (alternative)
  ],
};

/**
 * 根據文件擴展名獲取期望的MIME類型
 */
function getExpectedMimeType(ext: string): string | null {
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
  };
  return mimeMap[ext.toLowerCase()] || null;
}

/**
 * 驗證文件魔數
 */
async function validateFileSignature(filePath: string, expectedMimeType: string): Promise<boolean> {
  try {
    const signatures = FILE_SIGNATURES[expectedMimeType];
    if (!signatures || signatures.length === 0) {
      // 如果沒有定義魔數，跳過驗證（不推薦，但為了向後兼容）
      logger.warn('File signature not defined for MIME type', { expectedMimeType });
      return true;
    }

    // 讀取文件開頭（最多讀取16字節，足夠識別大部分文件類型）
    const buffer = Buffer.alloc(16);
    const fileHandle = await fs.open(filePath, 'r');
    try {
      const { bytesRead } = await fileHandle.read(buffer, 0, 16, 0);
      await fileHandle.close();

      // 檢查是否匹配任何簽名
      for (const signature of signatures) {
        if (bytesRead >= signature.length && buffer.subarray(0, signature.length).equals(signature)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      await fileHandle.close();
      throw error;
    }
  } catch (error) {
    logger.error('Failed to validate file signature', { filePath, expectedMimeType, error });
    // 如果驗證失敗，為了安全起見返回false
    return false;
  }
}

/** 開發環境常混用 localhost / 127.0.0.1 / ::1，應視為同一站點以便簽名與瀏覽器載入頭像 */
function isSameSiteForSignedFileUrl(a: URL, b: URL): boolean {
  if (a.protocol !== b.protocol) return false;
  const defaultPort = (p: string) => (p === 'https:' ? '443' : '80');
  const portA = a.port || defaultPort(a.protocol);
  const portB = b.port || defaultPort(b.protocol);
  if (portA !== portB) return false;
  const h = (hostname: string) => hostname.toLowerCase();
  const ha = h(a.hostname);
  const hb = h(b.hostname);
  const loopback = new Set(['localhost', '127.0.0.1', '::1']);
  if (loopback.has(ha) && loopback.has(hb)) return true;
  return ha === hb;
}

/**
 * 文件服務類
 */
export class FileService {
  /**
   * 只對本域 uploads 路徑簽名，避免把 token 帶到第三方域名
   */
  private shouldSignUrl(url: string): boolean {
    try {
      const parsed = new URL(url, env.FILE_BASE_URL);
      const base = new URL(env.FILE_BASE_URL);
      const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url);
      const sameSite = !isAbsolute || isSameSiteForSignedFileUrl(parsed, base);
      const normalizedPath = parsed.pathname.replace(/^\/+/, '');
      return sameSite && normalizedPath.startsWith('uploads/');
    } catch {
      return false;
    }
  }

  /**
   * 驗證文件（包括魔數驗證）
   */
  async validateFile(file: Express.Multer.File): Promise<void> {
    // 驗證文件大小
    if (file.size > env.MAX_FILE_SIZE) {
      throw Errors.FILE_TOO_LARGE(`文件大小不能超過${env.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // 驗證文件類型
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.mp4'];
    if (!allowedExts.includes(ext)) {
      throw Errors.INVALID_FILE_TYPE('只支持JPG、PNG、GIF、MP4格式');
    }

    // 根據擴展名獲取期望的MIME類型
    const expectedMimeType = getExpectedMimeType(ext);
    if (!expectedMimeType) {
      throw Errors.INVALID_FILE_TYPE('不支持的文件類型');
    }

    // 驗證MIME類型是否匹配
    if (file.mimetype !== expectedMimeType) {
      logger.warn('File MIME type mismatch', {
        filename: file.originalname,
        declared: file.mimetype,
        expected: expectedMimeType,
      });
      // 不直接拒絕，繼續進行魔數驗證
    }

    // 驗證文件魔數（實際文件內容驗證）
    const filePath = path.join(file.destination, file.filename);
    const isValidSignature = await validateFileSignature(filePath, expectedMimeType);
    
    if (!isValidSignature) {
      // 刪除無效文件
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.error('Failed to delete invalid file', { filePath, error });
      }
      throw Errors.INVALID_FILE_TYPE('文件類型驗證失敗：文件內容與聲稱的類型不匹配');
    }
  }

  /**
   * 獲取文件URL（生產環境應使用CDN）
   */
  getFileUrl(filename: string): string {
    if (env.NODE_ENV === 'production') {
      const cdnUrl = process.env.CDN_URL;
      if (cdnUrl) {
        return `${cdnUrl}/${filename}`;
      }
      const uploadDir = env.UPLOAD_DIR;
      if (path.isAbsolute(uploadDir)) {
        logger.warn('生產環境未配置CDN，使用本地文件路徑', { uploadDir });
        return `${env.FILE_BASE_URL}/uploads/${filename}`;
      }
    }
    return `${env.FILE_BASE_URL}/uploads/${filename}`;
  }

  /**
   * 為已有文件URL添加簽名（不修改存儲的基礎URL）
   */
  signUrl(url: string, expiresIn: string = '7d'): string {
    if (process.env.ALLOW_PUBLIC_UPLOADS === 'true') {
      return url;
    }
    try {
      if (!this.shouldSignUrl(url)) {
        return url;
      }

      const parsed = new URL(url, env.FILE_BASE_URL);
      const filename = path.basename(parsed.pathname);
      const hash = crypto.createHash('sha256').update(filename).digest('hex');

      // 嘗試加入文件大小與mtime（如可用），增強防重放
      let size: number | undefined;
      let mtime: number | undefined;
      let contentHash: string | undefined;
      // 加入隨機 nonce（每次簽名不同，減少重放窗口）
      const nonce = crypto.randomBytes(8).toString('hex');
      const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
        ? env.UPLOAD_DIR
        : path.join(process.cwd(), env.UPLOAD_DIR);
      const fullPath = path.join(uploadPath, path.basename(filename));
      try {
        const stat = statSync(fullPath);
        size = stat.size;
        mtime = stat.mtimeMs;
        // 內容哈希，防同名同大小重放（文件上限5MB，計算開銷可接受）
        const buf = readFileSync(fullPath);
        contentHash = crypto.createHash('sha256').update(buf).digest('hex');
      } catch {
        // 忽略，可能是 CDN 或文件已不在本機
      }

      const token = jwt.sign(
        { f: filename, h: hash, s: size, m: mtime, n: nonce, ch: contentHash },
        env.JWT_SECRET as Secret,
        { expiresIn } as SignOptions
      );
      parsed.searchParams.set('token', token);
      return parsed.toString();
    } catch (error) {
      logger.warn('Failed to sign url', { url, error });
      return url;
    }
  }

  /**
   * 驗證並處理圖片（壓縮等，預留接口）
   */
  async processImage(file: Express.Multer.File): Promise<{ filename: string; size: number; mimetype: string }> {
    const inputPath = path.join(file.destination, file.filename);
    const outputName = `${path.parse(file.filename).name}-compressed.jpg`;
    const outputPath = path.join(file.destination, outputName);

    try {
      await sharp(inputPath)
        .rotate() // 根據EXIF自動旋轉
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);

      await fs.unlink(inputPath).catch((e) => { logger.debug('Failed to remove original image after processing', { inputPath, error: e }); });
      const stat = await fs.stat(outputPath);
      return { filename: outputName, size: stat.size, mimetype: 'image/jpeg' };
    } catch (error) {
      logger.error('Image processing failed', { file: file.filename, error });
      // 失敗時返回原文件名，避免阻塞流程
      const stat = await fs.stat(inputPath).catch((): { size: number } => ({ size: file.size }));
      return { filename: file.filename, size: stat.size, mimetype: file.mimetype };
    }
  }

  /**
   * 驗證並處理視頻（轉碼等，預留接口）
   */
  async processVideo(file: Express.Multer.File): Promise<{ filename: string; size: number; mimetype: string }> {
    const inputPath = path.join(file.destination, file.filename);
    const outputName = `${path.parse(file.filename).name}-transcoded.mp4`;
    const outputPath = path.join(file.destination, outputName);

    try {
      const ffmpegExecutable = typeof ffmpegPath === 'string' && ffmpegPath.length > 0 ? ffmpegPath : null;
      if (!ffmpegExecutable) throw new Error('ffmpeg binary is not available');

      const args = [
        '-y',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-vf', 'scale=-2:min(720\\,ih)',
        '-preset', 'veryfast',
        '-movflags', '+faststart',
        outputPath,
      ];

      await new Promise<void>((resolve, reject) => {
        const child = spawn(ffmpegExecutable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';

        child.stderr?.on('data', (chunk: Buffer | string) => {
          stderr += chunk.toString();
          if (stderr.length > 4000) stderr = stderr.slice(-4000);
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`ffmpeg exited with code ${code ?? 'unknown'}${stderr ? `: ${stderr}` : ''}`));
        });
      });

      await fs.unlink(inputPath).catch((e) => { logger.debug('Failed to remove original video after processing', { inputPath, error: e }); });
      const stat = await fs.stat(outputPath);
      return { filename: outputName, size: stat.size, mimetype: 'video/mp4' };
    } catch (error) {
      logger.error('Video processing failed', { file: file.filename, error });
      const stat = await fs.stat(inputPath).catch((): { size: number } => ({ size: file.size }));
      return { filename: file.filename, size: stat.size, mimetype: file.mimetype };
    }
  }

  /**
   * 刪除文件
   */
  async deleteFile(filename: string): Promise<void> {
    try {
      const safeName = path.basename(filename);
      if (!safeName || safeName === '.' || safeName === '..') {
        logger.warn('Rejected deleteFile with invalid filename', { filename });
        return;
      }
      const uploadDir = path.resolve(env.UPLOAD_DIR);
      const filePath = path.resolve(uploadDir, safeName);
      if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
        logger.warn('Path traversal attempt blocked in deleteFile', { filename, resolved: filePath });
        return;
      }
      await fs.unlink(filePath);
    } catch (error) {
      logger.error('Failed to delete file', { filename, error });
    }
  }
}

export const fileService = new FileService();

/**
 * 簽名使用者 avatar URL。傳入帶 avatar_url 的物件，回傳 URL 已簽名的副本。
 */
export function signAvatar<T extends { avatar_url?: string | null }>(user: T | null | undefined): T | null | undefined {
  if (!user?.avatar_url) return user;
  return { ...user, avatar_url: fileService.signUrl(user.avatar_url) };
}
