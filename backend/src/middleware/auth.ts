import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserPayload } from '../utils/jwt';
import { Errors } from '../utils/errors';
import prisma from '../config/database';
import { validateSessionId } from '../utils/session';
import { sessionService } from '../services/session.service';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import logger from '../config/logger';
import path from 'path';
import fs from 'fs/promises';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      sessionId?: string;
    }
  }
}

/**
 * JWT認證中間件（必需認證）
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. 從Header獲取Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Errors.UNAUTHORIZED('未提供認證Token');
    }
    
    const token = authHeader.substring(7);
    
    // 2. 驗證Token
    const decoded = verifyToken(token);
    
    // 3. 檢查用戶是否存在且激活
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, is_active: true },
    });
    
    if (!user || !user.is_active) {
      throw Errors.UNAUTHORIZED('用戶不存在或未激活');
    }
    
    // 4. 將用戶信息附加到請求對象
    req.user = {
      id: user.id,
      email: user.email,
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 可選認證中間件（快速體驗模式）
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, is_active: true },
        });
        
        if (user && user.is_active) {
          req.user = {
            id: user.id,
            email: user.email,
          };
        }
      } catch (error) {
        logger.warn('Optional auth token invalid', {
          reason: (error as Error).message,
          requestId: (req as any).requestId,
          ip: req.ip,
        });
      }
    }
    next();
  } catch (error) {
    logger.warn('Optional auth failed', { error, requestId: (req as any).requestId });
    next();
  }
};

/**
 * Session驗證中間件（快速體驗模式）
 */
export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = (req.query.session_id as string) || 
                      (req.headers['x-session-id'] as string);
    
    if (!sessionId) {
      throw Errors.SESSION_ID_REQUIRED();
    }
    
    // 驗證Session ID格式（與服務層一致）
    if (!validateSessionId(sessionId)) {
      throw Errors.INVALID_SESSION_ID();
    }
    
    // 驗證Session是否存在且未過期（複用sessionService邏輯）
    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      throw Errors.SESSION_EXPIRED();
    }
    
    // 更新最後訪問時間
    await prisma.quickSession.update({
      where: { id: sessionId },
      data: { last_accessed_at: new Date() },
    }).catch(() => {
      // 更新失敗不影響請求
    });
    
    // 將Session ID附加到請求對象
    req.sessionId = sessionId;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 上傳資源訪問保護
 * 規則：
 * - 優先使用 JWT 認證
 * - 允許快速體驗 session（x-session-id / query.session_id）
 */
export const authorizeMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 可選 IP 黑名單（逗號分隔）
    if (process.env.BLACKLIST_IPS) {
      const blocked = process.env.BLACKLIST_IPS.split(',').map(ip => ip.trim()).filter(Boolean);
      if (blocked.includes(req.ip || '')) {
        logger.warn('Media access blocked by IP blacklist', { ip: req.ip, file: req.path });
        return next(Errors.FORBIDDEN('訪問被拒絕'));
      }
    }

    // 生產環境禁止開啟完全公開
    if (env.NODE_ENV === 'production' && process.env.ALLOW_PUBLIC_UPLOADS === 'true') {
      logger.error('ALLOW_PUBLIC_UPLOADS 在生產環境被啟用，已阻止訪問');
      return next(Errors.FORBIDDEN('生產環境不允許公開訪問上傳資源'));
    }

    // 可選開關：允許公開訪問（默認關閉，僅用於兼容或調試）
    if (process.env.ALLOW_PUBLIC_UPLOADS === 'true') {
      // 只允許 GET/HEAD
      if (!['GET', 'HEAD'].includes(req.method)) {
        return next(Errors.FORBIDDEN('公開模式僅允許讀取請求'));
      }
      // 若配置了 PUBLIC_UPLOAD_PATHS，僅允許白名單路徑
      const allowedPaths = (process.env.PUBLIC_UPLOAD_PATHS || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      if (allowedPaths.length > 0 && !allowedPaths.some(p => req.path.startsWith(p))) {
        return next(Errors.FORBIDDEN('當前文件路徑未在 PUBLIC_UPLOAD_PATHS 白名單'));
      }
      return next();
    }

    // 如果已經通過 authenticate/optionalAuthenticate，直接放行
    if ((req as any).user?.id) {
      return next();
    }

    // 嘗試 Session 驗證（快速體驗）
    const sessionId = (req.query.session_id as string) ||
                      (req.headers['x-session-id'] as string);
    if (sessionId && validateSessionId(sessionId)) {
      const session = await sessionService.getSession(sessionId);
      if (session) {
        (req as any).sessionId = sessionId;
        return next();
      }
    }

    // 嘗試簽名token（文件URL簽名）
    const token = (req.query.token as string) || undefined;
    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as any;
        // 簽名內容為相對路徑（如 uploads/foo.jpg），需與請求路徑匹配
        const requestedPath = (() => {
          const p = req.path.startsWith('/') ? req.path.slice(1) : req.path;
          try { return decodeURIComponent(p); } catch { return p; }
        })();
        const hash = require('crypto').createHash('sha256').update(payload.f || '').digest('hex');

        if (payload?.f && payload.h === hash && requestedPath.endsWith(payload.f)) {
          // 如有 size/mtime，進一步驗證
          if (payload.s || payload.m) {
            try {
              const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
                ? env.UPLOAD_DIR
                : path.join(process.cwd(), env.UPLOAD_DIR);
              const stat = await fs.stat(path.join(uploadPath, path.basename(payload.f)));
              if ((payload.s && stat.size !== payload.s) ||
                  (payload.m && Math.abs(stat.mtimeMs - payload.m) > 1)) {
                throw Errors.UNAUTHORIZED('簽名已失效');
              }
              // 驗證內容哈希（如存在），防止同名同尺寸重放
              if (payload.ch) {
                try {
                  const fileBuf = await fs.readFile(path.join(uploadPath, path.basename(payload.f)));
                  const contentHash = require('crypto').createHash('sha256').update(fileBuf).digest('hex');
                  if (contentHash !== payload.ch) {
                    throw Errors.UNAUTHORIZED('簽名已失效');
                  }
                } catch {
                  throw Errors.UNAUTHORIZED('簽名已失效');
                }
              }
            } catch {
              throw Errors.UNAUTHORIZED('簽名已失效');
            }
          }
          if (env.NODE_ENV !== 'production') {
            logger.info('Media access authorized', { file: payload.f, requestId: (req as any).requestId });
          }
          return next();
        }
      } catch {
        // ignore and fall through
      }
    }

    logger.warn('Media access denied', {
      file: req.path,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    throw Errors.UNAUTHORIZED('未授權的資源訪問');
  } catch (error) {
    next(error);
  }
};
