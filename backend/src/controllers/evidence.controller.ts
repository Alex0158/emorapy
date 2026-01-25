import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { fileService, upload } from '../services/file.service';
import logger from '../config/logger';
import { sessionService } from '../services/session.service';

export class EvidenceController {
  /**
   * 上傳證據（支持快速體驗和完整模式）
   */
  uploadEvidence = [
    upload.array('files', 3),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const caseId = req.params.id;
        const files = req.files as Express.Multer.File[];
        const userId = (req as any).user?.id;
        const sessionId = (req.query.session_id as string) || 
                          (req.headers['x-session-id'] as string);

        if (!files || files.length === 0) {
          throw Errors.VALIDATION_ERROR('請選擇要上傳的文件');
        }

        // 驗證案件是否存在
        const case_ = await prisma.case.findUnique({
          where: { id: caseId },
        });

        if (!case_) {
          throw Errors.NOT_FOUND('案件不存在');
        }

        // 驗證權限
        if (case_.mode === 'quick') {
          // 快速體驗模式：驗證Session ID
          if (!sessionId || case_.session_id !== sessionId) {
            throw Errors.FORBIDDEN('無權限上傳證據');
          }
          // 追加：驗證Session是否存在且未過期（保持有效期規則一致）
          const session = await sessionService.getSession(sessionId);
          if (!session) {
            throw Errors.SESSION_EXPIRED();
          }
        } else {
          // 完整模式：驗證用戶權限
          if (!userId) {
            throw Errors.UNAUTHORIZED('需要認證');
          }
          if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
            throw Errors.FORBIDDEN('無權限上傳證據');
          }
        }

        // 驗證案件狀態
        if (case_.status !== 'draft' && case_.status !== 'submitted') {
          throw Errors.CASE_NOT_EDITABLE('案件狀態不允許上傳證據');
        }

        // 檢查現有證據數量
        const existingEvidences = await prisma.evidence.count({
          where: { case_id: caseId },
        });

        if (existingEvidences + files.length > 3) {
          throw Errors.TOO_MANY_FILES('每個案件最多只能上傳3張圖片');
        }

        // 驗證並保存文件
        const evidences = [];
        for (const file of files) {
          // 使用異步文件驗證（包括魔數驗證）
          await fileService.validateFile(file);
          // 媒體處理（壓縮/轉碼）
          let processed = { filename: file.filename, size: file.size, mimetype: file.mimetype };
          if (file.mimetype.startsWith('image/')) {
            processed = await fileService.processImage(file);
          } else if (file.mimetype.startsWith('video/')) {
            processed = await fileService.processVideo(file);
          }

          const evidence = await prisma.evidence.create({
            data: {
              case_id: caseId,
              user_id: userId || null,
              file_url: fileService.getFileUrl(processed.filename),
              file_type: processed.mimetype.startsWith('image/') ? 'image' : 'video',
              file_size: processed.size,
            },
          });

          evidences.push({
            ...evidence,
            file_url: fileService.signUrl(evidence.file_url),
          });
        }

        logger.info('Evidence uploaded', { caseId, count: evidences.length });

        res.json({
          success: true,
          data: { evidences },
          message: '證據上傳成功',
        });
      } catch (error) {
        next(error);
      }
    },
  ];
}

export const evidenceController = new EvidenceController();

/**
 * 刪除證據（需要權限）
 */
export const deleteEvidence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evidenceId = req.params.evidenceId;
    const userId = (req as any).user?.id;
    const sessionId = (req.query.session_id as string) || (req.headers['x-session-id'] as string);

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        case: true,
      },
    });

    if (!evidence) {
      throw Errors.NOT_FOUND('證據不存在');
    }

    const case_ = evidence.case;

    // 快速體驗：驗證 session
    if (case_.mode === 'quick') {
      if (!sessionId || case_.session_id !== sessionId) {
        throw Errors.FORBIDDEN('無權限刪除此證據');
      }
      const session = await sessionService.getSession(sessionId);
      if (!session) throw Errors.SESSION_EXPIRED();
    } else {
      // 完整模式：需當事人
      if (!userId || (case_.plaintiff_id !== userId && case_.defendant_id !== userId)) {
        throw Errors.FORBIDDEN('無權限刪除此證據');
      }
    }

    // 刪文件
    const filename = (() => {
      try {
        return new URL(evidence.file_url).pathname.split('/').pop() || '';
      } catch {
        return evidence.file_url.split('/').pop() || '';
      }
    })();
    if (filename) {
      await fileService.deleteFile(filename);
    }

    // 刪 DB 記錄
    await prisma.evidence.delete({ where: { id: evidenceId } });

    res.json({
      success: true,
      data: {},
      message: '證據已刪除',
    });
  } catch (error) {
    next(error);
  }
};
