/**
 * 文件服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * FileService 符合此介面；Controller 可選改為依賴 IFileService 並在建構時注入。
 */

export interface ProcessedFile {
  filename: string;
  size: number;
  mimetype: string;
}

export interface IFileService {
  signUrl(url: string, expiresIn?: string): string;

  validateFile(file: Express.Multer.File): Promise<void>;

  processImage(file: Express.Multer.File): Promise<ProcessedFile>;

  processVideo(file: Express.Multer.File): Promise<ProcessedFile>;

  getFileUrl(filename: string): string;

  deleteFile(filename: string): Promise<void>;
}
