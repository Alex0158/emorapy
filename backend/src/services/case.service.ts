import prisma from '../config/database';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { aiService } from './ai.service';
import { sessionService } from './session.service';
import { pairingService } from './pairing.service';
import { ValidationUtils } from '../utils/validation';
import { validateSessionId } from '../utils/session';
import { fileService } from './file.service';
import { normalizeJudgment } from '../utils/judgment';
import { lockService } from '../utils/lock';

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
}

export class CaseService {
  /**
   * 創建快速體驗案件
   */
  async createQuickCase(
    data: QuickCaseDto, 
    sessionId: string | null  // 允許為null，由服務層統一處理
  ): Promise<{ case: any; sessionId: string; sessionExpiresAt: Date }> {
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
      const case_ = await prisma.$transaction(async (tx: any) => {
        const newCase = await tx.case.create({
          data: {
            pairing_id: tempPairing.id,
            title,
            type: caseType,
            plaintiff_id: null,
            defendant_id: null,
            plaintiff_statement: plaintiffStatement,
            defendant_statement: defendantStatement,
            status: 'submitted',
            mode: 'quick',
            session_id: sessionIdToUse,
            submitted_at: new Date(),
          },
        });

        if (data.evidence_urls && data.evidence_urls.length > 0) {
          await tx.evidence.createMany({
            data: data.evidence_urls.map(url => ({
              case_id: newCase.id,
              file_url: url,
              file_type: 'image',
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
      }).catch(async (error: any) => {
        if (pairingCreatedNow) {
          await prisma.pairing.delete({ where: { id: tempPairing.id } }).catch(() => {});
        }
        logger.error('Failed to create case in transaction', { error });
        throw Errors.INTERNAL_ERROR('案件創建失敗，請稍後再試');
      });

      return { case: case_, sessionId: sessionIdToUse, sessionExpiresAt: session.expires_at };
    }, 30);
  }

  /**
   * 創建案件（完整模式）
   */
  async createCase(userId: string, data: CreateCaseDto) {
    return lockService.withLock(`case:create:${data.pairing_id}`, async () => {
      return this._createCaseInner(userId, data);
    });
  }

  private async _createCaseInner(userId: string, data: CreateCaseDto) {
    // 1. 驗證配對關係
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

    if (pairing.status !== 'active') {
      throw Errors.VALIDATION_ERROR('配對關係未激活');
    }

    // 2. 驗證用戶是否屬於此配對
    if (pairing.user1_id !== userId && pairing.user2_id !== userId) {
      throw Errors.FORBIDDEN('無權限訪問此配對');
    }

    // 3. 驗證陳述長度（使用統一驗證工具）
    const plaintiffStatement = ValidationUtils.validateStatement(
      data.plaintiff_statement,
      '原告陳述'
    );

    // 4. 案件類型：優先使用用戶選擇，其次 AI 判斷
    let caseType: string = data.type || '其他衝突';
    if (!data.type) {
      try {
        caseType = await aiService.detectCaseType(
          data.plaintiff_statement,
          data.defendant_statement || ''
        );
      } catch (error) {
        logger.error('Failed to detect case type', { error });
        caseType = '其他衝突';
      }
    }

    // 5. 生成標題
    const title = data.title || this.generateTitle(data.plaintiff_statement);

    // 6. 確定原告和被告
    const plaintiffId = pairing.user1_id === userId ? pairing.user1_id : pairing.user2_id;
    const defendantId = pairing.user1_id === userId ? pairing.user2_id : pairing.user1_id;

    // 7. 創建案件
    const case_ = await prisma.case.create({
      data: {
        pairing_id: data.pairing_id,
        title,
        type: caseType,
        sub_type: data.sub_type || null,
        plaintiff_id: plaintiffId,
        defendant_id: defendantId,
        plaintiff_statement: plaintiffStatement,
        defendant_statement: data.defendant_statement
          ? ValidationUtils.validateStatement(data.defendant_statement, '被告陳述')
          : null,
        status: 'submitted',
        mode: 'remote',
        submitted_at: new Date(),
      },
    });

    // 8. 保存證據
    if (data.evidence_urls && data.evidence_urls.length > 0) {
      for (const url of data.evidence_urls) {
        await prisma.evidence.create({
          data: {
            case_id: case_.id,
            file_url: url,
            file_type: 'image',
            file_size: 0,
            user_id: plaintiffId,
          },
        });
      }
    }

    // 9. 異步觸發AI判決生成（在controller層處理）

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
      page = 1,
      page_size = 10,
      sort_by: rawSortBy = 'created_at',
      sort_order: rawSortOrder = 'desc',
      search,
    } = params;
    const sort_by = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'created_at';
    const sort_order = rawSortOrder === 'asc' ? 'asc' : 'desc';

    const where: any = {
      OR: [
        { plaintiff_id: userId },
        { defendant_id: userId },
      ],
      mode: 'remote', // 只返回完整模式的案件
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (type && type !== 'all') {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { plaintiff_statement: { contains: search, mode: 'insensitive' } },
        { defendant_statement: { contains: search, mode: 'insensitive' } },
      ];
    }

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
        },
        orderBy: {
          [sort_by]: sort_order,
        },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      prisma.case.count({ where }),
    ]);

    const normalized = cases.map((c: any) => ({
      ...c,
      judgment: normalizeJudgment((c as any).judgment),
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
    if (case_.status !== 'draft') {
      throw Errors.CASE_NOT_EDITABLE('案件狀態不允許提交');
    }

    // 更新狀態
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'submitted',
        submitted_at: new Date(),
      },
    });

    // 異步觸發AI判決生成
    const { judgmentService } = await import('./judgment.service');
    judgmentService.generateJudgment(caseId).catch(err => {
      logger.error('Failed to generate judgment after submission', { caseId, error: err });
    });

    return updatedCase;
  }

  /**
   * 更新案件（僅draft狀態可更新）
   */
  async updateCase(caseId: string, userId: string, data: Partial<CreateCaseDto>) {
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    // 驗證用戶權限
    if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限更新此案件');
    }

    // 驗證案件狀態（僅draft狀態可更新）
    if (case_.status !== 'draft') {
      throw Errors.CASE_NOT_EDITABLE('案件狀態不允許更新');
    }

    // 驗證更新數據
    const updateData: any = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.plaintiff_statement !== undefined) {
      updateData.plaintiff_statement = ValidationUtils.validateStatement(
        data.plaintiff_statement,
        '原告陳述'
      );
      // 更新案件類型（如果陳述改變）
      const caseType = await aiService.detectCaseType(
        data.plaintiff_statement,
        data.defendant_statement || case_.defendant_statement || ''
      );
      updateData.type = caseType;
    }

    if (data.defendant_statement !== undefined) {
      // 驗證被告陳述（包括長度驗證）
      updateData.defendant_statement = data.defendant_statement
        ? ValidationUtils.validateStatement(data.defendant_statement, '被告陳述')
        : null;
      // 更新案件類型（如果陳述改變）
      if (data.plaintiff_statement === undefined) {
        const caseType = await aiService.detectCaseType(
          case_.plaintiff_statement,
          data.defendant_statement || ''
        );
        updateData.type = caseType;
      }
    }

    // 驗證evidence_urls（如果提供）
    if (data.evidence_urls !== undefined) {
      ValidationUtils.validateEvidenceUrls(data.evidence_urls);
      // 注意：這裡只驗證URL格式，實際文件上傳需要通過專門的證據上傳接口
    }

    updateData.updated_at = new Date();

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
    });

    return updatedCase;
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
      },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    // 快速體驗模式：驗證Session ID
    if (case_.mode === 'quick') {
      if (!sessionId || case_.session_id !== sessionId) {
        throw Errors.FORBIDDEN('無權限訪問此案件');
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
        throw Errors.FORBIDDEN('無權限訪問此案件');
      }
    }

    // 權限校驗通過後再簽名媒體URL，避免未授權請求消耗簽名/I/O成本
    case_.evidences = case_.evidences.map((e: any) => ({
      ...e,
      file_url: fileService.signUrl(e.file_url),
    }));
    if (case_.pairing) {
      const signAvatar = (user: any) =>
        user?.avatar_url ? { ...user, avatar_url: fileService.signUrl(user.avatar_url) } : user;
      case_.pairing = {
        ...case_.pairing,
        user1: signAvatar((case_ as any).pairing.user1),
        user2: signAvatar((case_ as any).pairing.user2),
      };
    }
    case_.judgment = normalizeJudgment((case_ as any).judgment);

    return case_;
  }

  /**
   * 通過Session ID獲取案件（快速體驗模式，優化查詢）
   */
  async getCaseBySessionId(sessionId: string) {
    const case_ = await prisma.case.findFirst({
      where: {
        session_id: sessionId,
        mode: 'quick',
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
      case_.evidences = case_.evidences.map((e: any) => ({
        ...e,
        file_url: fileService.signUrl(e.file_url),
      }));
      case_.judgment = normalizeJudgment((case_ as any).judgment);
    }

    return case_;
  }

  /**
   * 生成案件標題
   */
  private generateTitle(statement: string): string {
    // 簡單標題生成：取前30個字符
    const title = statement.substring(0, 30).trim();
    return title.length < 5 ? '案件-' + new Date().toLocaleDateString() : title;
  }
}

export const caseService = new CaseService();

// 注意：為了避免循環依賴，判決生成在caseService外部觸發
// 在controller層處理判決生成的異步調用
