/**
 * CaseService 單元測試（mock Prisma、sessionService、pairingService、aiService、fileService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateSession: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateTempPairing: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDetectCaseType: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSignUrl: any = jest.fn();
const mockValidateSessionId = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  pairing: { findUnique: jest.fn() },
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
  },
}));
jest.mock('../../../src/services/pairing.service', () => ({
  pairingService: {
    createTempPairing: (sessionId: string) => mockCreateTempPairing(sessionId),
  },
}));
jest.mock('../../../src/services/ai.service', () => ({
  aiService: {
    detectCaseType: (a: string, b: string) => mockDetectCaseType(a, b),
  },
}));
jest.mock('../../../src/services/file.service', () => ({
  fileService: {
    signUrl: (url: string) => mockSignUrl(url),
  },
}));
jest.mock('../../../src/utils/session', () => ({
  validateSessionId: (id: string) => mockValidateSessionId(id),
}));
jest.mock('../../../src/utils/helpers', () => {
  const actual = jest.requireActual<typeof import('../../../src/utils/helpers')>('../../../src/utils/helpers');
  return { ...actual, generateCaseTitle: jest.fn((s: string) => actual.generateCaseTitle(s)) };
});
import { CaseService } from '../../../src/services/case.service';
import { generateCaseTitle } from '../../../src/utils/helpers';

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
    mockValidateSessionId.mockReturnValue(true);
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

    it('有 type 時不調用 AI detectCaseType', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'pair-1',
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: {},
        user2: {},
      });
      prismaMock.case.create.mockResolvedValue({ id: 'case-1' });

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        type: '感情糾紛',
      });

      expect(mockDetectCaseType).not.toHaveBeenCalled();
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

    it('傳入 data.evidence_urls 時應迴圈 create evidence', async () => {
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
      prismaMock.evidence.create.mockResolvedValue({} as never);

      await service.createCase('u1', {
        pairing_id: 'pair-1',
        plaintiff_statement: LONG_STATEMENT_50,
        evidence_urls: evidenceUrls,
      });

      expect(prismaMock.evidence.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.evidence.create).toHaveBeenNthCalledWith(1, {
        data: {
          case_id: 'case-1',
          file_url: evidenceUrls[0],
          file_type: 'image',
          file_size: 0,
          user_id: 'u1',
        },
      });
      expect(prismaMock.evidence.create).toHaveBeenNthCalledWith(2, {
        data: {
          case_id: 'case-1',
          file_url: evidenceUrls[1],
          file_type: 'image',
          file_size: 0,
          user_id: 'u1',
        },
      });
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
    it('不傳 params 時應使用預設分頁與排序', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      await service.getCaseList('u1');

      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: { created_at: 'desc' },
        })
      );
    });

    it('應按 userId 與 mode=remote 查詢並分頁', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);
      prismaMock.case.count.mockResolvedValue(0);

      const result = await service.getCaseList('u1', { page: 1, page_size: 10 });

      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ plaintiff_id: 'u1' }, { defendant_id: 'u1' }],
            mode: 'remote',
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
            OR: expect.any(Array),
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

      await service.updateCase('case-1', 'u1', {
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

    it('evidence_urls 格式無效時應拋出 VALIDATION_ERROR', async () => {
      const existing = {
        id: 'case-1',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        status: 'draft',
        plaintiff_statement: LONG_STATEMENT_50,
        defendant_statement: null,
      };
      prismaMock.case.findUnique.mockResolvedValue(existing);

      await expect(
        service.updateCase('case-1', 'u1', {
          evidence_urls: ['not-a-valid-url'],
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prismaMock.case.update).not.toHaveBeenCalled();
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

      await service.updateCase('case-1', 'u1', { defendant_statement: '' });

      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          defendant_statement: null,
          type: '其他衝突',
          updated_at: expect.any(Date),
        }),
      });
    });

    it('同時更新 plaintiff_statement 與 defendant_statement 時 type 由原告路徑決定', async () => {
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
        defendant_statement: LONG_STATEMENT_50,
      });

      expect(mockDetectCaseType).toHaveBeenCalledWith(LONG_STATEMENT_50.trim(), LONG_STATEMENT_50.trim());
      expect(prismaMock.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          plaintiff_statement: LONG_STATEMENT_50.trim(),
          defendant_statement: LONG_STATEMENT_50.trim(),
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
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);
      mockGetSession.mockResolvedValue({ id: 's1' });

      const result = await service.getCaseById('case-1', undefined, 's1');

      expect(result).toBeDefined();
      expect(mockSignUrl).toHaveBeenCalled();
      expect(mockGetSession).toHaveBeenCalledWith('s1');
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
        pairing: { user1: {}, user2: {} },
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
          user1: { id: 'u1', nickname: 'A', avatar_url: 'http://a.com/avatar1.jpg' },
          user2: { id: 'u2', nickname: 'B', avatar_url: 'http://a.com/avatar2.jpg' },
        },
      };
      prismaMock.case.findUnique.mockResolvedValue(case_);

      await service.getCaseById('case-1', 'u1');

      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/avatar1.jpg');
      expect(mockSignUrl).toHaveBeenCalledWith('http://a.com/avatar2.jpg');
    });
  });

  describe('getCaseBySessionId', () => {
    it('無案件應返回 null', async () => {
      prismaMock.case.findFirst.mockResolvedValue(null);

      const result = await service.getCaseBySessionId('s1');

      expect(result).toBeNull();
      expect(prismaMock.case.findFirst).toHaveBeenCalledWith({
        where: { session_id: 's1', mode: 'quick' },
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
      };
      prismaMock.case.findFirst.mockResolvedValue(case_);

      const result = await service.getCaseBySessionId('s1');

      expect(result).toBeDefined();
      expect(mockSignUrl).toHaveBeenCalledWith('http://x.com/1.jpg');
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
      };
      prismaMock.case.findFirst.mockResolvedValue(case_);

      const result = await service.getCaseBySessionId('s1');

      expect(result).toBeDefined();
      expect(result!.judgment).toMatchObject({
        plaintiff_ratio: 70,
        defendant_ratio: 30,
        responsibility_ratio: { plaintiff: 70, defendant: 30 },
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
      (generateCaseTitle as jest.Mock).mockImplementationOnce(() => {
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
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create case in transaction', expect.objectContaining({ sessionId: 's1', error: expect.any(Error) }));
    });
  });
});
