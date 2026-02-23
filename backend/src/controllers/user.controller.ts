import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { getAuthUserId } from '../utils/request';
import { fileService, upload } from '../services/file.service';
import logger from '../config/logger';
import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env';

export class UserController {
  /**
   * 獲取用戶資料
   */
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nickname: true,
          avatar_url: true,
          gender: true,
          age: true,
          relationship_status: true,
          language: true,
          timezone: true,
          notification_enabled: true,
          privacy_level: true,
          created_at: true,
          last_login_at: true,
          email_verified: true,
        },
      });

      if (!user) {
        throw Errors.NOT_FOUND('用戶不存在');
      }

      // 簽名頭像 URL（防止公開暴露且避免過期）
      const signedAvatar = user.avatar_url ? fileService.signUrl(user.avatar_url) : null;

      res.json({
        success: true,
        data: { user: { ...user, avatar_url: signedAvatar ?? user.avatar_url } },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新用戶資料
   */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const allowedFields = [
        'nickname',
        'gender',
        'age',
        'relationship_status',
        'language',
        'timezone',
        'notification_enabled',
        'privacy_level',
      ];

      const updateData: Record<string, unknown> = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw Errors.VALIDATION_ERROR('沒有可更新的字段');
      }

      if (req.body.avatar_url !== undefined) {
        // 僅允許受信任域名
        const allowedHostsEnv = (process.env.ALLOWED_AVATAR_HOSTS || '')
          .split(',')
          .map(h => h.trim())
          .filter(Boolean);
        const defaultHosts = [
          new URL(env.FILE_BASE_URL).hostname,
          process.env.CDN_URL ? new URL(process.env.CDN_URL).hostname : null,
        ].filter(Boolean) as string[];
        const allowedHosts = allowedHostsEnv.length > 0 ? allowedHostsEnv : defaultHosts;
        if (allowedHosts.length > 0) {
          try {
            const url = new URL(req.body.avatar_url);
            if (!allowedHosts.includes(url.hostname)) {
              throw Errors.VALIDATION_ERROR('頭像域名不被允許');
            }
          } catch {
            throw Errors.VALIDATION_ERROR('頭像URL格式無效');
          }
        }
        updateData.avatar_url = req.body.avatar_url;
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          updated_at: new Date(),
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          avatar_url: true,
          gender: true,
          age: true,
          relationship_status: true,
          language: true,
          timezone: true,
          notification_enabled: true,
          privacy_level: true,
          created_at: true,
          last_login_at: true,
          email_verified: true,
        },
      });

      const signedAvatar = user.avatar_url ? fileService.signUrl(user.avatar_url) : null;

      res.json({
        success: true,
        data: { user: { ...user, avatar_url: signedAvatar ?? user.avatar_url } },
        message: '資料更新成功',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();

/**
 * 單獨的頭像上傳與更新控制器
 * 路由中使用 upload.single('avatar')
 */
export const uploadAvatar = [
  upload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        throw Errors.VALIDATION_ERROR('缺少頭像文件');
      }

      // 僅允許圖片
      if (!file.mimetype.startsWith('image/')) {
        await fs.unlink(path.join(file.destination, file.filename)).catch((e) => {
          logger.warn('Failed to remove invalid avatar file', { filename: file.filename, error: e });
        });
        throw Errors.INVALID_FILE_TYPE('頭像僅支持圖片格式');
      }

      await fileService.validateFile(file);

      // 壓縮圖片
      const processed = await fileService.processImage(file);
      const url = fileService.getFileUrl(processed.filename);

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatar_url: url },
        select: {
          id: true,
          email: true,
          nickname: true,
          avatar_url: true,
          gender: true,
          age: true,
          relationship_status: true,
          language: true,
          timezone: true,
          notification_enabled: true,
          privacy_level: true,
          created_at: true,
          last_login_at: true,
          email_verified: true,
        },
      });

      const signedAvatar = user.avatar_url ? fileService.signUrl(user.avatar_url) : null;

      res.json({
        success: true,
        data: { user: { ...user, avatar_url: signedAvatar ?? user.avatar_url } },
        message: '頭像更新成功',
      });
    } catch (error) {
      next(error);
    }
  },
];
