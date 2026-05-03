import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { aiService } from './ai.service';
import { sessionService } from './session.service';
import { pairingService } from './pairing.service';
import { ValidationUtils } from '../utils/validation';
import { validateSessionId } from '../utils/session';
import { fileService, signAvatar } from './file.service';
import { normalizeJudgment } from '../utils/judgment';
import { lockService } from '../utils/lock';
import { LOCK_TTL, SESSION_EXPIRY, CASE_STATUS, CASE_MODE, PAGINATION, FILE_TYPE, PAIRING_STATUS } from '../utils/constants';
import { getCaseProductFlow, isCaseParticipant, isSessionBoundCase } from '../utils/case-classifier';
import { getFormalCaseCreatePolicy } from '../utils/product-safety-policy';

export interface QuickCaseDto {
  plaintiff_statement: string;
  defendant_statement?: string;
  evidence_urls?: string[];
}

export interface CreateCaseDto {
  pairing_id: string;
  title?: string;
  type?: string;
  sub_type?: string;
  plaintiff_statement: string;
  defendant_statement?: string;
  evidence_urls?: string[];
  mode?: 'remote' | 'collaborative';
  safety_assertion?: unknown;
  safetyAssertion?: unknown;
  contains_minor?: unknown;
  contains_sensitive_content?: unknown;
  contains_nonconsensual_content?: unknown;
  contains_illegal_content?: unknown;
  minor_guardian_or_self_upload_confirmed?: unknown;
  sensitive_content_handling_ack?: unknown;
}

export class CaseService {
  /**
   * 創建快速體驗案件
   */
  async createQuickCase(
    data: QuickCaseDto, 
    sessionId: string | null  // 允許為null，由服務層統一處理
  ) {
    let finalSessionId: string;
    
    // 統一處理Session：驗證 → 創建（如需要）
    if (!sessionId || !validateSessionId(sessionId)) {
      // 如果沒有Session ID或格式錯誤，創建新的
      logger.info('Creating new session (no session ID provided or invalid format)', { sessionId });
      const newSession = await sessionService.createSession();
      finalSessionId = newSession.session_id;
    } else {
      // 驗證Session是否存在且未過期
      const session = await sessionService.getSession(sessionId);
      
      if (!session) {
        // Session不存在或已過期，創建新的
        logger.warn('Session not found or expired, creating new session', { sessionId });
        const newSession = await sessionService.createSession();
        finalSessionId = newSession.session_id;
      } else {
        // Session有效，使用原Session ID
        finalSessionId = sessionId;
      }
    }

    // 2-4. 使用統一驗證工具
    const plaintiffStatement = ValidationUtils.validateStatement(
      data.plaintiff_statement,
      '原告陳述',
      30
    );
    let defendantStatement: string | null = null;
    if (data.defendant_statement && data.defendant_statement.trim().length > 0) {
      defendantStatement = ValidationUtils.validateStatement(
        data.defendant_statement,
        '被告陳述',
        10
      );
    }

    if (data.evidence_urls) {
      ValidationUtils.validateEvidenceUrls(data.evidence_urls);
    }

    // 5. AI自動判斷案件類型（帶錯誤處理）
    let caseType: string;
    try {
      caseType = await aiService.detectCaseType(
        data.plaintiff_statement,
        defendantStatement || ''
      );
    } catch (error) {
      logger.error('Failed to detect case type', { error, sessionId });
      caseType = '其他衝突'; // 默認類型
    }

    return lockService.withLock(`quick-case:create:${finalSessionId}`, async () => {
      // 確保Session存在（最終驗證）
      let sessionIdToUse = finalSessionId;
      let session = await sessionService.getSession(sessionIdToUse);
      if (session?.case_id) {
        // 同一 Session 已有案件，為本次體驗分配新 Session，避免競態下共用同一 session
        const newSession = await sessionService.createSession();
        sessionIdToUse = newSession.session_id;
        session = await sessionService.getSession(sessionIdToUse);
      }

      if (!session) {
        throw Errors.INTERNAL_ERROR('Session創建失敗');
      }

      const existingTempPairing = await pairingService.getPairingBySessionId(sessionIdToUse);
      const tempPairing = existingTempPairing || await pairingService.createTempPairing(sessionIdToUse);
      const pairingCreatedNow = !existingTempPairing;

      // 7. 生成案件標題（帶錯誤處理）
      let title: string;
      try {
        title = this.generateTitle(data.plaintiff_statement);
      } catch (error) {
        logger.warn('Failed to generate title', { error });
        title = '案件-' + new Date().toLocaleDateString(); // 默認標題
      }

      // 8-10. 使用事務確保數據一致性
      const case_ = await prisma.$transaction(async (tx) => {
        const newCase = await tx.case.create({
          data: {
            pairing_id: tempPairing.id,
            title,
            type: caseType,
            plaintiff_id: null,
            defendant_id: null,
            plaintiff_statement: plaintiffStatement,
            defendant_statement: defendantStatement,
            status: CASE_STATUS.SUBMITTED,
            mode: CASE_MODE.QUICK,
            session_id: sessionIdToUse,
            submitted_at: new Date(),
          },
        });

        if (data.evidence_urls && data.evidence_urls.length > 0) {
          await tx.evidence.createMany({
            data: data.evidence_urls.map(url => ({
              case_id: newCase.id,
              file_url: url,
              file_type: FILE_TYPE.IMAGE,
              file_size: 0,
              user_id: null,
            })),
          });
        }

        await tx.quickSession.update({
          where: { id: sessionIdToUse },
          data: {
            case_id: newCase.id,
            pairing_id: tempPairing.id,
          },
        });

        return newCase;
      }).catch(async (error: unknown) => {
        if (pairingCreatedNow) {
          await prisma.pairing.delete({ where: { id: tempPairing.id } }).catch((e) => {
            logger.warn('Failed to rollback temp pairing', { pairingId: tempPairing.id, error: e });
          });
        }
        logger.error('Failed to create case in transaction', { error });
        throw Errors.INTERNAL_ERROR('案件創建失敗，請稍後再試');
      });

      return { case: case_, sessionId: sessionIdToUse, sessionExpiresAt: session.expires_at };
    }, LOCK_TTL.CASE_CREATE);
  }

  /**
   * 創建案件（完整模式）
   */
  async createCase(userId: string, data: CreateCaseDto) {
    return lockService.withLock(`case:create:${data.pairing_id}`, async () => {
      return this._createCaseInner(userId, data);
    }, LOCK_TTL.CASE_CREATE);
  }

  private async _createCaseInner(userId: string, data: CreateCaseDto) {
    const pairing = await prisma.pairing.findUnique({
      where: { id: data.pairing_id },
      include: {
        user1: true,
        user2: true,
      },
    });

    if (!pairing) {
      throw Errors.NOT_FOUND('配對不存在');
    }

    if (pairing.status !== PAIRING_STATUS.ACTIVE) {
      throw Errors.VALIDATION_ERROR('配對關係未激活');
    }

    if (pairing.user1_id !== userId && pairing.user2_id !== userId) {
      throw Errors.FORBIDDEN('無權限訪問此配對');
    }

    const actor = pairing.user1_id === userId ? pairing.user1 : pairing.user2;
    const counterparty = pairing.user1_id === userId ? pairing.user2 : pairing.user1;
    const formalCasePolicy = getFormalCaseCreatePolicy({
      actorAge: actor?.age ?? null,
      counterpartyAge: counterparty?.age ?? null,
      safetyAssertionInput: data,
    });
    if (!formalCasePolicy.canCreateCase) {
      if (formalCasePolicy.rejectionCode === 'FORBIDDEN') {
        throw Errors.FORBIDDEN(formalCasePolicy.rejectionMessage ?? '目前不可建立正式案件');
      }
      throw Errors.VALIDATION_ERROR(
        formalCasePolicy.rejectionMessage ?? '案件安全聲明未通過',
        { reasons: formalCasePolicy.reasons }
      );
    }
    const safetyDescription = formalCasePolicy.metadata
      ? JSON.stringify({ safety_assertion: formalCasePolicy.metadata })
      : null;

    const plaintiffStatement = ValidationUtils.validateStatement(
      data.plaintiff_statement,
      '原告陳述',
      30
    );

    const caseMode = data.mode || CASE_MODE.REMOTE;
    const hasDefendantStatement = data.defendant_statement && data.defendant_statement.trim().length > 0;

    if (caseMode === CASE_MODE.COLLABORATIVE && !hasDefendantStatement) {
      throw Errors.VALIDATION_ERROR('協作模式需同時提供雙方陳述');
    }

    let caseType: string;
    try {
      caseType = await aiService.detectCaseType(
        data.plaintiff_statement,
        data.defendant_statement || ''
      );
    } catch (error) {
      logger.error('Failed to detect case type', { error });
      caseType = '其他衝突';
    }

    const title = data.title && data.title.trim() ? data.title.trim() : this.generateTitle(data.plaintiff_statement);

    const plaintiffId = pairing.user1_id === userId ? pairing.user1_id : pairing.user2_id;
    const defendantId = pairing.user1_id === userId ? pairing.user2_id : pairing.user1_id;

    const isReadyForSubmission = caseMode === CASE_MODE.COLLABORATIVE || hasDefendantStatement;
    const defendantStatementValidated = hasDefendantStatement
      ? ValidationUtils.validateStatement(data.defendant_statement!, '被告陳述', 30)
      : null;

    const case_ = await prisma.$transaction(async (tx) => {
      const newCase = await tx.case.create({
        data: {
          pairing_id: data.pairing_id,
          title,
          type: caseType,
          sub_type: data.sub_type || null,
          plaintiff_id: plaintiffId,
          defendant_id: defendantId,
          plaintiff_statement: plaintiffStatement,
          defendant_statement: defendantStatementValidated,
          status: isReadyForSubmission ? CASE_STATUS.SUBMITTED : CASE_STATUS.DRAFT,
          mode: caseMode,
          submitted_at: isReadyForSubmission ? new Date() : null,
        },
      });

      if (data.evidence_urls && data.evidence_urls.length > 0) {
        await tx.evidence.createMany({
          data: data.evidence_urls.map((url: string) => ({
            case_id: newCase.id,
            file_url: url,
            file_type: FILE_TYPE.IMAGE,
            file_size: 0,
            user_id: plaintiffId,
            ...(safetyDescription ? { description: safetyDescription } : {}),
          })),
        });
      }

      return newCase;
    });

    return case_;
  }

  /**
   * 獲取案件列表（完整模式）
   */
  async getCaseList(
    userId: string,
    params: {
      status?: string;
      type?: string;
      page?: number;
      page_size?: number;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      search?: string;
    } = {}
  ) {
    const ALLOWED_SORT_FIELDS = ['created_at', 'updated_at', 'submitted_at', 'title', 'status'];
    const {
      status,
      type,
      page: rawPage = 1,
      page_size: rawPageSize = PAGINATION.CASE_LIST_DEFAULT_PAGE_SIZE,
      sort_by: rawSortBy = 'created_at',
      sort_order: rawSortOrder = 'desc',
      search,
    } = params;
    const page = Math.max(1, Math.floor(Number(rawPage)) || 1);
    const page_size = Math.min(PAGINATION.CASE_LIST_MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(rawPageSize)) || PAGINATION.CASE_LIST_DEFAULT_PAGE_SIZE));
    const sort_by = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'created_at';
    const sort_order = rawSortOrder === 'asc' ? 'asc' : 'desc';

    const andConditions: Prisma.CaseWhereInput[] = [
      { OR: [{ plaintiff_id: userId }, { defendant_id: userId }] },
    ];

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { plaintiff_statement: { contains: search, mode: 'insensitive' } },
          { defendant_statement: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.CaseWhereInput = {
      AND: andConditions,
      mode: { in: [CASE_MODE.REMOTE, CASE_MODE.COLLABORATIVE] },
      ...(status && status !== 'all' ? { status: status as Prisma.CaseWhereInput['status'] } : {}),
      ...(type && type !== 'all' ? { type: type as Prisma.CaseWhereInput['type'] } : {}),
    };

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          judgment: {
            select: {
              id: true,
              summary: true,
              plaintiff_ratio: true,
              defendant_ratio: true,
            },
          },
          chat_to_case_links: {
            select: { id: true },
            take: 1,
          },
        },
        orderBy: {
          [sort_by]: sort_order,
        },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      prisma.case.count({ where }),
    ]);

    const normalized = cases.map((c) => ({
      ...c,
      judgment: normalizeJudgment(c.judgment),
      product_flow: getCaseProductFlow(c),
    }));

    return {
      cases: normalized,
      pagination: {
        page,
        page_size,
        total,
        total_pages: Math.ceil(total / page_size),
      },
    };
  }

  /**
   * 提交案件（將狀態從draft改為submitted）
   */
  async submitCase(caseId: string, userId: string) {
    return lockService.withLock(`case:submit:${caseId}`, async () => {
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    // 驗證用戶權限
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限提交此案件');
    }

    // 驗證案件狀態
    if (case_.status !== CASE_STATUS.DRAFT) {
      throw Errors.CASE_NOT_EDITABLE('案件狀態不允許提交');
    }

    if (
      (case_.mode === CASE_MODE.REMOTE || case_.mode === CASE_MODE.COLLABORATIVE) &&
      (!case_.defendant_statement || !case_.defendant_statement.trim())
    ) {
      throw Errors.VALIDATION_ERROR('遠程/協作模式需等待被告陳述後才能提交');
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: CASE_STATUS.SUBMITTED,
        submitted_at: new Date(),
      },
    });

    return updatedCase;
    }, LOCK_TTL.CASE_SUBMIT);
  }

  /**
   * 更新案件（僅draft狀態可更新）
   * 遠程模式：被告加入陳述後自動提交
   */
  async updateCase(caseId: string, userId: string, data: Partial<CreateCaseDto>) {
    return lockService.withLock(`case:update:${caseId}`, async () => {
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限更新此案件');
    }

    if (case_.status !== CASE_STATUS.DRAFT) {
      throw Errors.CASE_NOT_EDITABLE('案件狀態不允許更新');
    }

    const updateData: Prisma.CaseUpdateInput = {};
    const isPlaintiff = case_.plaintiff_id === userId;
    const isDefendant = case_.defendant_id === userId;

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.plaintiff_statement !== undefined) {
      if (!isPlaintiff) {
        throw Errors.FORBIDDEN('只有原告可以修改原告陳述');
      }
      updateData.plaintiff_statement = ValidationUtils.validateStatement(
        data.plaintiff_statement,
        '原告陳述',
        30
      );
      const caseType = await aiService.detectCaseType(
        data.plaintiff_statement,
        case_.defendant_statement || ''
      );
      updateData.type = caseType;
    }

    if (data.defendant_statement !== undefined) {
      if (!isDefendant) {
        throw Errors.FORBIDDEN('只有被告可以修改被告陳述');
      }
      updateData.defendant_statement = data.defendant_statement
        ? ValidationUtils.validateStatement(data.defendant_statement, '被告陳述', 30)
        : null;
      const caseType = await aiService.detectCaseType(
        case_.plaintiff_statement,
        data.defendant_statement || ''
      );
      updateData.type = caseType;
    }

    const isDefendantResponding =
      case_.mode === CASE_MODE.REMOTE &&
      case_.defendant_id === userId &&
      !case_.defendant_statement &&
      updateData.defendant_statement;

    if (isDefendantResponding) {
      updateData.status = CASE_STATUS.SUBMITTED;
      updateData.submitted_at = new Date();
    }

    updateData.updated_at = new Date();

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
    });

    return updatedCase;
    }, LOCK_TTL.CASE_UPDATE);
  }

  /**
   * 獲取案件詳情（優化查詢，避免N+1問題）
   */
  async getCaseById(caseId: string, userId?: string, sessionId?: string) {
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        evidences: {
          orderBy: { created_at: 'desc' },
        },
        judgment: {
          include: {
            reconciliation_plans: {
              orderBy: { created_at: 'desc' },
            },
          },
        },
        pairing: {
          include: {
            user1: {
              select: {
                id: true,
                nickname: true,
                avatar_url: true,
              },
            },
            user2: {
              select: {
                id: true,
                nickname: true,
                avatar_url: true,
              },
            },
          },
        },
        chat_to_case_links: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    // session-bound 模式（quick / collaborative with session_id）：驗證 Session ID
    if (isSessionBoundCase(case_)) {
      if (!sessionId || case_.session_id !== sessionId) {
        throw Errors.FORBIDDEN('無權限訪問此案件');
      }
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw Errors.SESSION_EXPIRED();
      }
    } else {
      // 完整模式：驗證用戶權限
      if (!userId) {
        throw Errors.UNAUTHORIZED('需要認證');
      }

      if (!isCaseParticipant(case_, userId)) {
        throw Errors.FORBIDDEN('無權限訪問此案件');
      }
    }

    // 權限校驗通過後再簽名媒體URL，避免未授權請求消耗簽名/I/O成本
    case_.evidences = case_.evidences.map((e) => ({
      ...e,
      file_url: fileService.signUrl(e.file_url),
    }));
    if (case_.pairing) {
      const pairing = case_.pairing as typeof case_.pairing & {
        user1?: { avatar_url?: string | null } | null;
        user2?: { avatar_url?: string | null } | null;
      };
      case_.pairing = {
        ...case_.pairing,
        user1: signAvatar(pairing.user1) ?? null,
        user2: signAvatar(pairing.user2) ?? null,
      };
    }
    (case_ as { judgment: unknown }).judgment = normalizeJudgment(case_.judgment);

    return {
      ...case_,
      product_flow: getCaseProductFlow(case_),
    };
  }

  /**
   * 通過Session ID獲取案件（快速體驗模式，優化查詢）
   */
  async getCaseBySessionId(sessionId: string) {
    const case_ = await prisma.case.findFirst({
      where: {
        session_id: sessionId,
        mode: CASE_MODE.QUICK,
      },
      include: {
        evidences: {
          orderBy: { created_at: 'desc' },
        },
        judgment: {
          include: {
            reconciliation_plans: {
              orderBy: { created_at: 'desc' },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (case_) {
      case_.evidences = case_.evidences.map((e) => ({
        ...e,
        file_url: fileService.signUrl(e.file_url),
      }));
      (case_ as { judgment: unknown }).judgment = normalizeJudgment(case_.judgment);
    }

    return case_;
  }

  /**
   * 生成案件標題
   */
  private generateTitle(statement: string): string {
    const title = statement.substring(0, 30).trim();
    return title.length < 5 ? '案件-' + new Date().toLocaleDateString() : title;
  }

  /**
   * 創建協作聽證案件（同設備雙人模式）
   * 第一次呼叫：創建案件並寫入角色A陳述
   * 第二次呼叫（帶 case_id）：寫入角色B陳述並提交
   */
  async createOrUpdateCollaborativeCase(
    data: {
      case_id?: string;
      plaintiff_statement?: string;
      defendant_statement?: string;
      evidence_urls?: string[];
    },
    sessionId: string | null
  ) {
    if (data.case_id && data.defendant_statement) {
      // Phase 2: 角色 B 提交陳述（帶鎖防止併發提交）
      return lockService.withLock(`case:collaborative:submit:${data.case_id}`, async () => {
        const case_ = await prisma.case.findUnique({ where: { id: data.case_id } });
        if (!case_ || case_.mode !== CASE_MODE.COLLABORATIVE) {
          throw Errors.NOT_FOUND('協作案件不存在');
        }
        if (!sessionId || case_.session_id !== sessionId) {
          throw Errors.FORBIDDEN('Session 不匹配');
        }
        const activeSession = await sessionService.getSession(sessionId);
        if (!activeSession) {
          throw Errors.SESSION_EXPIRED();
        }
        if (case_.status !== CASE_STATUS.DRAFT) {
          throw Errors.CASE_NOT_EDITABLE('案件已提交');
        }

        const defendantStatement = ValidationUtils.validateStatement(data.defendant_statement!, '角色B陳述', 10);

        const updated = await prisma.case.update({
          where: { id: data.case_id },
          data: {
            defendant_statement: defendantStatement,
            status: CASE_STATUS.SUBMITTED,
            submitted_at: new Date(),
          },
        });

        const session = await sessionService.getSession(case_.session_id!);

        return {
          case: updated,
          sessionId: case_.session_id!,
          sessionExpiresAt: session?.expires_at || new Date(Date.now() + SESSION_EXPIRY.DEFAULT_MS),
          phase: 'submitted' as const,
        };
      }, LOCK_TTL.CASE_UPDATE);
    }

    // Phase 1: 角色 A 創建案件
    if (!data.plaintiff_statement) {
      throw Errors.VALIDATION_ERROR('角色A陳述不能為空');
    }

    let finalSessionId: string;
    if (!sessionId || !validateSessionId(sessionId)) {
      const newSession = await sessionService.createSession();
      finalSessionId = newSession.session_id;
    } else {
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        const newSession = await sessionService.createSession();
        finalSessionId = newSession.session_id;
      } else {
        finalSessionId = sessionId;
      }
    }

    const plaintiffStatement = ValidationUtils.validateStatement(data.plaintiff_statement, '角色A陳述', 30);

    let caseType: string;
    try {
      caseType = await aiService.detectCaseType(data.plaintiff_statement, '');
    } catch {
      caseType = '其他衝突';
    }

    const title = this.generateTitle(data.plaintiff_statement);
    const existingTempPairing = await pairingService.getPairingBySessionId(finalSessionId);
    const tempPairing = existingTempPairing || await pairingService.createTempPairing(finalSessionId);

    const case_ = await prisma.case.create({
      data: {
        pairing_id: tempPairing.id,
        title,
        type: caseType,
        plaintiff_statement: plaintiffStatement,
        status: CASE_STATUS.DRAFT,
        mode: CASE_MODE.COLLABORATIVE,
        session_id: finalSessionId,
      },
    });

    await sessionService.addCaseToSession(finalSessionId, case_.id);

    const session = await sessionService.getSession(finalSessionId);

    return {
      case: case_,
      sessionId: finalSessionId,
      sessionExpiresAt: session?.expires_at || new Date(Date.now() + SESSION_EXPIRY.DEFAULT_MS),
      phase: 'a_done',
    };
  }
}

export const caseService = new CaseService();

// 注意：為了避免循環依賴，判決生成在caseService外部觸發
// 在controller層處理判決生成的異步調用
