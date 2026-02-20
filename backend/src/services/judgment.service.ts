import prisma from '../config/database';
import { normalizeJudgment } from '../utils/judgment';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { aiService } from './ai.service';
import { sessionService } from './session.service';
import { lockService } from '../utils/lock';
import { isResponsibilityRatio } from '../types/ai.types';
import { AI_TIMEOUT } from '../utils/constants';
import { cacheService, CacheService } from '../utils/cache';

/**
 * 判決服務類
 * 
 * 負責處理判決相關業務邏輯，包括：
 * - AI判決生成（帶並發控制和超時保護）
 * - 判決查詢和權限驗證
 * - 判決接受/拒絕處理
 * 
 * 關鍵特性：
 * - 使用分布式鎖防止並發生成
 * - 事務處理確保數據一致性
 * - 超時控制防止資源耗盡
 * - 唯一約束作為最後防線
 */
export class JudgmentService {
  /**
   * 生成判決（帶並發控制和事務處理）
   * 
   * 流程：
   * 1. 獲取分布式鎖（防止並發）
   * 2. 檢查是否已有判決（雙重檢查）
   * 3. 驗證案件狀態（必須為submitted）
   * 4. 調用AI服務生成判決（帶超時控制）
   * 5. 使用事務保存判決並更新案件狀態
   * 6. 處理唯一約束違規（競態條件最後防線）
   * 
   * @param caseId - 案件ID
   * @returns 生成的判決對象
   * @throws {Errors.NOT_FOUND} - 案件不存在
   * @throws {Errors.CASE_NOT_READY} - 案件狀態不允許生成判決
   * @throws {Errors.AI_SERVICE_ERROR} - AI服務錯誤或超時
   * @throws {Errors.VALIDATION_ERROR} - 責任分比例格式錯誤
   * @throws {Errors.CONFLICT} - 正在生成判決，請稍後
   */
  async generateJudgment(caseId: string, options?: { userId?: string; sessionId?: string }) {
    const lockKey = `judgment:lock:${caseId}`;
    let aiUsed = false;

    // 使用分布式鎖防止並發生成
    return await lockService.withLock(
      lockKey,
      async () => {
        // 1. 檢查是否已有判決（雙重檢查）
        const existing = await prisma.judgment.findUnique({
          where: { case_id: caseId },
        });

        if (existing) {
          logger.debug('Judgment already exists', { caseId, judgmentId: existing.id });
          return existing;
        }

        // 2. 獲取案件信息
        const case_ = await prisma.case.findUnique({
          where: { id: caseId },
        });

        if (!case_) {
          throw Errors.NOT_FOUND('案件不存在');
        }

        // 權限校驗：完整模式需當事人；快速體驗需匹配 Session
        if (case_.mode === 'quick') {
          if (!options?.sessionId || case_.session_id !== options.sessionId) {
            throw Errors.FORBIDDEN('無權限生成判決');
          }
        } else {
          const uid = options?.userId;
          if (!uid || (case_.plaintiff_id !== uid && case_.defendant_id !== uid)) {
            throw Errors.FORBIDDEN('無權限生成判決');
          }
        }

        // 允許重試：submitted / judgment_failed / in_progress（用於崩潰恢復）
        const allowedStatuses = new Set(['submitted', 'judgment_failed', 'in_progress']);
        if (!allowedStatuses.has(case_.status)) {
          throw Errors.CASE_NOT_READY();
        }

        // judgment_failed 增加冷卻時間，避免頻繁重試耗費 AI
        if (case_.status === 'judgment_failed' && case_.updated_at) {
          const cooldownMs = parseInt(process.env.JUDGMENT_RETRY_COOLDOWN_MS || '60000', 10);
          const sinceFail = Date.now() - new Date(case_.updated_at).getTime();
          if (sinceFail < cooldownMs) {
            throw Errors.CONFLICT('請稍後再重試生成判決');
          }
        }

        // 2.1 將狀態設為 in_progress（避免長時間停留在 submitted / judgment_failed）
        // 注意：如果服務在生成中崩潰，狀態可能停留 in_progress；允許再次調用進行恢復。
        if (case_.status !== 'in_progress') {
          await prisma.case.update({
            where: { id: caseId },
            data: { status: 'in_progress' },
          }).catch((err: any) => {
            logger.warn('Failed to set case status to in_progress', { caseId, error: err });
          });
        }

        // 3. 調用AI服務生成判決（帶超時控制）
        let judgmentContent: string;
        let responsibilityRatio: { plaintiff: number; defendant: number };
        let summary: string;
        let timedOut = false;
        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => {
          timedOut = true;
          abortController.abort();
        }, AI_TIMEOUT.JUDGMENT_GENERATION);

        try {
          const response = await aiService.generateJudgment(
            case_.type,
            case_.plaintiff_statement,
            case_.defendant_statement || '',
            { signal: abortController.signal }
          );

          judgmentContent = response.content;
          responsibilityRatio = response.responsibilityRatio;
          summary = response.summary;
          aiUsed = true;
        } catch (error: any) {
          const normalizedError = error?.message || error || '';
          logger.error('AI service error', { caseId, error: normalizedError });

          const msg = String(normalizedError);
          let failureReason = 'AI 服務暫時不可用，請稍後重試';
          if (timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')) {
            failureReason = 'AI 服務響應超時，請稍後再試';
          } else if (msg.includes('認證') || error?.status === 401) {
            failureReason = 'AI 服務認證失敗（請檢查 OPENAI_API_KEY）';
          } else if (msg.includes('過於頻繁') || error?.status === 429) {
            failureReason = 'AI 請求過於頻繁，請稍後再試';
          } else if (msg.includes('已達上限')) {
            failureReason = '今日 AI 調用已達上限';
          } else if (msg.includes('空內容')) {
            failureReason = 'AI 返回內容異常，請重試';
          }
          const reasonToStore = failureReason.slice(0, 500);

          try {
            await prisma.case.update({
              where: { id: caseId },
              data: {
                status: 'judgment_failed',
                judgment_failure_reason: reasonToStore,
                updated_at: new Date(),
              },
            });
            logger.info('Case status set to judgment_failed', { caseId, reason: reasonToStore });
          } catch (updateError: any) {
            logger.error('Failed to update case status to judgment_failed', {
              caseId,
              error: updateError,
            });
          }

          logger.error('Judgment generation failed', {
            caseId,
            error: normalizedError,
            status: 'judgment_failed',
          });

          if (timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')) {
            throw Errors.AI_SERVICE_ERROR('AI服務響應超時，請稍後再試');
          }
          throw Errors.AI_SERVICE_ERROR('AI服務暫時不可用，請稍後重試');
        } finally {
          clearTimeout(timeoutHandle);
        }

        // 4-6. 使用事務確保數據一致性
        // 4.1 檢查責任比例合法性（避免 DB 約束報錯）
        const ratioSum = responsibilityRatio.plaintiff + responsibilityRatio.defendant;
        if (Math.abs(ratioSum - 100) > 0.01 || responsibilityRatio.plaintiff < 0 || responsibilityRatio.defendant < 0) {
          throw Errors.VALIDATION_ERROR('責任分比例必須為非負且總和 100');
        }

        const judgment = await prisma.$transaction(async (tx: any) => {
          // 再次檢查（防止在生成過程中其他進程已創建）
          const existing2 = await tx.judgment.findUnique({
            where: { case_id: caseId },
          });
          if (existing2) {
            return existing2;
          }

          // 4. 驗證並保存判決
          if (!isResponsibilityRatio(responsibilityRatio)) {
            throw Errors.VALIDATION_ERROR('無效的責任分比例格式');
          }

          try {
          const newJudgment = await tx.judgment.create({
            data: {
              case_id: caseId,
              judgment_content: judgmentContent,
              summary,
              plaintiff_ratio: responsibilityRatio.plaintiff,
              defendant_ratio: responsibilityRatio.defendant,
              ai_model: 'gpt-3.5-turbo',
              prompt_version: 'v2.0',
            },
          });

          // 5. 更新案件狀態
          await tx.case.update({
            where: { id: caseId },
            data: {
              status: 'completed',
              completed_at: new Date(),
            },
          });

          return newJudgment;
          } catch (error: any) {
            // 處理唯一約束違規（case_id已存在）- 最後防線
            if (error.code === 'P2002' && error.meta?.target?.includes('case_id')) {
              // 如果違反唯一約束，說明在事務期間其他進程已創建判決
              // 重新查詢並返回已存在的判決
              const existingJudgment = await tx.judgment.findUnique({
                where: { case_id: caseId },
              });
              if (existingJudgment) {
                logger.info('Judgment was created by another process', { caseId });
                return existingJudgment;
              }
            }
            throw error;
          }
        });

        // 6. 快速體驗模式：標記Session為已完成（異步，不阻塞）
        if (case_.mode === 'quick' && case_.session_id) {
          sessionService.markSessionCompleted(case_.session_id).catch(err => {
            logger.warn('Failed to mark session completed', {
              error: err,
            });
          });
        }

        logger.info('Judgment generated', { caseId, judgmentId: judgment.id });

        return normalizeJudgment(judgment as any);
      },
      120 // 鎖定時間：120秒（足夠AI生成判決）
    ).catch(async (err) => {
      // 如果AI已調用但後續失敗，回補配額
      if (aiUsed) {
        const today = new Date().toISOString().split('T')[0];
        const countKey = CacheService.generateKey('ai:daily:count', today);
        await lockService.withLock(`lock:${countKey}`, async () => {
          const count = (await cacheService.get<number>(countKey)) || 0;
          await cacheService.set(countKey, Math.max(0, count - 1), 24 * 60 * 60);
        }, 5).catch(() => {});
      }
      throw err;
    });
  }

  /**
   * 獲取判決詳情（優化查詢）
   */
  async getJudgmentByCaseId(caseId: string, userId?: string, sessionId?: string) {
    // 1. 獲取案件（驗證權限，優化查詢）
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        pairing: {
          select: {
            user1_id: true,
            user2_id: true,
          },
        },
      },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    // 快速體驗模式：驗證Session ID
    if (case_.mode === 'quick') {
      if (!sessionId || case_.session_id !== sessionId) {
        throw Errors.FORBIDDEN('無權限訪問此判決');
      }

      // 追加：驗證Session是否存在且未過期（保持有效期規則一致）
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw Errors.SESSION_EXPIRED();
      }

      // 判決生成失敗：前端可顯示重試按鈕
      if (case_.status === 'judgment_failed') {
        throw Errors.JUDGMENT_FAILED('判決生成失敗，請點擊重試');
      }
    } else {
      // 完整模式：驗證用戶權限
      if (!userId) {
        throw Errors.UNAUTHORIZED('需要認證');
      }

      if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
        throw Errors.FORBIDDEN('無權限訪問此判決');
      }
    }

    // 2. 獲取判決（包含關聯數據）
    const judgment = await prisma.judgment.findUnique({
      where: { case_id: caseId },
      include: {
        reconciliation_plans: {
          orderBy: { created_at: 'desc' },
          take: 10, // 限制返回數量
        },
      },
    });

    if (!judgment) {
      // 如果判決尚未生成，返回null（前端可以顯示"生成中"）
      return null;
    }

    return normalizeJudgment(judgment as any);
  }

  /**
   * 接受/拒絕判決（僅完整模式）
   */
  async acceptJudgment(
    judgmentId: string,
    userId: string,
    accepted: boolean,
    rating?: number
  ) {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: {
        case: true,
      },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('判決不存在');
    }

    // 驗證用戶權限
    if (judgment.case.plaintiff_id !== userId && judgment.case.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限操作此判決');
    }

    // 確定是user1還是user2
    const isUser1 = judgment.case.plaintiff_id === userId;

    // 更新判決
    const updatedJudgment = await prisma.judgment.update({
      where: { id: judgmentId },
      data: {
        ...(isUser1
          ? {
              user1_acceptance: accepted,
              user1_rating: rating,
            }
          : {
              user2_acceptance: accepted,
              user2_rating: rating,
            }),
      },
    });

    return updatedJudgment;
  }
}

export const judgmentService = new JudgmentService();
