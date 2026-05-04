/**
 * CaseService 單元測試（mock Prisma、sessionService、pairingService、aiService、fileService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateSession: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAddCaseToSession: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateTempPairing: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetPairingBySessionId: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDetectCaseType: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSignUrl: any = jest.fn();
const mockValidateSessionId = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRecordAssessment: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetActiveRiskState: any = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  pairing: { findUnique: jest.fn(), delete: jest.fn() },
  case: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  evidence: { create: jest.fn(), createMany: jest.fn() },
  quickSession: { update: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../src/utils/lock', () => ({
  lockService: {
    withLock: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  },
}));
jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/services/session.service', () => ({
  sessionService: {
    createSession: () => mockCreateSession(),
    getSession: (id: string) => mockGetSession(id),
    addCaseToSession: (sessionId: string, caseId: string) => mockAddCaseToSession(sessionId, caseId),
  },
}));
jest.mock('../../../src/services/pairing.service', () => ({
  pairingService: {
    createTempPairing: (sessionId: string) => mockCreateTempPairing(sessionId),
    getPairingBySessionId: (sessionId: string) => mockGetPairingBySessionId(sessionId),
  },
}));
jest.mock('../../../src/services/ai.service', () => ({
  aiService: {
    detectCaseType: (a: string, b: string) => mockDetectCaseType(a, b),
  },
}));
jest.mock('../../../src/services/safety-assessment.service', () => ({
  safetyAssessmentService: {
    recordAssessment: (...args: unknown[]) => mockRecordAssessment(...args),
    getActiveRiskState: (...args: unknown[]) => mockGetActiveRiskState(...args),
  },
}));
const mockSignAvatar = jest.fn((user: unknown) => user);
jest.mock('../../../src/services/file.service', () => ({
  fileService: {
    signUrl: (url: string) => mockSignUrl(url),
  },
  signAvatar: (user: unknown) => mockSignAvatar(user),
}));
jest.mock('../../../src/utils/session', () => ({
  validateSessionId: (id: string) => mockValidateSessionId(id),
}));
jest.mock('../../../src/utils/helpers', () => {
  const actual = jest.requireActual<typeof import('../../../src/utils/helpers')>('../../../src/utils/helpers');
  return { ...actual, generateCaseTitle: jest.fn((s: string) => actual.generateCaseTitle(s)) };
});
import { CaseService } from '../../../src/services/case.service';

// 驗證規則：createCase 原告陳述至少 50 字，createQuickCase 至少 30 字
const LONG_STATEMENT_50 =
  '原告陳述內容需要至少五十個字才能通過驗證所以這裡寫足夠長度再加一些字數湊滿五十字即可達到驗證標準長度';
const LONG_STATEMENT_30 =
  '原告陳述至少三十個字以上才能通過驗證所以這裡寫足夠長度了完畢';

describe('CaseService', () => {
  let service: CaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaseService();
    mockSignUrl.mockImplementation((url: unknown) => String(url ?? '') + ':signed');
    mockSignAvatar.mockImplementation((user: unknown) => user);
    mockValidateSessionId.mockReturnValue(true);
    mockGetPairingBySessionId.mockResolvedValue(null);
    mockAddCaseToSession.mockResolvedValue(undefined);
    mockRecordAssessment.mockResolvedValue({ id: 'assessment-1' });
    mockGetActiveRiskState.mockResolvedValue(null);
    prismaMock.pairing.delete.mockResolvedValue({} as never);
    // createCase/updateCase use prisma.$transaction with tx; ensure callback runs with tx that delegates to same mocks
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        case: prismaMock.case,
        evidence: { createMany: prismaMock.evidence.createMany },
      };
      return fn(tx);
    });
  });

  describe('generateTitle (private)', () => {
    it('標題長度少於 5 時應回退默認案件標題', () => {
      const title = (service as any).generateTitle('  短  ');
      expect(title).toMatch(/^案件-/);
    });
  });

  describe('createCase', () => {
    it('配對不存在應拋出 NOT_FOUND', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue(null);

      await expect(
        service.createCase('u1', {
          pairing_id: 'pair-1',
          plaintiff_statement: LONG_STATEMENT_50,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: expect.stringContaining('配對') });
      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('配對未激活應拋出 VALIDATION_ERROR', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'pending',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });

      await expect(
        service.createCase('u1', {
          pairing_id: 'pair-1',
          plaintiff_statement: LONG_STATEMENT_50,
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('用戶不屬於配對應拋出 FORBIDDEN', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });

      await expect(
        service.createCase('u3', {
          pairing_id: 'pair-1',
          plaintiff_statement: LONG_STATEMENT_50,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('任一正式案件參與者已知未成年時應拒絕建立案件', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: { age: 17 },
        user2: { age: 30 },
      });

      await expect(
        service.createCase('u1', {
          pairing_id: 'pair-1',
          plaintiff_statement: LONG_STATEMENT_50,
        })
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('未成年人'),
      });
      expect(mockDetectCaseType).not.toHaveBeenCalled();
      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('正式案件聲明非同意內容時應拒絕建立案件', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: { age: 30 },
        user2: { age: 31 },
      });

      await expect(
        service.createCase('u1', {
          pairing_id: 'pair-1',
          plaintiff_statement: LONG_STATEMENT_50,
          contains_nonconsensual_content: true,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('非同意'),
      });
      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('成功應創建案件並返回', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      const created = {
        id: 'case-1',
        pairing_id: 'pair-1',
        title: '標題',
        type: '其他衝突',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'submitted',
        mode: 'remote',
      };
      prismaMock.case.create.mockResolvedValue(created);

      const result = await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
      });

      expect(result).toEqual(created);
      expect(mockDetectCaseType).toHaveBeenCalledWith(
        LONG_STATEMENT_50,
        ''
      );
      expect(prismaMock.case.create).toHaveBeenCalled();
    });

    it('有 type 時來源仍調用 detectCaseType 且 create 使用其回傳值', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('感情糾紛');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        type: '感情糾紛',
      });

      expect(mockDetectCaseType).toHaveBeenCalled();
      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: '感情糾紛' }),
        })
      );
    });

    it('未傳 type 且 detectCaseType 拋錯時應使用 其他衝突', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockRejectedValue(new Error('AI error'));
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to detect case type', expect.objectContaining({ error: expect.any(Error) }));
      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: '其他衝突' }),
        })
      );
    });

    it('傳入 data.title 時應直接使用不調用 generateTitle', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        title: '自訂標題',
      });

      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: '自訂標題' }),
        })
      );
    });

    it('傳入 data.defendant_statement 時應驗證並寫入', async () => {
      const defendantStmt = LONG_STATEMENT_50;
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        defendant_statement: defendantStmt,
      });

      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            defendant_statement: LONG_STATEMENT_50.trim(),
          }),
        })
      );
    });

    it('collaborative 模式缺少 defendant_statement 時應拋出 VALIDATION_ERROR', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });

      await expect(service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        mode: 'collaborative',
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('雙方陳述'),
      });

      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('正式建案不應接受 quick mode（service 邊界硬化）', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });

      await expect(service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        mode: 'quick',
      } as any)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('mode'),
      });

      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('傳入 data.evidence_urls 時應 createMany evidence', async () => {
      const evidenceUrls = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1', plaintiff_id: 'u1' });
      prismaMock.evidence.createMany.mockResolvedValue({} as never);

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        evidence_urls: evidenceUrls,
      });

      expect(prismaMock.evidence.createMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.evidence.createMany).toHaveBeenCalledWith({
        data: [
          { case_id: 'case-1', file_url: evidenceUrls[0], file_type: 'image', file_size: 0, user_id: 'u1' },
          { case_id: 'case-1', file_url: evidenceUrls[1], file_type: 'image', file_size: 0, user_id: 'u1' },
        ],
      });
    });

    it('正式案件安全聲明通過時應把 metadata 寫入 case 與 evidence safety_metadata', async () => {
      const evidenceUrls = ['https://example.com/sensitive.jpg'];
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: { age: 30 },
        user2: { age: 31 },
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1', plaintiff_id: 'u1' });
      prismaMock.evidence.createMany.mockResolvedValue({} as never);

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        evidence_urls: evidenceUrls,
        safety_assertion: JSON.stringify({
          contains_sensitive_content: true,
          sensitive_content_handling_ack: true,
        }),
      });

      expect(prismaMock.evidence.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            case_id: 'case-1',
            file_url: evidenceUrls[0],
            safety_metadata: expect.objectContaining({
              kind: 'formal_case_safety_assertion',
            }),
          }),
        ],
      });
      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            safety_metadata: expect.objectContaining({
              kind: 'formal_case_safety_assertion',
            }),
          }),
        })
      );
      expect(mockRecordAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: 'case',
          subjectId: 'case-1',
          source: 'formal_case_assertion',
          assessedByUserId: 'u1',
          updateActiveRiskState: true,
          snapshot: expect.objectContaining({
            risk_level: 'sensitive',
            judgment_route: 'standard',
            metadata: expect.objectContaining({
              kind: 'evidence_safety_assertion_snapshot',
              case_id: 'case-1',
              pairing_id: 'pair-1',
            }),
          }),
        })
      );
    });

    it('傳入 data.sub_type 時應寫入 sub_type', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        sub_type: '金錢糾紛',
      });

      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sub_type: '金錢糾紛' }),
        })
      );
    });

    it('userId 為 user2 時 plaintiffId/defendantId 應對調', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u2', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
      });

      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plaintiff_id: 'u2',
            defendant_id: 'u1',
          }),
        })
      );
    });
  });

  describe('getCaseList', () => {
    it('無案件時應返回 cases 空陣列與 pagination total 0（F03 邊界）', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      const result = await service.getCaseList('u1', { page: 1, page_size: 10 });

      expect(result.cases).toEqual([]);
      expect(result.pagination).toMatchObject({
        page: 1,
        page_size: 10,
        total: 0,
        total_pages: 0,
      });
    });

    it('不傳 params 時應使用預設分頁與排序', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      await service.getCaseList('u1');

      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: { created_at: 'desc' },
          include: expect.objectContaining({
            chat_to_case_links: { select: { id: true }, take: 1 },
          }),
        })
      );
    });

    it('應按 userId 與 user-bound product case 查詢並分頁', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      const result = await service.getCaseList('u1', { page: 1, page_size: 10 });

      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ OR: [{ plaintiff_id: 'u1' }, { defendant_id: 'u1' }] }),
              {
                OR: [
                  { chat_to_case_links: { some: {} } },
                  { chat_to_case_links: { none: {} }, mode: 'remote' },
                  { chat_to_case_links: { none: {} }, mode: 'collaborative', session_id: null },
                ],
              },
            ]),
          }),
          skip: 0,
          take: 10,
        })
      );
      expect(result).toMatchObject({
        cases: [],
        pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
      });
    });

    it('列表查詢不應用 mode-only 漏掉 quick 底層的 chat-to-case', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      await service.getCaseList('u1', { page: 1, page_size: 10 });

      const call = prismaMock.case.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('mode');
      expect(call.where.AND).toEqual(expect.arrayContaining([
        {
          OR: [
            { chat_to_case_links: { some: {} } },
            { chat_to_case_links: { none: {} }, mode: 'remote' },
            { chat_to_case_links: { none: {} }, mode: 'collaborative', session_id: null },
          ],
        },
      ]));
    });

    it('有 status、type、search 時應傳入 where', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      await service.getCaseList('u1', {
        status: 'submitted',
        type: '感情糾紛',
        search: '關鍵字',
      });

      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'submitted',
            type: '感情糾紛',
          }),
        })
      );
    });

    it('status 為 all 時 where 不應帶 status', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      await service.getCaseList('u1', { status: 'all', type: 'all' });

      const call = prismaMock.case.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('status');
      expect(call.where).not.toHaveProperty('type');
    });

    it('自訂 sort_by、sort_order 與分頁應正確傳入', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      await service.getCaseList('u1', {
        page: 2,
        page_size: 20,
        sort_by: 'submitted_at',
        sort_order: 'asc',
      });

      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submitted_at: 'asc' },
          skip: 20,
          take: 20,
        })
      );
      expect(prismaMock.case.count).toHaveBeenCalled();
    });

    it('回傳 cases 含 judgment 時應 normalizeJudgment 補 responsibility_ratio', async () => {
      const casesWithJudgment = [
        {
          id: 'case-1',
          plaintiff_id: 'u1',
          defendant_id: 'u2',
          judgment: {
            id: 'j1',
            summary: '摘要',
            plaintiff_ratio: 60,
            defendant_ratio: 40,
          },
        },
      ];
      prismaMock.case.findMany.mockResolvedValue(casesWithJudgment);
      prismaMock.case.count.mockResolvedValue(1);

      const result = await service.getCaseList('u1', { page: 1, page_size: 10 });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].judgment).toMatchObject({
        plaintiff_ratio: 60,
        defendant_ratio: 40,
        responsibility_ratio: { plaintiff: 60, defendant: 40 },
      });
      expect(mockGetActiveRiskState).toHaveBeenCalledWith({
        subjectType: 'case',
        subjectId: 'case-1',
      });
    });

    it('回傳 cases 含 judgment 時應套用 active safety state 隱藏責任比例', async () => {
      mockGetActiveRiskState.mockResolvedValueOnce({
        id: 'state-1',
        judgment_route: 'safety_support',
        can_show_responsibility_ratio: false,
        reasons: ['active case risk'],
      });
      prismaMock.case.findMany.mockResolvedValue([
        {
          id: 'case-1',
          plaintiff_id: 'u1',
          defendant_id: 'u2',
          judgment: {
            id: 'j1',
            summary: '摘要',
            plaintiff_ratio: 60,
            defendant_ratio: 40,
          },
        },
      ]);
      prismaMock.case.count.mockResolvedValue(1);

      const result = await service.getCaseList('u1', { page: 1, page_size: 10 });

      expect(result.cases[0].judgment).toMatchObject({
        judgment_route: 'safety_support',
        responsibility_ratio_visibility: {
          can_show: false,
          reason: '安全支持路由不得展示責任比例，避免把安全風險對稱化',
        },
      });
    });

    it('回傳 cases 應帶 product_flow，且 chat_to_case 優先於 mode', async () => {
      prismaMock.case.findMany.mockResolvedValue([
        {
          id: 'case-chat',
          mode: 'collaborative',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
          judgment: null,
          chat_to_case_links: [{ id: 'link-1' }],
        },
        {
          id: 'case-formal',
          mode: 'remote',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
          judgment: null,
          chat_to_case_links: [],
        },
      ]);
      prismaMock.case.count.mockResolvedValue(2);

      const result = await service.getCaseList('u1', { page: 1, page_size: 10 });

      expect(result.cases).toEqual([
        expect.objectContaining({ id: 'case-chat', product_flow: 'chat_to_case' }),
        expect.objectContaining({ id: 'case-formal', product_flow: 'formal_remote' }),
      ]);
    });
  });

  describe('submitCase', () => {
    it('案件不存在應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(service.submitCase('case-1', 'u1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('案件'),
      });
    });

    it('非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
      });

      await expect(service.submitCase('case-1', 'u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('狀態非 draft 應拋出 CASE_NOT_EDITABLE', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'submitted',
      });

      await expect(service.submitCase('case-1', 'u1')).rejects.toMatchObject({
        code: 'CASE_NOT_EDITABLE',
      });
    });

    it('remote 模式缺少 defendant_statement 應拋出 VALIDATION_ERROR', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        mode: 'remote',
        defendant_statement: null,
      });

      await expect(service.submitCase('case-1', 'u1')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringMatching(/被告陳述|遠程/),
      });
    });

    it('collaborative 模式缺少 defendant_statement 應拋出 VALIDATION_ERROR（F03-BUG-004）', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        mode: 'collaborative',
        defendant_statement: '',
      });

      await expect(service.submitCase('case-1', 'u1')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringMatching(/被告陳述|遠程|協作/),
      });
    });

    it('成功應更新為 submitted 並返回', async () => {
      const updated = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'submitted',
        submitted_at: new Date(),
      };
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        mode: 'remote',
        defendant_statement: '被告已填寫足夠長度的陳述',
      });
      prismaMock.case.update.mockResolvedValue(updated);

      const result = await service.submitCase('case-1', 'u1');

      expect(result).toEqual(updated);
      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({ status: 'submitted' }),
      });
    });

  });

  describe('updateCase', () => {
    it('案件不存在應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCase('case-1', 'u1', { title: '新標題' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
      });

      await expect(
        service.updateCase('case-1', 'u3', { title: '新標題' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('狀態非 draft 應拋出 CASE_NOT_EDITABLE', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'submitted',
      });

      await expect(
        service.updateCase('case-1', 'u1', { title: '新標題' })
      ).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });
    });

    it('成功僅更新 title 時應調用 update', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: '原陳述',
        defendant_statement: null,
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      prismaMock.case.update.mockResolvedValue({ ...existing, title: '新標題' });

      const result = await service.updateCase('case-1', 'u1', { title: '新標題' });

      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({ title: '新標題', updated_at: expect.any(Date) }),
      });
      expect(mockDetectCaseType).not.toHaveBeenCalled();
    });

    it('僅更新 plaintiff_statement 時應調用 detectCaseType 並寫入 type', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: '原原告陳述',
        defendant_statement: null,
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      mockDetectCaseType.mockResolvedValue('感情糾紛');
      prismaMock.case.update.mockResolvedValue({ ...existing, type: '感情糾紛' });

      await service.updateCase('case-1', 'u1', {
        plaintiff_statement: LONG_STATEMENT_50,
      });

      expect(mockDetectCaseType).toHaveBeenCalledWith(LONG_STATEMENT_50.trim(), '');
      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          plaintiff_statement: LONG_STATEMENT_50.trim(),
          type: '感情糾紛',
          updated_at: expect.any(Date),
        }),
      });
    });

    it('僅更新 defendant_statement 時應驗證並調用 detectCaseType 用原原告陳述', async () => {
      const defendantStmt = LONG_STATEMENT_50 + '。'; // 確保 ≥50 字通過驗證
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: LONG_STATEMENT_50,
        defendant_statement: null,
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      mockDetectCaseType.mockResolvedValue('金錢糾紛');
      prismaMock.case.update.mockResolvedValue({ ...existing, defendant_statement: defendantStmt.trim() });

      await service.updateCase('case-1', 'u2', {
        defendant_statement: defendantStmt,
      });

      expect(mockDetectCaseType).toHaveBeenCalledWith(LONG_STATEMENT_50, defendantStmt.trim());
      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          defendant_statement: defendantStmt.trim(),
          type: '金錢糾紛',
          updated_at: expect.any(Date),
        }),
      });
    });

    it('傳入 evidence_urls 時應呼叫 validateEvidenceUrls', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: LONG_STATEMENT_50,
        defendant_statement: null,
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      prismaMock.case.update.mockResolvedValue(existing);

      await service.updateCase('case-1', 'u1', {
        evidence_urls: ['https://example.com/1.jpg'],
      });

      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({ updated_at: expect.any(Date) }),
      });
    });

    it('evidence_urls 傳入時應呼叫 update 僅更新 updated_at（來源未驗證 evidence_urls）', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: LONG_STATEMENT_50,
        defendant_statement: null,
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      prismaMock.case.update.mockResolvedValue(existing);

      await service.updateCase('case-1', 'u1', {
        evidence_urls: ['https://example.com/1.jpg'],
      });

      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({ updated_at: expect.any(Date) }),
      });
    });

    it('僅更新 defendant_statement 為 null 時應寫入 null', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: LONG_STATEMENT_50,
        defendant_statement: '原被告陳述',
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      mockDetectCaseType.mockResolvedValue('其他衝突');
      prismaMock.case.update.mockResolvedValue({ ...existing, defendant_statement: null });

      await service.updateCase('case-1', 'u2', { defendant_statement: '' });

      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          defendant_statement: null,
          type: '其他衝突',
          updated_at: expect.any(Date),
        }),
      });
    });

    it('僅更新 plaintiff_statement 時 type 由 detectCaseType 決定', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: '原原告陳述',
        defendant_statement: '原被告陳述',
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);
      mockDetectCaseType.mockResolvedValue('感情糾紛');
      prismaMock.case.update.mockResolvedValue(existing);

      await service.updateCase('case-1', 'u1', {
        plaintiff_statement: LONG_STATEMENT_50,
      });

      expect(mockDetectCaseType).toHaveBeenCalledWith(LONG_STATEMENT_50.trim(), '原被告陳述');
      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          plaintiff_statement: LONG_STATEMENT_50.trim(),
          type: '感情糾紛',
          updated_at: expect.any(Date),
        }),
      });
    });
  });

  describe('getCaseById', () => {
    it('案件不存在應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(service.getCaseById('case-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('案件'),
      });
    });

    it('quick 模式無 sessionId 應拋出 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'quick',
        session_id: 's1',
        evidences: [],
        judgment: null,
        pairing: null,
      });

      await expect(service.getCaseById('case-1', undefined, undefined)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('quick 模式 sessionId 不匹配應拋出 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'quick',
        session_id: 's1',
        evidences: [],
        judgment: null,
        pairing: null,
      });

      await expect(service.getCaseById('case-1', undefined, 's2')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('quick 模式 Session 已過期應拋出 SESSION_EXPIRED', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'quick',
        session_id: 's1',
        evidences: [],
        judgment: null,
        pairing: null,
      });
      mockGetSession.mockResolvedValue(null);

      await expect(service.getCaseById('case-1', undefined, 's1')).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
      });
    });

    it('quick 模式成功應返回 case', async () => {
      const case_ = {
        id: 'case-1',
        mode: 'quick',
        session_id: 's1',
        evidences: [{ file_url: 'http://a.com/1.jpg' }],
        judgment: null,
        pairing: null,
        chat_to_case_links: [],
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);
      mockGetSession.mockResolvedValue({ id: 's1' });

      const result = await service.getCaseById('case-1', undefined, 's1');

      expect(result).toBeDefined();
      expect(result).toMatchObject({ product_flow: 'quick_single' });
      expect(mockSignUrl).toHaveBeenCalled();
      expect(mockGetSession).toHaveBeenCalledWith('s1');
    });

    it('quick 模式可透過 quick_sessions 關聯恢復 session-bound 詳情訪問', async () => {
      const case_ = {
        id: 'case-1',
        mode: 'quick',
        session_id: null,
        evidences: [{ file_url: 'http://a.com/1.jpg' }],
        judgment: null,
        pairing: null,
        chat_to_case_links: [],
        quick_sessions: [{ id: 's1' }],
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);
      mockGetSession.mockResolvedValue({ id: 's1' });

      const result = await service.getCaseById('case-1', undefined, 's1');

      expect(result).toMatchObject({ id: 'case-1', product_flow: 'quick_single' });
      expect(mockGetSession).toHaveBeenCalledWith('s1');
      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/1.jpg');
    });

    it('collaborative 模式應允許以 sessionId 讀取案件', async () => {
      const case_ = {
        id: 'case-1',
        mode: 'collaborative',
        session_id: 's-collab',
        evidences: [{ file_url: 'http://a.com/1.jpg' }],
        judgment: null,
        pairing: null,
        chat_to_case_links: [],
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);
      mockGetSession.mockResolvedValue({ id: 's-collab' });

      const result = await service.getCaseById('case-1', undefined, 's-collab');

      expect(result).toBeDefined();
      expect(mockGetSession).toHaveBeenCalledWith('s-collab');
      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/1.jpg');
    });

    it('collaborative full-mode（無 session_id）應允許以當事人 userId 讀取案件', async () => {
      const case_ = {
        id: 'case-1',
        mode: 'collaborative',
        session_id: null,
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        evidences: [{ file_url: 'http://a.com/1.jpg' }],
        judgment: null,
        pairing: null,
        chat_to_case_links: [],
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);

      const result = await service.getCaseById('case-1', 'u1');

      expect(result).toBeDefined();
      expect(mockGetSession).not.toHaveBeenCalled();
      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/1.jpg');
    });

    it('chat-to-case 詳情應回傳 product_flow=chat_to_case', async () => {
      const case_ = {
        id: 'case-chat',
        mode: 'collaborative',
        session_id: null,
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        evidences: [],
        judgment: null,
        pairing: null,
        chat_to_case_links: [{ id: 'link-1' }],
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);

      const result = await service.getCaseById('case-chat', 'u1');

      expect(result).toMatchObject({
        id: 'case-chat',
        product_flow: 'chat_to_case',
      });
    });

    it('remote 模式無 userId 應拋出 UNAUTHORIZED', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'remote',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        evidences: [],
        judgment: null,
        pairing: null,
      });

      await expect(service.getCaseById('case-1')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('remote 模式非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'remote',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        evidences: [],
        judgment: null,
        pairing: null,
      });

      await expect(service.getCaseById('case-1', 'u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('remote 模式當事人應返回 case', async () => {
      const case_ = {
        id: 'case-1',
        mode: 'remote',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        evidences: [{ file_url: 'http://a.com/1.jpg' }],
        judgment: null,
        pairing: { user1: { token_version: 0 }, user2: { token_version: 0 } },
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);

      const result = await service.getCaseById('case-1', 'u1');

      expect(result).toBeDefined();
      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/1.jpg');
    });

    it('remote 模式 pairing 有 avatar_url 時應對頭像簽名', async () => {
      const case_ = {
        id: 'case-1',
        mode: 'remote',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        evidences: [],
        judgment: null,
        pairing: {
          user1: { id: 'u1', nickname: 'A', avatar_url: 'http://a.com/avatar1.jpg', token_version: 0 },
          user2: { id: 'u2', nickname: 'B', avatar_url: 'http://a.com/avatar2.jpg', token_version: 0 },
        },
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);
      mockSignAvatar.mockImplementation((user: unknown) => {
        const u = user as { avatar_url?: string } | null;
        if (!u?.avatar_url) return user;
        return { ...u, avatar_url: mockSignUrl(u.avatar_url) };
      });

      await service.getCaseById('case-1', 'u1');

      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/avatar1.jpg');
      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/avatar2.jpg');
    });
  });

  describe('getCaseBySessionId', () => {
    const expectedClaimableSessionCaseWhere = (sessionId: string) => ({
      OR: [
        {
          mode: 'quick',
          OR: [
            { session_id: sessionId },
            { quick_sessions: { some: { id: sessionId } } },
          ],
        },
        {
          mode: 'collaborative',
          session_id: sessionId,
        },
      ],
    });

    it('無案件應返回 null', async () => {
      prismaMock.case.findFirst.mockResolvedValue(null);

      const result = await service.getCaseBySessionId('s1');

      expect(result).toBeNull();
      expect(prismaMock.case.findFirst).toHaveBeenCalledWith({
        where: expectedClaimableSessionCaseWhere('s1'),
        include: expect.any(Object),
        orderBy: { created_at: 'desc' },
      });
    });

    it('有案件應返回並簽名證據 URL', async () => {
      const case_ = {
        id: 'case-1',
        session_id: 's1',
        mode: 'quick',
        evidences: [{ file_url: 'http://x.com/1.jpg' }],
        judgment: null,
        chat_to_case_links: [],
      };
      prismaMock.case.findFirst.mockResolvedValue(case_);

      const result = await service.getCaseBySessionId('s1');

      expect(result).toBeDefined();
      expect(mockSignUrl).toHaveBeenCalledWith('http://x.com/1.jpg');
      expect(result).toMatchObject({ product_flow: 'quick_single' });
    });

    it('應用 claimable session scope，支持快速雙人協作回訪', async () => {
      const case_ = {
        id: 'case-collab',
        session_id: 's1',
        mode: 'collaborative',
        evidences: [],
        judgment: null,
        chat_to_case_links: [],
      };
      prismaMock.case.findFirst.mockResolvedValue(case_);

      const result = await service.getCaseBySessionId('s1');

      expect(prismaMock.case.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expectedClaimableSessionCaseWhere('s1'),
      }));
      expect(result).toMatchObject({ id: 'case-collab', product_flow: 'quick_collaborative' });
    });

    it('有 judgment 時應 normalizeJudgment 補 responsibility_ratio', async () => {
      const case_ = {
        id: 'case-1',
        session_id: 's1',
        mode: 'quick',
        evidences: [],
        judgment: {
          id: 'j1',
          summary: '摘要',
          plaintiff_ratio: 70,
          defendant_ratio: 30,
          reconciliation_plans: [],
        },
        chat_to_case_links: [],
      };
      prismaMock.case.findFirst.mockResolvedValue(case_);

      const result = await service.getCaseBySessionId('s1');

      expect(result).toBeDefined();
      expect(result!.judgment).toMatchObject({
        plaintiff_ratio: 70,
        defendant_ratio: 30,
        responsibility_ratio: { plaintiff: 70, defendant: 30 },
      });
      expect(mockGetActiveRiskState).toHaveBeenCalledWith({
        subjectType: 'case',
        subjectId: 'case-1',
      });
    });
  });

  describe('createQuickCase', () => {
    it('無 sessionId 時應創建新 Session 並創建案件', async () => {
      mockValidateSessionId.mockReturnValue(false);
      mockCreateSession.mockResolvedValue({ session_id: 'new-s1', expires_at: new Date() });
      mockGetSession.mockResolvedValue({ id: 'new-s1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });

      const newCase = {
        id: 'case-1',
        pairing_id: 'pair-1',
        title: '標題',
        type: '其他衝突',
        session_id: 'new-s1',
        mode: 'quick',
        status: 'submitted',
      };
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(newCase as never) },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      const result = await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        null
      );

      expect(mockCreateSession).toHaveBeenCalled();
      expect(result.sessionId).toBe('new-s1');
      expect(result.case).toEqual(newCase);
      expect(result.sessionExpiresAt).toBeDefined();
    });

    it('sessionId 格式無效時應創建新 Session', async () => {
      mockValidateSessionId.mockReturnValue(false);
      mockCreateSession.mockResolvedValue({ session_id: 'new-s1', expires_at: new Date() });
      mockGetSession.mockResolvedValue({ id: 'new-s1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      const newCase = {
        id: 'case-1',
        pairing_id: 'pair-1',
        session_id: 'new-s1',
        mode: 'quick',
        status: 'submitted',
      };
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(newCase as never) },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      const result = await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        'invalid-session'
      );

      expect(mockCreateSession).toHaveBeenCalled();
      expect(result.sessionId).toBe('new-s1');
    });

    it('有效 sessionId 且 Session 存在應使用原 Session', async () => {
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      const newCase = {
        id: 'case-1',
        pairing_id: 'pair-1',
        session_id: 's1',
        mode: 'quick',
        status: 'submitted',
      };
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(newCase as never) },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      const result = await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        's1'
      );

      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(result.sessionId).toBe('s1');
    });

    it('原告陳述過短應拋出驗證錯誤', async () => {
      mockCreateSession.mockResolvedValue({ session_id: 's1', expires_at: new Date() });
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });

      await expect(
        service.createQuickCase({ plaintiff_statement: '短' }, null)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('sessionId 有效但 getSession 回傳 null 應創建新 Session', async () => {
      mockGetSession
        .mockResolvedValueOnce(null) // 第一次：sessionId 有效但 session 不存在
        .mockResolvedValueOnce({ id: 'new-s1', case_id: null, expires_at: new Date() });
      mockCreateSession.mockResolvedValue({ session_id: 'new-s1', expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      const newCase = {
        id: 'case-1',
        pairing_id: 'pair-1',
        session_id: 'new-s1',
        mode: 'quick',
        status: 'submitted',
      };
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(newCase as never) },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      const result = await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        'expired-session-id'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Session not found or expired, creating new session', { sessionId: 'expired-session-id' });
      expect(mockCreateSession).toHaveBeenCalled();
      expect(result.sessionId).toBe('new-s1');
    });

    it('Session 已有 case_id 應分配新 Session 並用新 sessionId 建案', async () => {
      const expiresAt = new Date();
      let getSessionCallCount = 0;
      mockGetSession.mockImplementation((id: string) => {
        getSessionCallCount += 1;
        if (id === 's1') {
          return Promise.resolve({ id: 's1', case_id: 'existing-case-id', expires_at: expiresAt });
        }
        if (id === 'new-s1') {
          return Promise.resolve({ id: 'new-s1', case_id: null, expires_at: expiresAt });
        }
        return Promise.resolve(null);
      });
      mockCreateSession.mockResolvedValue({ session_id: 'new-s1', expires_at: expiresAt });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      const newCase = {
        id: 'case-1',
        pairing_id: 'pair-1',
        session_id: 'new-s1',
        mode: 'quick',
        status: 'submitted',
      };
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(newCase as never) },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      const result = await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        's1'
      );

      expect(mockCreateSession).toHaveBeenCalled();
      expect(result.sessionId).toBe('new-s1');
    });

    it('getSession 最終仍為 null 應拋出 INTERNAL_ERROR Session創建失敗', async () => {
      mockGetSession.mockResolvedValue(null);
      mockCreateSession.mockResolvedValue({ session_id: 'new-s1', expires_at: new Date() });

      await expect(
        service.createQuickCase({ plaintiff_statement: LONG_STATEMENT_30 }, null)
      ).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Session創建失敗'),
      });
    });

    it('有 defendant_statement 時應驗證並傳入事務', async () => {
      const defendantStmt = '被告陳述至少十個字以上才能通過驗證完畢';
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      let capturedCaseData: { defendant_statement: string | null } | null = null;
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: {
            create: jest.fn().mockImplementation((arg: unknown) => {
              capturedCaseData = (arg as { data: { defendant_statement: string | null } }).data;
              return Promise.resolve({ id: 'case-1', session_id: 's1', mode: 'quick', status: 'submitted' });
            }),
          },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30, defendant_statement: defendantStmt },
        's1'
      );

      expect(capturedCaseData).not.toBeNull();
      expect(capturedCaseData!.defendant_statement).toBe(defendantStmt.trim());
    });

    it('defendant_statement 為空字串時應成功建案並正規化為 null', async () => {
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      let capturedCaseData: { defendant_statement: string | null } | null = null;
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: {
            create: jest.fn().mockImplementation((arg: unknown) => {
              capturedCaseData = (arg as { data: { defendant_statement: string | null } }).data;
              return Promise.resolve({ id: 'case-1', session_id: 's1', mode: 'quick', status: 'submitted' });
            }),
          },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      const result = await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30, defendant_statement: '' },
        's1'
      );

      expect(result.case).toBeDefined();
      expect(capturedCaseData).not.toBeNull();
      expect(capturedCaseData!.defendant_statement).toBeNull();
    });

    it('有 evidence_urls 時應驗證並在事務中 createMany', async () => {
      const evidenceUrls = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      const createManyMock = jest.fn().mockResolvedValue({} as never);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue({
              id: 'case-1',
              session_id: 's1',
              mode: 'quick',
              status: 'submitted',
            } as never),
          },
          evidence: { createMany: createManyMock },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      await service.createQuickCase(
        { plaintiff_statement: LONG_STATEMENT_30, evidence_urls: evidenceUrls },
        's1'
      );

      expect(createManyMock).toHaveBeenCalledWith({
        data: evidenceUrls.map(url => ({
          case_id: 'case-1',
          file_url: url,
          file_type: 'image',
          file_size: 0,
          user_id: null,
        })),
      });
    });

    it('evidence_urls 超過三筆應拋出 TOO_MANY_FILES', async () => {
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });

      await expect(
        service.createQuickCase(
          {
            plaintiff_statement: LONG_STATEMENT_30,
            evidence_urls: [
              'https://example.com/1.jpg',
              'https://example.com/2.jpg',
              'https://example.com/3.jpg',
              'https://example.com/4.jpg',
            ],
          },
          's1'
        )
      ).rejects.toMatchObject({ code: 'TOO_MANY_FILES' });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('AI detectCaseType 拋錯時應使用默認類型 其他衝突', async () => {
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockRejectedValue(new Error('AI error'));
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      let capturedType: string | null = null;
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: {
            create: jest.fn().mockImplementation((arg: unknown) => {
              capturedType = (arg as { data: { type: string } }).data.type;
              return Promise.resolve({ id: 'case-1', session_id: 's1', mode: 'quick', status: 'submitted' });
            }),
          },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });

      await service.createQuickCase({ plaintiff_statement: LONG_STATEMENT_30 }, 's1');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to detect case type', expect.objectContaining({ sessionId: 's1', error: expect.any(Error) }));
      expect(capturedType).toBe('其他衝突');
    });

    it('generateCaseTitle 拋錯時應使用默認標題', async () => {
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      let capturedTitle: string | null = null;
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          case: {
            create: jest.fn().mockImplementation((arg: unknown) => {
              capturedTitle = (arg as { data: { title: string } }).data.title;
              return Promise.resolve({ id: 'case-1', session_id: 's1', mode: 'quick', status: 'submitted' });
            }),
          },
          evidence: { createMany: jest.fn().mockResolvedValue({} as never) },
          quickSession: { update: jest.fn().mockResolvedValue({} as never) },
        };
        return fn(tx);
      });
      jest.spyOn(service as any, 'generateTitle').mockImplementationOnce(() => {
        throw new Error('title fail');
      });

      await service.createQuickCase({ plaintiff_statement: LONG_STATEMENT_30 }, 's1');

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to generate title', expect.objectContaining({ error: expect.any(Error) }));
      expect(capturedTitle).not.toBeNull();
      expect(capturedTitle!).toMatch(/^案件-/);
    });

    it('$transaction 回絕時應拋出 INTERNAL_ERROR 案件創建失敗', async () => {
      mockGetSession.mockResolvedValue({ id: 's1', case_id: null, expires_at: new Date() });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      prismaMock.$transaction.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createQuickCase({ plaintiff_statement: LONG_STATEMENT_30 }, 's1')
      ).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('案件創建失敗'),
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create case in transaction',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('createOrUpdateCollaborativeCase', () => {
    it('角色 A 缺少 plaintiff_statement 時應拋出 VALIDATION_ERROR', async () => {
      await expect(
        service.createOrUpdateCollaborativeCase({}, 's1')
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('角色 A 首次提交時應建立 collaborative draft case 並綁定 session', async () => {
      mockValidateSessionId.mockReturnValue(true);
      mockGetSession.mockResolvedValue({ id: 's1', expires_at: new Date('2026-01-01T00:00:00Z') });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      prismaMock.case.create.mockResolvedValue({
        id: 'case-collab-1',
        session_id: 's1',
        mode: 'collaborative',
        status: 'draft',
      });

      const result = await service.createOrUpdateCollaborativeCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        's1'
      );

      expect(prismaMock.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pairing_id: 'pair-1',
            plaintiff_statement: LONG_STATEMENT_30.trim(),
            status: 'draft',
            mode: 'collaborative',
            session_id: 's1',
          }),
        })
      );
      expect(mockAddCaseToSession).toHaveBeenCalledWith('s1', 'case-collab-1');
      expect(result.phase).toBe('a_done');
      expect(result.sessionId).toBe('s1');
    });

    it('角色 A 在 session 無效時應自動建立新 session', async () => {
      mockValidateSessionId.mockReturnValue(false);
      mockCreateSession.mockResolvedValue({
        session_id: 's-new',
        expires_at: new Date('2026-01-01T00:00:00Z'),
      });
      mockGetSession.mockResolvedValue({ id: 's-new', expires_at: new Date('2026-01-01T00:00:00Z') });
      mockDetectCaseType.mockResolvedValue('其他衝突');
      mockCreateTempPairing.mockResolvedValue({ id: 'pair-1' });
      prismaMock.case.create.mockResolvedValue({
        id: 'case-collab-2',
        session_id: 's-new',
        mode: 'collaborative',
        status: 'draft',
      });

      const result = await service.createOrUpdateCollaborativeCase(
        { plaintiff_statement: LONG_STATEMENT_30 },
        'bad-session'
      );

      expect(mockCreateSession).toHaveBeenCalled();
      expect(mockAddCaseToSession).toHaveBeenCalledWith('s-new', 'case-collab-2');
      expect(result.sessionId).toBe('s-new');
      expect(result.phase).toBe('a_done');
    });

    it('角色 B 案件不存在或非 collaborative 時應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-collab-1',
        mode: 'quick',
        session_id: 's1',
        status: 'draft',
      });

      await expect(
        service.createOrUpdateCollaborativeCase(
          { case_id: 'case-collab-1', defendant_statement: '角色B已寫足夠字數了' },
          's1'
        )
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('角色 B session 不匹配時應拋出 FORBIDDEN', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-collab-1',
        mode: 'collaborative',
        session_id: 's-expected',
        status: 'draft',
      });

      await expect(
        service.createOrUpdateCollaborativeCase(
          { case_id: 'case-collab-1', defendant_statement: '角色B已寫足夠字數了' },
          's-other'
        )
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(prismaMock.case.update).not.toHaveBeenCalled();
    });

    it('角色 B session 已過期時應拋出 SESSION_EXPIRED', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-collab-1',
        mode: 'collaborative',
        session_id: 's1',
        status: 'draft',
      });
      mockGetSession.mockResolvedValue(null);

      await expect(
        service.createOrUpdateCollaborativeCase(
          { case_id: 'case-collab-1', defendant_statement: '角色B已寫足夠字數了' },
          's1'
        )
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      expect(prismaMock.case.update).not.toHaveBeenCalled();
    });

    it('角色 B 案件已提交時應拋出 CASE_NOT_EDITABLE', async () => {
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-collab-1',
        mode: 'collaborative',
        session_id: 's1',
        status: 'submitted',
      });
      mockGetSession.mockResolvedValue({ id: 's1', expires_at: new Date('2026-01-01T00:00:00Z') });

      await expect(
        service.createOrUpdateCollaborativeCase(
          { case_id: 'case-collab-1', defendant_statement: '角色B已寫足夠字數了' },
          's1'
        )
      ).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });
      expect(prismaMock.case.update).not.toHaveBeenCalled();
    });

    it('角色 B 正常提交時應更新 defendant_statement 並返回 submitted', async () => {
      const expiresAt = new Date('2026-01-01T00:00:00Z');
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-collab-1',
        mode: 'collaborative',
        session_id: 's1',
        status: 'draft',
      });
      mockGetSession.mockResolvedValue({ id: 's1', expires_at: expiresAt });
      prismaMock.case.update.mockResolvedValue({
        id: 'case-collab-1',
        mode: 'collaborative',
        status: 'submitted',
        defendant_statement: '角色B已寫足夠字數了',
      });

      const result = await service.createOrUpdateCollaborativeCase(
        { case_id: 'case-collab-1', defendant_statement: '角色B已寫足夠字數了' },
        's1'
      );

      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-collab-1' },
        data: expect.objectContaining({
          defendant_statement: '角色B已寫足夠字數了',
          status: 'submitted',
          submitted_at: expect.any(Date),
        }),
      });
      expect(result.phase).toBe('submitted');
      expect(result.sessionId).toBe('s1');
      expect(result.sessionExpiresAt).toEqual(expiresAt);
    });
  });
});
