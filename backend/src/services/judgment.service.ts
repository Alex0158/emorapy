import prisma from '../config/database';
import { Prisma, type Judgment } from '@prisma/client';
import { normalizeJudgmentWithSafetyState } from './judgment-normalization.service';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { aiService } from './ai.service';
import { AI_CONFIG } from '../config/openai';
import { sessionService } from './session.service';
import { lockService } from '../utils/lock';
import { isResponsibilityRatio } from '../types/ai.types';
import { AI_TIMEOUT, CASE_STATUS, CASE_MODE } from '../utils/constants';
import { cacheService, CacheService } from '../utils/cache';
import { safetyRoutingService } from './safety-routing.service';
import { ruptureRepairService } from './rupture-repair.service';
import { clinicalQualityService } from './clinical-quality.service';
import { env } from '../config/env';
import { aiStreamService, type AIStreamHandle } from './ai-stream.service';
import { buildAIStreamFailurePayload } from './ai-stream-failure-payload-utils';
import type { BackendLocale } from '../i18n';
import {
  buildCaseSourceTrackingForRead,
  canAccessSessionBoundCase,
  isCaseParticipant,
  isSessionBoundCase,
} from '../utils/case-classifier';
import {
  getJudgmentMetricsPromptVersion,
  getStoredJudgmentPromptVersion,
} from '../utils/ai-prompt-version';
import { chatContextPolicyService } from './chat-context-policy.service';
import { judgmentDeliveryRendererService } from './judgment-delivery-renderer.service';
import {
  chatAnalysisEvidenceService,
  type SubmittedAnalysisEvidenceBundle,
} from './chat-analysis-evidence.service';

export type GenerateJudgmentOptions = {
  userId?: string;
  sessionId?: string;
  locale?: BackendLocale;
  expectedChatAnalysisRequestId?: string;
};

interface ContextGovernanceAudit {
  profileContext: {
    enabled: boolean;
    injected: boolean;
    reason: string;
    requireConsent: boolean;
    profileMaxAgeDays: number;
    sources: string[];
    droppedParts: number;
    totalTokens: number;
    keptTokens: number;
  };
  caseContext: {
    enabled: boolean;
    injected: boolean;
    reason: string;
  };
  delivery: {
    privateContentReadByDecisionCore: false;
    controlsApplied: boolean;
    policyVersion: string | null;
    rendererVersion: string;
  };
}

// ─── 判決服務主體 ──────────────────────────────────

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
  private async publishJudgmentFinalizationBestEffort(
    streamHandle: AIStreamHandle,
    caseId: string,
    judgment: {
      id: string;
      judgment_content: string;
      summary: string | null;
      plaintiff_ratio: number;
      defendant_ratio: number;
    },
  ): Promise<void> {
    try {
      await aiStreamService.completed(streamHandle, {
        actorRole: 'ai',
        phase: 'completed',
        fullText: judgment.judgment_content,
        metadata: { judgmentId: judgment.id, caseId },
      });
    } catch (error) {
      logger.warn('Failed to publish persisted judgment completion stream event', {
        caseId,
        judgmentId: judgment.id,
        error,
      });
    }

    try {
      await aiStreamService.persisted(streamHandle, {
        actorRole: 'ai',
        phase: 'completed',
        fullText: judgment.judgment_content,
        messageId: judgment.id,
        metadata: {
          judgmentId: judgment.id,
          caseId,
          summary: judgment.summary,
          plaintiffRatio: judgment.plaintiff_ratio,
          defendantRatio: judgment.defendant_ratio,
        },
      });
    } catch (error) {
      logger.warn('Failed to publish persisted judgment stream event', {
        caseId,
        judgmentId: judgment.id,
        error,
      });
    }
  }

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
  async generateJudgment(caseId: string, options?: GenerateJudgmentOptions) {
    const lockKey = `judgment:lock:${caseId}`;
    let aiUsed = false;
    let judgmentPersisted = false;
    let claimedAnalysisEvidence: SubmittedAnalysisEvidenceBundle | null = null;
    const locale = options?.locale ?? 'zh-TW';
    const streamHandle = await aiStreamService.createStream('case_judgment', caseId);

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
          await this.publishJudgmentFinalizationBestEffort(streamHandle, caseId, existing);
          return existing;
        }

        // 2. 獲取案件信息
        const case_ = await prisma.case.findUnique({
          where: { id: caseId },
          include: {
            chat_to_case_links: {
              select: { id: true, room_id: true, conversion_snapshot: true },
              take: 1,
            },
            quick_sessions: { select: { id: true } },
          },
        });

        if (!case_) {
          throw Errors.NOT_FOUND('案件不存在');
        }

        // 權限校驗：匿名 quick/collaborative 需匹配 Session；完整模式需當事人
        if (isSessionBoundCase(case_)) {
          if (!canAccessSessionBoundCase(case_, options?.sessionId)) {
            throw Errors.FORBIDDEN('無權限生成梳理結果');
          }
        } else {
          const uid = options?.userId;
          if (!isCaseParticipant(case_, uid)) {
            throw Errors.FORBIDDEN('無權限生成梳理結果');
          }
        }

        // 允許重試：submitted / judgment_failed / in_progress（用於崩潰恢復）
        const allowedStatuses: string[] = [CASE_STATUS.SUBMITTED, CASE_STATUS.JUDGMENT_FAILED, CASE_STATUS.IN_PROGRESS];
        if (!allowedStatuses.includes(case_.status)) {
          throw Errors.CASE_NOT_READY();
        }

        const sourceChatLink = case_.chat_to_case_links?.[0];
        if (sourceChatLink) {
          claimedAnalysisEvidence = await chatAnalysisEvidenceService.claimCaseGeneration(
            {
              roomId: sourceChatLink.room_id,
              conversionSnapshot: sourceChatLink.conversion_snapshot,
              hasDefendantMaterial: Boolean(case_.defendant_statement?.trim()),
              expectedRequestId: options?.expectedChatAnalysisRequestId,
            },
            { userId: options?.userId, sessionId: options?.sessionId },
          );
        }

        // judgment_failed 增加冷卻時間，避免頻繁重試耗費 AI
        if (case_.status === CASE_STATUS.JUDGMENT_FAILED && case_.updated_at) {
          const cooldownMs = parseInt(process.env.JUDGMENT_RETRY_COOLDOWN_MS || '60000', 10);
          const sinceFail = Date.now() - new Date(case_.updated_at).getTime();
          if (sinceFail < cooldownMs) {
            throw Errors.CONFLICT('請稍後再重試生成梳理結果');
          }
        }

        // 2.1 將狀態設為 in_progress（避免長時間停留在 submitted / judgment_failed）
        // 注意：如果服務在生成中崩潰，狀態可能停留 in_progress；允許再次調用進行恢復。
        if (case_.status !== CASE_STATUS.IN_PROGRESS) {
          await prisma.case.update({
            where: { id: caseId },
            data: { status: CASE_STATUS.IN_PROGRESS },
          }).catch((err: unknown) => {
            logger.warn('Failed to set case status to in_progress', { caseId, error: err });
          });
        }

        await aiStreamService.start(streamHandle, {
          actorRole: 'ai',
          phase: 'collecting_context',
          metadata: {
            caseId,
            caseType: case_.type,
            caseMode: case_.mode,
          },
        });

        // Wave 0 containment: formal Analysis is evidence-only. Private profiles,
        // cross-case context, and profile snapshots are not read by this path.
        const governanceAudit: ContextGovernanceAudit = {
          profileContext: {
            enabled: false,
            injected: false,
            reason: 'formal_evidence_only_containment',
            requireConsent: true,
            profileMaxAgeDays: 0,
            sources: [],
            droppedParts: 0,
            totalTokens: 0,
            keptTokens: 0,
          },
          caseContext: {
            enabled: false,
            injected: false,
            reason: 'formal_evidence_only_containment',
          },
          delivery: {
            privateContentReadByDecisionCore: false,
            controlsApplied: false,
            policyVersion: null,
            rendererVersion: 'judgment-delivery-renderer@v1.0',
          },
        };

        // 3. 調用AI服務生成判決（帶超時控制）
        let judgmentContent: string;
        let responsibilityRatio: { plaintiff: number; defendant: number };
        let summary: string;
        let emotionalAnalysisData: unknown = null;
        let routeDecision: { route: 'standard' | 'safety_support' | 'crisis_support'; reasons: string[]; detectedFlags: string[] } = {
          route: 'standard',
          reasons: ['default route'],
          detectedFlags: [],
        };
        const caseSourceTracking = buildCaseSourceTrackingForRead(case_);
        const aiLedgerBase = {
          streamId: streamHandle.streamId,
          scopeType: streamHandle.scopeType,
          scopeId: streamHandle.scopeId,
          productFlow: caseSourceTracking.product_flow,
          sourceChannel: caseSourceTracking.source_channel,
          entryPoint: caseSourceTracking.entry_point,
          metadata: {
            parent_request_id: streamHandle.requestId,
            case_id: caseId,
            case_mode: case_.mode,
            case_type: case_.type,
          },
        };
        let timedOut = false;
        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => {
          timedOut = true;
          abortController.abort();
        }, AI_TIMEOUT.JUDGMENT_GENERATION);

        try {
          await aiStreamService.phase(streamHandle, 'analyzing_emotion', {
            actorRole: 'ai',
            metadata: { caseId },
          });
          const prefetchedAnalysis = await aiService.analyzeEmotionalDynamics(
            case_.plaintiff_statement,
            case_.defendant_statement || '',
            abortController.signal,
            undefined,
            {
              ...aiLedgerBase,
              requestKind: 'judgment_emotional_analysis',
            },
            locale
          );

          routeDecision = safetyRoutingService.decideRoute({
            analysis: prefetchedAnalysis,
            plaintiffStatement: case_.plaintiff_statement,
            defendantStatement: case_.defendant_statement || '',
          });

          await aiStreamService.phase(streamHandle, 'building_responsibility', {
            actorRole: 'ai',
            metadata: {
              route: routeDecision.route,
              detectedFlags: routeDecision.detectedFlags,
            },
          });
          const response = await aiService.generateJudgment(
            case_.type,
            case_.plaintiff_statement,
            case_.defendant_statement || '',
            {
              signal: abortController.signal,
              routeType: routeDecision.route,
              prefetchedAnalysis,
              ledger: {
                ...aiLedgerBase,
                metadata: {
                  ...aiLedgerBase.metadata,
                  route: routeDecision.route,
                },
              },
              locale,
            }
          );

          await aiStreamService.phase(streamHandle, 'drafting_judgment', {
            actorRole: 'ai',
            metadata: {
              route: routeDecision.route,
            },
          });
          const decisionCore = {
            content: response.content,
            summary: response.summary,
            responsibilityRatio: response.responsibilityRatio,
            emotionalAnalysis: response.emotionalAnalysis,
          };
          let delivery = judgmentDeliveryRendererService.render(decisionCore, null, locale);
          const sourceRoomId = case_.chat_to_case_links?.[0]?.room_id;
          if (sourceRoomId) {
            try {
              const deliveryBundle = await chatContextPolicyService.resolveFormalAnalysisDelivery(
                sourceRoomId,
              );
              delivery = judgmentDeliveryRendererService.render(
                decisionCore,
                deliveryBundle.controls,
                locale,
              );
              governanceAudit.delivery.policyVersion = deliveryBundle.policyVersion;
            } catch (error) {
              logger.warn('Judgment delivery controls unavailable; using evidence-only core', {
                caseId,
                roomId: sourceRoomId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          judgmentContent = delivery.content;
          responsibilityRatio = delivery.responsibilityRatio;
          summary = delivery.summary;
          governanceAudit.delivery.controlsApplied = delivery.deliveryReceipt.controlsApplied;
          governanceAudit.delivery.rendererVersion = delivery.deliveryReceipt.rendererVersion;
          if (env.JUDGMENT_CONTEXT_AUDIT_ENABLED) {
            logger.info('Judgment context governance audit', {
              caseId,
              profileContext: governanceAudit.profileContext,
              caseContext: governanceAudit.caseContext,
            });
          }
          emotionalAnalysisData = delivery.emotionalAnalysis
            ? {
              ...(JSON.parse(JSON.stringify(delivery.emotionalAnalysis)) as Record<string, unknown>),
              route: routeDecision.route,
              route_reasons: routeDecision.reasons,
              route_detected_flags: routeDecision.detectedFlags,
              delivery_governance: governanceAudit.delivery,
              ...(env.JUDGMENT_CONTEXT_AUDIT_ENABLED
                ? { context_governance: governanceAudit }
                : {}),
            }
            : {
              route: routeDecision.route,
              route_reasons: routeDecision.reasons,
              route_detected_flags: routeDecision.detectedFlags,
              delivery_governance: governanceAudit.delivery,
              ...(env.JUDGMENT_CONTEXT_AUDIT_ENABLED
                ? { context_governance: governanceAudit }
                : {}),
            };
          aiUsed = true;
        } catch (error: unknown) {
          const errObj = error as { message?: string; status?: number } | undefined;
          const normalizedError = errObj?.message || String(error || '');
          logger.error('AI service error', { caseId, error: normalizedError });

          const msg = String(normalizedError);
          let failureReason = 'AI 服務暫時不可用，請稍後重試';
          if (timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')) {
            failureReason = 'AI 服務響應超時，請稍後再試';
          } else if (msg.includes('認證') || errObj?.status === 401) {
            failureReason = 'AI 服務認證失敗（請檢查 OPENAI_API_KEY）';
          } else if (msg.includes('過於頻繁') || errObj?.status === 429) {
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
                status: CASE_STATUS.JUDGMENT_FAILED,
                judgment_failure_reason: reasonToStore,
                updated_at: new Date(),
              },
            });
            logger.info('Case status set to judgment_failed', { caseId, reason: reasonToStore });
          } catch (updateError: unknown) {
            logger.error('Failed to update case status to judgment_failed', {
              caseId,
              error: updateError,
            });
          }

          logger.error('Judgment generation failed', {
            caseId,
            error: normalizedError,
            status: CASE_STATUS.JUDGMENT_FAILED,
            routeDecision,
          });

          await aiStreamService.failed(
            streamHandle,
            buildAIStreamFailurePayload({
              code: timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')
                ? 'JUDGMENT_STREAM_TIMEOUT'
                : 'JUDGMENT_STREAM_FAILED',
              message: reasonToStore,
              locale: options?.locale,
              retryable: true,
            }),
            {
              actorRole: 'ai',
              phase: 'finalizing',
              metadata: {
                caseId,
                route: routeDecision.route,
              },
            }
          );

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

        await aiStreamService.phase(streamHandle, 'finalizing', {
          actorRole: 'ai',
          metadata: {
            caseId,
            plaintiffRatio: responsibilityRatio.plaintiff,
            defendantRatio: responsibilityRatio.defendant,
          },
        });

        const judgment = await prisma.$transaction(async (tx) => {
          const completeAnalysisRequest = async () => {
            if (!claimedAnalysisEvidence) return;
            await chatAnalysisEvidenceService.markCompleted(
              claimedAnalysisEvidence.requestId,
              tx,
            );
          };

          // 再次檢查（防止在生成過程中其他進程已創建）
          const existing2 = await tx.judgment.findUnique({
            where: { case_id: caseId },
          });
          if (existing2) {
            await completeAnalysisRequest();
            return existing2;
          }

          // 4. 驗證並保存判決
          if (!isResponsibilityRatio(responsibilityRatio)) {
            throw Errors.VALIDATION_ERROR('無效的責任分比例格式');
          }

          // AI 輸出清洗：限制長度、移除潛在 HTML/script
          const sanitizeAIOutput = (text: string, maxLen: number): string => {
            return text
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
              .replace(/on\w+="[^"]*"/gi, '')
              .slice(0, maxLen);
          };
          const safeContent = sanitizeAIOutput(judgmentContent, 50000);
          const safeSummary = sanitizeAIOutput(summary, 2000);

          let persistedJudgment: Judgment;
          try {
            persistedJudgment = await tx.judgment.create({
              data: {
                case_id: caseId,
                judgment_content: safeContent,
                summary: safeSummary,
                plaintiff_ratio: responsibilityRatio.plaintiff,
                defendant_ratio: responsibilityRatio.defendant,
                emotional_analysis: (emotionalAnalysisData ?? undefined) as Prisma.InputJsonValue | undefined,
                ai_model: AI_CONFIG.model,
                prompt_version: getStoredJudgmentPromptVersion(),
              },
            });
          } catch (error: unknown) {
            const prismaErr = error as { code?: string; meta?: { target?: string[] } };
            const isUniqueConflict = prismaErr.code === 'P2002';
            const targetsCaseId =
              Array.isArray(prismaErr.meta?.target) && prismaErr.meta.target.includes('case_id');
            if (isUniqueConflict) {
              // Prisma/Postgres may omit meta.target for this unique index. The case_id
              // lookup is still the only safe idempotent recovery for this code path.
              const existingJudgment = await tx.judgment.findUnique({
                where: { case_id: caseId },
              });
              if (existingJudgment) {
                logger.info('Judgment was created by another process', {
                  caseId,
                  target: targetsCaseId ? 'case_id' : 'unknown',
                });
                persistedJudgment = existingJudgment;
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }

          // 5. 更新案件狀態與 exact request lifecycle。這些步驟的錯誤不可
          // 被誤認成 Judgment unique race；整個 transaction 必須回滾。
          await tx.case.update({
            where: { id: caseId },
            data: {
              status: CASE_STATUS.COMPLETED,
              completed_at: new Date(),
            },
          });
          await completeAnalysisRequest();

          return persistedJudgment;
        });
        judgmentPersisted = true;

        // 6. Session-bound 體驗：標記 Session 為已完成（異步，不阻塞）
        const completedSessionId = isSessionBoundCase(case_) ? options?.sessionId ?? case_.session_id : null;
        if (completedSessionId) {
          sessionService.markSessionCompleted(completedSessionId).catch(err => {
            logger.warn('Failed to mark session completed', {
              error: err,
            });
          });
        }

        logger.info('Judgment generated', { caseId, judgmentId: judgment.id });

        await this.publishJudgmentFinalizationBestEffort(streamHandle, caseId, judgment);

        return normalizeJudgmentWithSafetyState(judgment, { caseId });
      },
      120 // 鎖定時間：120秒（足夠AI生成判決）
    ).catch(async (err) => {
      // 如果AI已調用但後續失敗，回補配額
      if (aiUsed && !judgmentPersisted) {
        const today = new Date().toISOString().split('T')[0];
        const countKey = CacheService.generateKey('ai:daily:count', today);
        await lockService.withLock(`lock:${countKey}`, async () => {
          const count = (await cacheService.get<number>(countKey)) || 0;
          await cacheService.set(countKey, Math.max(0, count - 1), 24 * 60 * 60);
        }, 5).catch((e) => { logger.warn('Failed to rollback AI daily quota', { error: e }); });
      }
      throw err;
    });
  }

  async repairJudgmentResponse(
    judgmentId: string,
    feedback: string,
    options?: { userId?: string; sessionId?: string }
  ): Promise<{ repairedContent: string; repairType: 'validation' | 'apology_tone_fix' | 'strategy_reset' }> {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: { case: { include: { quick_sessions: { select: { id: true } } } } },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('梳理結果不存在');
    }

    if (isSessionBoundCase(judgment.case)) {
      if (!canAccessSessionBoundCase(judgment.case, options?.sessionId)) {
        throw Errors.FORBIDDEN('無權限修復此梳理結果');
      }
    } else {
      const uid = options?.userId;
      if (!uid || (judgment.case.plaintiff_id !== uid && judgment.case.defendant_id !== uid)) {
        throw Errors.FORBIDDEN('無權限修復此梳理結果');
      }
    }

    const trimmedFeedback = (feedback || '').trim();
    if (trimmedFeedback.length < 3) {
      throw Errors.VALIDATION_ERROR('回饋內容過短');
    }

    const emotional = (judgment.emotional_analysis || {}) as Record<string, unknown>;
    const route = (typeof emotional.route === 'string' ? emotional.route : 'standard') as 'standard' | 'safety_support' | 'crisis_support';

    return ruptureRepairService.repair({
      judgmentContent: judgment.judgment_content,
      userFeedback: trimmedFeedback,
      caseType: judgment.case.type,
      route,
    });
  }

  async recordClinicalMetrics(
    judgmentId: string,
    metrics: {
      felt_understood: number;
      felt_blamed: number;
      willing_to_try: number;
    },
    options?: { userId?: string; sessionId?: string }
  ): Promise<{ recorded: true }> {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: { case: { include: { quick_sessions: { select: { id: true } } } } },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('梳理結果不存在');
    }

    if (isSessionBoundCase(judgment.case)) {
      if (!canAccessSessionBoundCase(judgment.case, options?.sessionId)) {
        throw Errors.FORBIDDEN('無權限提交此梳理結果指標');
      }
    } else {
      const uid = options?.userId;
      if (!uid || (judgment.case.plaintiff_id !== uid && judgment.case.defendant_id !== uid)) {
        throw Errors.FORBIDDEN('無權限提交此梳理結果指標');
      }
    }

    const emotional = (judgment.emotional_analysis || {}) as Record<string, unknown>;
    const route = (typeof emotional.route === 'string' ? emotional.route : 'standard') as 'standard' | 'safety_support' | 'crisis_support';

    await clinicalQualityService.recordPostResponseMetrics({
      judgmentId: judgment.id,
      promptVersion: getJudgmentMetricsPromptVersion(judgment.prompt_version),
      caseType: judgment.case.type,
      route,
      feltUnderstood: metrics.felt_understood,
      feltBlamed: metrics.felt_blamed,
      willingToTry: metrics.willing_to_try,
    });

    return { recorded: true };
  }

  /**
   * 獲取判決詳情（優化查詢）
   */
  async getJudgmentByCaseId(caseId: string, userId?: string, sessionId?: string) {
    // 1. 獲取案件（驗證權限，優化查詢）
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        quick_sessions: {
          select: { id: true },
        },
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

    // session-bound 模式（quick / collaborative with session_id）：驗證 Session ID
    if (isSessionBoundCase(case_)) {
      if (!sessionId || !canAccessSessionBoundCase(case_, sessionId)) {
        throw Errors.FORBIDDEN('無權限訪問此梳理結果');
      }

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw Errors.SESSION_EXPIRED();
      }

      if (case_.status === CASE_STATUS.JUDGMENT_FAILED) {
        throw Errors.JUDGMENT_FAILED('梳理結果生成失敗，請點擊重試');
      }
    } else {
      // 完整模式：驗證用戶權限
      if (!userId) {
        throw Errors.UNAUTHORIZED('需要認證');
      }

      if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
        throw Errors.FORBIDDEN('無權限訪問此梳理結果');
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

    return normalizeJudgmentWithSafetyState(judgment, { caseId });
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
      throw Errors.NOT_FOUND('梳理結果不存在');
    }

    // 驗證用戶權限
    if (judgment.case.plaintiff_id !== userId && judgment.case.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限操作此梳理結果');
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

    return normalizeJudgmentWithSafetyState(updatedJudgment);
  }
}

export const judgmentService = new JudgmentService();
