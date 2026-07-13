import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { Errors } from '../utils/errors';
import prisma from '../config/database';
import { validateSessionId } from '../utils/session';
import { sessionService } from '../services/session.service';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import logger from '../config/logger';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { getRequestId, getSessionIdFromSources } from '../utils/request';
import { buildSessionBoundCaseWhere } from '../utils/case-classifier';

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
    
    // 3. 檢查用戶是否存在且激活，並驗證 token_version
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        is_active: true,
        email_verified: true,
        token_version: true,
      },
    });
    
    if (!user || !user.is_active) {
      throw Errors.UNAUTHORIZED('用戶不存在或未激活');
    }
    if (!user.email_verified) {
      throw Errors.EMAIL_NOT_VERIFIED();
    }

    // 密碼變更後 token_version 會遞增，舊 Token 自動失效
    if ((decoded.token_version ?? 0) !== user.token_version) {
      throw Errors.UNAUTHORIZED('Token已失效，請重新登入');
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
          select: {
            id: true,
            email: true,
            is_active: true,
            email_verified: true,
            token_version: true,
          },
        });
        
        const versionOk = (decoded.token_version ?? 0) === user?.token_version;
        if (user && user.is_active && user.email_verified && versionOk) {
          req.user = {
            id: user.id,
            email: user.email,
          };
        }
      } catch (error) {
        logger.warn('Optional auth token invalid', {
          reason: (error as Error).message,
          requestId: getRequestId(req),
          ip: req.ip,
        });
      }
    }
    next();
  } catch (error) {
    logger.warn('Optional auth failed', { error, requestId: getRequestId(req) });
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
    const { sessionId, hasConflict } = getSessionIdFromSources(req);

    if (hasConflict) {
      throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
    }
    
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
    }).catch((e) => {
      logger.debug('Failed to update session last_accessed_at', { sessionId, error: e });
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

    // 嘗試簽名token（文件URL簽名）
    const token = (req.query.token as string) || undefined;
    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
          f?: string; h?: string; s?: number; m?: number; ch?: string;
        };
        const requestedPath = (() => {
          const p = req.path.startsWith('/') ? req.path.slice(1) : req.path;
          try { return decodeURIComponent(p); } catch { return p; }
        })();
        const requestedFile = path.basename(requestedPath);
        const hash = crypto.createHash('sha256').update(payload.f || '').digest('hex');
        const tokenFile = typeof payload?.f === 'string' ? path.basename(payload.f) : '';

        if (tokenFile && payload.h === hash && requestedFile === tokenFile) {
          // 如有 size/mtime，進一步驗證
          if (payload.s || payload.m) {
            try {
              const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
                ? env.UPLOAD_DIR
                : path.join(process.cwd(), env.UPLOAD_DIR);
              const stat = await fs.stat(path.join(uploadPath, tokenFile));
              if ((payload.s && stat.size !== payload.s) ||
                  (payload.m && Math.abs(stat.mtimeMs - payload.m) > 1)) {
                throw Errors.UNAUTHORIZED('簽名已失效');
              }
              // 驗證內容哈希（如存在），防止同名同尺寸重放
              if (payload.ch) {
                try {
                  const fileBuf = await fs.readFile(path.join(uploadPath, tokenFile));
                  const contentHash = crypto.createHash('sha256').update(fileBuf).digest('hex');
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
            logger.info('Media access authorized', { file: payload.f, requestId: getRequestId(req) });
          }
          return next();
        }
      } catch {
        // ignore and fall through
      }
    }

    const requestedPath = (() => {
      const p = req.path.startsWith('/') ? req.path.slice(1) : req.path;
      try { return decodeURIComponent(p); } catch { return p; }
    })();
    const requestedFile = path.basename(requestedPath);
    if (!requestedFile) {
      throw Errors.UNAUTHORIZED('未授權的資源訪問');
    }

    // 若同時攜帶兩種來源且值不一致，直接拒絕
    const { sessionId, hasConflict } = getSessionIdFromSources(req);
    if (hasConflict) {
      throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
    }

    // 嘗試 Session 驗證（session-bound 體驗）+ 文件歸屬校驗
    if (sessionId && validateSessionId(sessionId)) {
      const session = await sessionService.getSession(sessionId);
      if (session) {
        const evidence = await prisma.evidence.findFirst({
          where: {
            file_url: { contains: requestedFile },
            case: buildSessionBoundCaseWhere(sessionId),
          },
          select: { id: true },
        });
        if (evidence) {
          req.sessionId = sessionId;
          return next();
        }
      }
    }

    // 已登入用戶：需要校驗文件是否屬於其可訪問案件
    if (req.user?.id) {
      const evidence = await prisma.evidence.findFirst({
        where: {
          file_url: { contains: requestedFile },
          OR: [
            { user_id: req.user.id },
            { case: { plaintiff_id: req.user.id } },
            { case: { defendant_id: req.user.id } },
          ],
        },
        select: { id: true },
      });
      if (evidence) {
        return next();
      }
    }

    logger.warn('Media access denied', {
      file: req.path,
      ip: req.ip,
      requestId: getRequestId(req),
    });
    throw Errors.UNAUTHORIZED('未授權的資源訪問');
  } catch (error) {
    next(error);
  }
};
