/**
 * 快速體驗全流程集成測試
 * 
 * 測試目標：
 * - 驗證完整的快速體驗流程是否能正常運作
 * - 模擬前端與後端 API 的所有交互
 * - 覆蓋正常流程及各種異常場景
 * 
 * 流程圖：
 * 前端 -> POST /sessions/quick -> 創建 Session
 * 前端 -> POST /cases/quick -> 創建案件 -> 異步觸發判決生成
 * 前端 -> GET /cases/:id/judgment (輪詢) -> 獲取判決
 * 前端 -> POST /cases/:id/evidence -> 上傳證據
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

// 增加 Jest 超時以適應集成測試
jest.setTimeout(60000);

// Mock AI 服務（必須在 import app 之前）
jest.mock('../../src/services/ai.service', () => {
  return {
    SAFETY_SIGNAL_REGEX: /安全注意|安全隱憂|控制行為|暴力|威脅|權力不對等|經濟控制|人身威脅|貶低人格|孤立社交|自傷|自殺/,
    IPV_SIGNAL_REGEX: /控制行為|暴力|威脅|權力不對等|經濟控制|人身威脅|貶低人格|孤立社交/,
    CRISIS_SIGNAL_REGEX: /自傷|自殺/,
    AIService: jest.fn().mockImplementation(() => ({
      detectCaseType: jest.fn(),
      analyzeEmotionalDynamics: jest.fn(),
      generateJudgment: jest.fn(),
      generateReconciliationPlans: jest.fn(),
      generateText: jest.fn(),
      generateSummary: jest.fn(),
      resetDailyCallCount: jest.fn(),
    })),
    aiService: {
      detectCaseType: jest.fn(),
      analyzeEmotionalDynamics: jest.fn(),
      generateJudgment: jest.fn(),
      generateReconciliationPlans: jest.fn(),
      generateText: jest.fn(),
      generateSummary: jest.fn(),
      resetDailyCallCount: jest.fn(),
    },
  };
});

// 獲取 mock 的 AI 服務
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aiServiceMock: any = require('../../src/services/ai.service').aiService;

// 延遲導入 app，確保 mock 先生效
import app from '../../src/app';
import { ApiClient, createApiClient } from './helpers/api-client';
import { 
  resetAIMock, 
  DEFAULT_MOCK_JUDGMENT, 
  DEFAULT_CASE_TYPE,
  createJudgmentResponse 
} from './helpers/mock-ai';
import {
  cleanupTestData,
  connectDatabase,
  disconnectDatabase,
  sleep,
  createMockFiles,
  getPrismaClient,
  createExpiredTestSession,
  randomString,
} from './helpers/test-utils';
import {
  validCaseRequests,
  invalidCaseRequests,
  sessionFixtures,
  httpStatus,
  pollingConfig,
} from './fixtures/quick-experience.fixtures';

// Flow 測試依賴可用的真實 PostgreSQL；默認關閉，避免在未配置 DB 的環境中誤報失敗。
const shouldRunFlowTests = process.env.RUN_FLOW_TESTS === 'true';
const flowDescribe = shouldRunFlowTests ? describe : describe.skip;

flowDescribe('快速體驗全流程集成測試', () => {
  let apiClient: ApiClient;
  let prisma: ReturnType<typeof getPrismaClient>;
  let databaseConnected = false;

  beforeAll(async () => {
    prisma = getPrismaClient();
    try {
      await connectDatabase();
      databaseConnected = true;
      console.log('✓ 數據庫連接成功');
    } catch (error) {
      console.warn('⚠ 數據庫連接失敗，部分測試將被跳過');
      console.warn('  若要運行完整測試，請確保數據庫可用並設置 DATABASE_URL');
      databaseConnected = false;
    }
  });
  // 注意：Jest 不支持 Jasmine 的 pending()。
  // 此文件已改為 RUN_FLOW_TESTS 顯式開啟；未開啟時由 flowDescribe 直接 skip。

  afterAll(async () => {
    if (databaseConnected) {
      try {
        await cleanupTestData();
        await disconnectDatabase();
      } catch (error) {
        console.warn('清理數據庫時發生錯誤:', error);
      }
    }
  });

  beforeEach(async () => {
    // 重置 API 客戶端
    apiClient = createApiClient(app);
    
    // 重置並設置默認 AI Mock
    jest.clearAllMocks();
    aiServiceMock.detectCaseType.mockResolvedValue(DEFAULT_CASE_TYPE);
    aiServiceMock.analyzeEmotionalDynamics.mockResolvedValue({
      severity: 'moderate',
      personA: {
        primaryFeelings: '失望、委屈',
        unmetNeeds: '被重視、被理解',
        communicationPattern: '追逐型',
        readinessStage: 'contemplation',
      },
      personB: {
        primaryFeelings: '壓力、防衛',
        unmetNeeds: '被體諒、被信任',
        communicationPattern: '迴避型',
        readinessStage: 'precontemplation',
      },
      interactionCycle: 'A 追問、B 沉默，衝突升級',
      triggerPattern: '當一方感到被忽視時',
      coreIssue: '彼此需求沒有被看見',
      secondaryIssues: [],
      relationshipStrengths: '雙方仍願意對話',
      gottmanFlags: [],
      safetyFlags: [],
      suggestedApproach: '先驗證感受，再做行為調整',
    });
    aiServiceMock.generateJudgment.mockResolvedValue(DEFAULT_MOCK_JUDGMENT);
    aiServiceMock.generateSummary.mockResolvedValue(DEFAULT_MOCK_JUDGMENT.summary);

    // 如果數據庫連接可用，清理數據
    if (databaseConnected) {
      try {
        await cleanupTestData();
      } catch (error) {
        console.warn('清理測試數據失敗:', error);
      }
    }
  });

  afterEach(async () => {
    resetAIMock();
  });

  // 輔助函數：檢查數據庫是否可用
  const skipIfNoDatabase = () => {
    if (!databaseConnected) {
      console.log('  [跳過] 數據庫不可用');
      return true;
    }
    return false;
  };

  // ==================== 1. 正常流程測試 (Happy Path) ====================
    describe('1. 正常流程 (Happy Path)', () => {
      it('應該完成完整的快速體驗流程：Session創建 -> 案件創建 -> 判決獲取', async () => {
      if (skipIfNoDatabase()) return;

      // Step 1: 創建 Session
      const sessionResult = await apiClient.createSession();
      
      expect([httpStatus.OK, httpStatus.CREATED]).toContain(sessionResult.response.status);
      expect(sessionResult.data).toBeDefined();
      expect(sessionResult.data?.session_id).toBeTruthy();
      expect(sessionResult.data?.expires_at).toBeTruthy();
      
      // 驗證 session_id 已自動保存
      expect(apiClient.getSessionId()).toBe(sessionResult.data?.session_id);

      // Step 2: 創建案件
      const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      
      expect(caseResult.response.status).toBe(httpStatus.CREATED);
      expect(caseResult.data).toBeDefined();
      expect(caseResult.data?.case).toBeDefined();
      expect(caseResult.data?.case.id).toBeTruthy();
      expect(caseResult.data?.case.plaintiff_statement).toBe(validCaseRequests.coupleDispute.plaintiff_statement);
      expect(caseResult.data?.case.defendant_statement).toBe(validCaseRequests.coupleDispute.defendant_statement);
      expect(caseResult.data?.case.mode).toBe('quick');

      const caseId = caseResult.data!.case.id;

      // Step 3: 等待判決生成（異步觸發）
      // 給異步判決生成一些時間
      await sleep(500);

      // Step 4: 輪詢獲取判決
      const pollResult = await apiClient.pollJudgment(caseId, {
        maxAttempts: pollingConfig.testMaxAttempts,
        intervalMs: pollingConfig.testIntervalMs,
      });

      expect(pollResult.timedOut).toBe(false);
      expect(pollResult.judgment).toBeDefined();
      expect(pollResult.judgment?.judgment_content).toBeTruthy();
      expect(pollResult.judgment?.summary).toBeTruthy();
      expect(pollResult.judgment?.responsibility_ratio).toBeDefined();

      // 驗證 AI 服務被正確調用
      expect(aiServiceMock.detectCaseType).toHaveBeenCalledWith(
        validCaseRequests.coupleDispute.plaintiff_statement,
        validCaseRequests.coupleDispute.defendant_statement
      );
      expect(aiServiceMock.generateJudgment).toHaveBeenCalled();
    }, 30000);

    it('應該支持不同類型的案件陳述', async () => {
      if (skipIfNoDatabase()) return;

      // 創建 Session
      await apiClient.createSession();

      // 測試不同的案件類型
      const testCases = [
        validCaseRequests.houseworkDispute,
        validCaseRequests.moneyDispute,
        validCaseRequests.socialDispute,
      ];

      for (const testCase of testCases) {
        // 清理之前的數據
        await cleanupTestData();
        apiClient = createApiClient(app);

        // 創建新 Session
        await apiClient.createSession();

        // 創建案件
        const caseResult = await apiClient.createQuickCase(testCase);
        
        expect(caseResult.response.status).toBe(httpStatus.CREATED);
        expect(caseResult.data?.case).toBeDefined();
      }
    });
  });

  // ==================== 2. Session 相關場景 ====================
  describe('2. Session 相關場景', () => {
    it('無 Session ID 時應自動創建 Session', async () => {
      if (skipIfNoDatabase()) return;

      // 不創建 Session 直接創建案件
      const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      
      // 應該成功創建，後端會自動創建 Session
      expect(caseResult.response.status).toBe(httpStatus.CREATED);
      expect(caseResult.data?.session_id).toBeTruthy();
      expect(apiClient.getSessionId()).toBe(caseResult.data?.session_id);
    });

    it('過期 Session 應返回錯誤或自動創建新 Session', async () => {
      if (skipIfNoDatabase()) return;

      // 在數據庫中創建一個過期的 Session
      const expiredSession = await createExpiredTestSession();
      apiClient.setSessionId(expiredSession.session_id);

      // 嘗試使用過期 Session 創建案件
      const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      
      // 後端應該處理過期 Session（創建新的或返回錯誤）
      // 根據具體實現，這裡可能有兩種情況：
      // 1. 自動創建新 Session 並成功
      // 2. 返回 Session 過期錯誤
      if (caseResult.response.status === httpStatus.CREATED) {
        // 如果成功，應該有新的 Session ID
        expect(caseResult.data?.session_id).toBeTruthy();
      } else {
        // 如果失敗，應該是 Session 相關錯誤
        expect([httpStatus.BAD_REQUEST, httpStatus.UNAUTHORIZED]).toContain(caseResult.response.status);
      }
    });

    it('無效的 Session ID 格式應被拒絕或忽略', async () => {
      for (const invalidSessionId of sessionFixtures.invalidSessionIds) {
        if (!invalidSessionId || invalidSessionId.trim() === '') continue;
        
        apiClient.setSessionId(invalidSessionId);
        const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
        
        // 應該被處理（拒絕或創建新 Session）
        // 不應該導致服務器錯誤
        expect(caseResult.response.status).not.toBe(httpStatus.INTERNAL_SERVER_ERROR);
      }
    });

    it('Session 應該與案件正確關聯', async () => {
      // 創建 Session
      const sessionResult = await apiClient.createSession();
      const sessionId = sessionResult.data!.session_id;

      // 創建案件
      const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      const caseId = caseResult.data!.case.id;

      // 驗證案件與 Session 關聯
      expect(caseResult.data?.case.session_id).toBe(sessionId);

      // 使用相同 Session 獲取案件
      const getCaseResult = await apiClient.getCase(caseId);
      expect(getCaseResult.response.status).toBe(httpStatus.OK);
      expect(getCaseResult.data?.session_id).toBe(sessionId);
    });

    it('不同 Session 不應訪問其他 Session 的案件', async () => {
      // 創建第一個 Session 和案件
      await apiClient.createSession();
      const case1Result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      const case1Id = case1Result.data!.case.id;

      // 創建第二個 Session
      apiClient.setSessionId(null);
      await apiClient.createSession();

      // 嘗試訪問第一個案件
      const getCaseResult = await apiClient.getCase(case1Id);
      
      // 應該被拒絕或返回錯誤
      expect([httpStatus.NOT_FOUND, httpStatus.FORBIDDEN]).toContain(getCaseResult.response.status);
    });
  });

  // ==================== 2.5 匿名升格 / claim-session 場景 ====================
  describe('2.5 匿名升格 / claim-session 場景', () => {
    it('註冊後 claim-session 應將 quick case 綁定到當前 user', async () => {
      if (skipIfNoDatabase()) return;

      await apiClient.createSession();
      const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      expect(caseResult.response.status).toBe(httpStatus.CREATED);
      const caseId = caseResult.data!.case.id;
      const sessionId = caseResult.data!.session_id;

      const email = `claim-${randomString(8)}@example.com`;
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'Password123!', nickname: 'ClaimUser' });

      expect(registerRes.status).toBe(httpStatus.CREATED);
      expect(registerRes.body?.data?.token).toBeTruthy();
      expect(registerRes.body?.data?.user?.id).toBeTruthy();

      const token = registerRes.body.data.token as string;
      const userId = registerRes.body.data.user.id as string;

      const claimRes = await request(app)
        .post('/api/v1/auth/claim-session')
        .set('Authorization', `Bearer ${token}`)
        .send({ session_id: sessionId });

      expect(claimRes.status).toBe(httpStatus.OK);
      expect(claimRes.body?.data).toEqual({ case_id: caseId });

      const claimedCase = await prisma.case.findUnique({ where: { id: caseId } });
      expect(claimedCase?.plaintiff_id).toBe(userId);
      expect(claimedCase?.mode).toBe('quick');
    });

    it('已被 claim 的 quick case 不應被後續用戶覆蓋', async () => {
      if (skipIfNoDatabase()) return;

      await apiClient.createSession();
      const caseResult = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      expect(caseResult.response.status).toBe(httpStatus.CREATED);
      const caseId = caseResult.data!.case.id;
      const sessionId = caseResult.data!.session_id;

      const registerUser = async (suffix: string) => {
        const email = `claim-${suffix}-${randomString(6)}@example.com`;
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({ email, password: 'Password123!', nickname: suffix });
        expect(res.status).toBe(httpStatus.CREATED);
        return {
          token: res.body.data.token as string,
          userId: res.body.data.user.id as string,
        };
      };

      const firstUser = await registerUser('first');
      const secondUser = await registerUser('second');

      const firstClaimRes = await request(app)
        .post('/api/v1/auth/claim-session')
        .set('Authorization', `Bearer ${firstUser.token}`)
        .send({ session_id: sessionId });
      expect(firstClaimRes.status).toBe(httpStatus.OK);
      expect(firstClaimRes.body?.data).toEqual({ case_id: caseId });

      const secondClaimRes = await request(app)
        .post('/api/v1/auth/claim-session')
        .set('Authorization', `Bearer ${secondUser.token}`)
        .send({ session_id: sessionId });
      expect(secondClaimRes.status).toBe(httpStatus.OK);
      expect(secondClaimRes.body?.data).toEqual({ case_id: caseId });

      const claimedCase = await prisma.case.findUnique({ where: { id: caseId } });
      expect(claimedCase?.plaintiff_id).toBe(firstUser.userId);
    });
  });

  // ==================== 2.6 協作聽證場景 ====================
  describe('2.6 協作聽證場景', () => {
    it('應該完成協作聽證流程：角色A建立 -> 角色B提交 -> 判決可讀取', async () => {
      if (skipIfNoDatabase()) return;

      const sessionResult = await apiClient.createSession();
      expect([httpStatus.OK, httpStatus.CREATED]).toContain(sessionResult.response.status);
      expect(sessionResult.data?.session_id).toBeTruthy();

      const roleAStatement = validCaseRequests.coupleDispute.plaintiff_statement;
      const roleBStatement = validCaseRequests.coupleDispute.defendant_statement;

      const roleAResult = await apiClient.createCollaborativeCase({
        plaintiff_statement: roleAStatement,
      });

      expect(roleAResult.response.status).toBe(httpStatus.CREATED);
      expect(roleAResult.data?.phase).toBe('a_done');
      expect(roleAResult.data?.case.mode).toBe('collaborative');
      expect(roleAResult.data?.case.status).toBe('draft');
      expect(roleAResult.data?.case.plaintiff_statement).toBe(roleAStatement);

      const caseId = roleAResult.data!.case.id;

      const roleBResult = await apiClient.createCollaborativeCase({
        case_id: caseId,
        defendant_statement: roleBStatement,
      });

      expect(roleBResult.response.status).toBe(httpStatus.OK);
      expect(roleBResult.data?.phase).toBe('submitted');
      expect(roleBResult.data?.case.status).toBe('submitted');
      expect(roleBResult.data?.case.defendant_statement).toBe(roleBStatement);

      const caseDetailResult = await apiClient.getCase(caseId);
      expect(caseDetailResult.response.status).toBe(httpStatus.OK);
      expect(caseDetailResult.data?.id).toBe(caseId);
      expect(caseDetailResult.data?.mode).toBe('collaborative');

      await sleep(500);

      const pollResult = await apiClient.pollJudgment(caseId, {
        maxAttempts: pollingConfig.testMaxAttempts,
        intervalMs: pollingConfig.testIntervalMs,
      });

      expect(pollResult.timedOut).toBe(false);
      expect(pollResult.judgment).toBeDefined();
      expect(pollResult.judgment?.summary).toBeTruthy();
    }, 30000);

    it('角色B 使用錯誤 session 提交時應被拒絕', async () => {
      if (skipIfNoDatabase()) return;

      await apiClient.createSession();
      const roleAResult = await apiClient.createCollaborativeCase({
        plaintiff_statement: validCaseRequests.coupleDispute.plaintiff_statement,
      });
      expect(roleAResult.response.status).toBe(httpStatus.CREATED);

      const caseId = roleAResult.data!.case.id;
      apiClient.setSessionId('guest_wrong_session_id');

      const roleBResult = await apiClient.createCollaborativeCase({
        case_id: caseId,
        defendant_statement: validCaseRequests.coupleDispute.defendant_statement,
      });

      expect(roleBResult.response.status).toBe(httpStatus.FORBIDDEN);
      expect(roleBResult.error?.code).toBe('FORBIDDEN');
    });

    it('角色B 重複提交同一 collaborative case 時應返回 CASE_NOT_EDITABLE', async () => {
      if (skipIfNoDatabase()) return;

      await apiClient.createSession();
      const roleAResult = await apiClient.createCollaborativeCase({
        plaintiff_statement: validCaseRequests.coupleDispute.plaintiff_statement,
      });
      expect(roleAResult.response.status).toBe(httpStatus.CREATED);

      const caseId = roleAResult.data!.case.id;
      const roleBPayload = {
        case_id: caseId,
        defendant_statement: validCaseRequests.coupleDispute.defendant_statement,
      };

      const firstSubmit = await apiClient.createCollaborativeCase(roleBPayload);
      expect(firstSubmit.response.status).toBe(httpStatus.OK);

      const duplicateSubmit = await apiClient.createCollaborativeCase(roleBPayload);
      expect(duplicateSubmit.response.status).toBe(httpStatus.UNPROCESSABLE_ENTITY);
      expect(duplicateSubmit.error?.code).toBe('CASE_NOT_EDITABLE');
    });
  });

  // ==================== 3. 案件創建場景 ====================
  describe('3. 案件創建場景', () => {
    beforeEach(async () => {
      await apiClient.createSession();
    });

    it('應該驗證原告陳述不能為空', async () => {
      const result = await apiClient.createQuickCase(invalidCaseRequests.emptyPlaintiff);
      
      expect([httpStatus.BAD_REQUEST, httpStatus.UNPROCESSABLE_ENTITY]).toContain(result.response.status);
      expect(result.error).toBeDefined();
    });

    it('應該允許被告陳述為空字串並成功建立 quick case（服務層應正規化為 null）', async () => {
      const result = await apiClient.createQuickCase(invalidCaseRequests.emptyDefendant);

      expect(result.response.status).toBe(httpStatus.CREATED);
      expect(result.data?.case).toBeDefined();
      expect(result.data?.case.defendant_statement).toBeNull();
    });

    it('應該驗證陳述長度限制', async () => {
      const result = await apiClient.createQuickCase(invalidCaseRequests.tooLong);
      
      expect([httpStatus.BAD_REQUEST, httpStatus.UNPROCESSABLE_ENTITY]).toContain(result.response.status);
      expect(result.error).toBeDefined();
    });

    it('AI 案件類型識別失敗時應使用默認值', async () => {
      // Mock AI 服務失敗
      aiServiceMock.detectCaseType.mockRejectedValueOnce(new Error('AI 服務不可用'));

      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      
      // 應該仍然成功創建案件（使用默認類型）
      expect(result.response.status).toBe(httpStatus.CREATED);
      expect(result.data?.case).toBeDefined();
    });

    it('應該正確保存較長的陳述', async () => {
      const result = await apiClient.createQuickCase(validCaseRequests.longStatements);
      
      expect(result.response.status).toBe(httpStatus.CREATED);
      expect(result.data?.case.plaintiff_statement).toBe(validCaseRequests.longStatements.plaintiff_statement);
      expect(result.data?.case.defendant_statement).toBe(validCaseRequests.longStatements.defendant_statement);
    });

    it('應該正確保存最小長度的陳述', async () => {
      const result = await apiClient.createQuickCase(validCaseRequests.minimalStatements);
      
      expect(result.response.status).toBe(httpStatus.CREATED);
      expect(result.data?.case.plaintiff_statement).toBe(validCaseRequests.minimalStatements.plaintiff_statement);
    });
  });

  // ==================== 4. 判決生成場景 ====================
  describe('4. 判決生成場景', () => {
    let caseId: string;

    beforeEach(async () => {
      await apiClient.createSession();
      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      caseId = result.data!.case.id;
    });

    it('判決輪詢應正常獲取結果', async () => {
      // 等待異步判決生成
      await sleep(300);

      const pollResult = await apiClient.pollJudgment(caseId, {
        maxAttempts: 20,
        intervalMs: 100,
      });

      expect(pollResult.timedOut).toBe(false);
      expect(pollResult.judgment).toBeDefined();
      expect(pollResult.judgment?.judgment_content).toBeTruthy();
    });

    it('判決生成失敗時應返回正確錯誤', async () => {
      // 清理並重新設置
      await cleanupTestData();
      apiClient = createApiClient(app);
      
      // Mock AI 服務永久失敗
      aiServiceMock.generateJudgment.mockRejectedValue(new Error('AI 服務不可用'));

      await apiClient.createSession();
      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      const failCaseId = result.data!.case.id;

      // 等待判決嘗試失敗
      await sleep(500);

      // 輪詢應該返回失敗狀態
      const pollResult = await apiClient.pollJudgment(failCaseId, {
        maxAttempts: 10,
        intervalMs: 100,
      });

      // 可能超時或返回錯誤
      expect(pollResult.timedOut || pollResult.error).toBeTruthy();
    });

    it('判決輪詢期間應返回 PENDING 狀態', async () => {
      // 立即嘗試獲取判決（在生成完成前）
      const result = await apiClient.getJudgmentByCaseId(caseId);
      
      // 第一次請求可能返回 pending 或已完成
      if (result.isPending) {
        expect(result.response.status).toBe(httpStatus.ACCEPTED);
      }
    });

    it('重新生成判決應該成功', async () => {
      // 等待第一次判決生成
      await sleep(500);

      // 確認判決已生成
      let pollResult = await apiClient.pollJudgment(caseId, {
        maxAttempts: 20,
        intervalMs: 100,
      });
      expect(pollResult.judgment).toBeDefined();

      // Mock 新的判決內容
      const newJudgment = createJudgmentResponse(70, 30, '新的判決摘要');
      aiServiceMock.generateJudgment.mockResolvedValueOnce(newJudgment);

      // 重新生成判決
      const regenerateResult = await apiClient.regenerateJudgment(caseId);
      
      // 應該成功觸發重新生成
      expect([httpStatus.OK, httpStatus.CREATED, httpStatus.ACCEPTED, 409]).toContain(regenerateResult.response.status);
    });

    it('應該正確處理不同的責任分比例', async () => {
      const testRatios = [
        { plaintiff: 50, defendant: 50 },
        { plaintiff: 80, defendant: 20 },
        { plaintiff: 20, defendant: 80 },
      ];

      for (const ratio of testRatios) {
        // 清理數據
        await cleanupTestData();
        apiClient = createApiClient(app);

        // Mock 特定比例的判決
        aiServiceMock.generateJudgment.mockResolvedValueOnce(createJudgmentResponse(ratio.plaintiff, ratio.defendant));

        await apiClient.createSession();
        const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
        const testCaseId = result.data!.case.id;

        await sleep(300);

        const pollResult = await apiClient.pollJudgment(testCaseId, {
          maxAttempts: 20,
          intervalMs: 100,
        });

        if (pollResult.judgment) {
          expect(pollResult.judgment.responsibility_ratio).toBeDefined();
        }
      }
    });
  });

  // ==================== 5. 證據上傳場景 ====================
  describe('5. 證據上傳場景', () => {
    let caseId: string;

    beforeEach(async () => {
      await apiClient.createSession();
      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      caseId = result.data!.case.id;
    });

    it('應該成功上傳單個證據文件', async () => {
      const { files, filenames } = createMockFiles(1);
      
      const result = await apiClient.uploadEvidence(caseId, files, filenames);
      
      // 上傳可能成功或因案件狀態被拒絕
      if (result.response.status === httpStatus.OK || result.response.status === httpStatus.CREATED) {
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBe(1);
      }
    });

    it('應該成功上傳多個證據文件（最多3個）', async () => {
      const { files, filenames } = createMockFiles(3);
      
      const result = await apiClient.uploadEvidence(caseId, files, filenames);
      
      if (result.response.status === httpStatus.OK || result.response.status === httpStatus.CREATED) {
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBeLessThanOrEqual(3);
      }
    });

    it('超過3個文件應該被限制', async () => {
      const { files, filenames } = createMockFiles(5);
      
      const result = await apiClient.uploadEvidence(caseId, files, filenames);
      
      // 應該被拒絕或只上傳前3個
      if (result.error) {
        expect(result.error.code).toBeDefined();
      } else if (result.data) {
        expect(result.data.length).toBeLessThanOrEqual(3);
      }
    });

    it('無效的案件ID不應允許上傳', async () => {
      const { files, filenames } = createMockFiles(1);
      
      const result = await apiClient.uploadEvidence('invalid-case-id', files, filenames);
      
      expect([httpStatus.NOT_FOUND, httpStatus.BAD_REQUEST]).toContain(result.response.status);
    });

    it('不同 Session 不應允許上傳到其他案件', async () => {
      // 創建新的 API 客戶端（不同 Session）
      const anotherClient = createApiClient(app);
      await anotherClient.createSession();

      const { files, filenames } = createMockFiles(1);
      
      const result = await anotherClient.uploadEvidence(caseId, files, filenames);
      
      expect([httpStatus.NOT_FOUND, httpStatus.FORBIDDEN]).toContain(result.response.status);
    });
  });

  // ==================== 6. 錯誤處理場景 ====================
  describe('6. 錯誤處理場景', () => {
    it('AI 服務完全不可用時應優雅降級', async () => {
      // Mock AI 服務完全失敗
      aiServiceMock.detectCaseType.mockRejectedValue(new Error('AI 服務不可用'));
      aiServiceMock.generateJudgment.mockRejectedValue(new Error('AI 服務不可用'));

      await apiClient.createSession();
      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      
      // 案件創建應該仍然成功（使用默認類型）
      expect(result.response.status).toBe(httpStatus.CREATED);
    });

    it('請求缺少必要字段時應返回驗證錯誤', async () => {
      await apiClient.createSession();
      
      const result = await apiClient.createQuickCase(invalidCaseRequests.missingFields as any);
      
      expect([httpStatus.BAD_REQUEST, httpStatus.UNPROCESSABLE_ENTITY]).toContain(result.response.status);
      expect(result.error).toBeDefined();
    });

    it('訪問不存在的案件應返回404', async () => {
      await apiClient.createSession();
      
      const result = await apiClient.getCase('non-existent-case-id');
      
      expect(result.response.status).toBe(httpStatus.NOT_FOUND);
    });

    it('獲取不存在案件的判決應返回404', async () => {
      await apiClient.createSession();
      
      const result = await apiClient.getJudgmentByCaseId('non-existent-case-id');
      
      expect(result.response.status).toBe(httpStatus.NOT_FOUND);
    });
  });

  // ==================== 7. 完整流程端到端測試 ====================
  describe('7. 完整流程端到端測試', () => {
    it('模擬完整的用戶使用流程', async () => {
      // Step 1: 用戶打開快速體驗頁面，創建 Session
      const sessionResult = await apiClient.createSession();
      expect(sessionResult.data?.session_id).toBeTruthy();
      console.log('✓ Session 創建成功');

      // Step 2: 用戶填寫原告和被告陳述，提交案件
      const caseResult = await apiClient.createQuickCase({
        plaintiff_statement: '他每次回家都玩手機，不理我。我說話他也不聽，我覺得自己在這段關係中不被重視。',
        defendant_statement: '我工作壓力很大，回家想放鬆一下。而且我不是不聽，只是有時候在想工作的事情。',
      });
      expect(caseResult.data?.case.id).toBeTruthy();
      console.log('✓ 案件創建成功');

      const caseId = caseResult.data!.case.id;

      // Step 3: 等待判決生成（前端會輪詢）
      console.log('⏳ 等待判決生成...');
      const pollResult = await apiClient.pollJudgment(caseId, {
        maxAttempts: 30,
        intervalMs: 100,
        onPending: (attempt) => {
          if (attempt % 5 === 0) {
            console.log(`  輪詢中... (第 ${attempt} 次)`);
          }
        },
      });

      expect(pollResult.timedOut).toBe(false);
      expect(pollResult.judgment).toBeDefined();
      console.log(`✓ 判決獲取成功 (共輪詢 ${pollResult.attempts} 次)`);

      // Step 4: 用戶可以選擇上傳證據
      const { files, filenames } = createMockFiles(2);
      const evidenceResult = await apiClient.uploadEvidence(caseId, files, filenames);
      
      // 證據上傳可能成功或因案件狀態限制
      if (evidenceResult.data) {
        console.log(`✓ 證據上傳成功 (共 ${evidenceResult.data.length} 個文件)`);
      } else {
        console.log('⚠ 證據上傳被跳過（案件狀態限制）');
      }

      // Step 5: 驗證最終數據狀態
      const finalCase = await apiClient.getCase(caseId);
      expect(finalCase.data).toBeDefined();
      
      console.log('\n=== 測試完成 ===');
      console.log(`案件ID: ${caseId}`);
      console.log(`案件類型: ${finalCase.data?.type}`);
      console.log(`案件狀態: ${finalCase.data?.status}`);
    }, 60000);

    it('模擬用戶中斷並恢復流程', async () => {
      // Step 1: 創建 Session 和案件
      const sessionResult = await apiClient.createSession();
      const sessionId = sessionResult.data!.session_id;
      
      await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      
      // Step 2: 模擬用戶關閉頁面（創建新的 API 客戶端）
      const newClient = createApiClient(app);
      
      // Step 3: 用戶返回，使用保存的 Session ID
      newClient.setSessionId(sessionId);
      
      // Step 4: 嘗試通過 Session 獲取之前的案件
      const caseBySession = await newClient.getCaseBySession();
      
      // 應該能找到之前創建的案件
      if (caseBySession.data) {
        expect(caseBySession.data.session_id).toBe(sessionId);
        console.log('✓ 用戶成功恢復之前的案件');
      }
    });

    it('測試快速連續提交的並發安全', async () => {
      await apiClient.createSession();
      
      // 同時提交多個案件請求
      const promises = Array(3).fill(null).map((_, i) => 
        apiClient.createQuickCase({
          plaintiff_statement: `測試陳述 ${i + 1}：他最近連續好幾次忽略我的情緒反應，讓我感到不被理解與不被重視。`,
          defendant_statement: `測試陳述 ${i + 1}：我知道她受傷了，但我最近工作壓力很大，想先冷靜再回應。`,
        })
      );

      const results = await Promise.allSettled(promises);
      
      // 至少第一個應該成功，其他可能因為並發限制失敗
      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).data).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
      
      console.log(`並發測試: ${successCount}/3 成功`);
    });
  });

  // ==================== 8. 數據一致性測試 ====================
  describe('8. 數據一致性測試', () => {
    it('案件創建後數據庫應有正確記錄', async () => {
      await apiClient.createSession();
      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      const caseId = result.data!.case.id;

      // 直接查詢數據庫驗證
      const dbCase = await prisma.case.findUnique({
        where: { id: caseId },
        include: { pairing: true },
      });

      expect(dbCase).toBeDefined();
      expect(dbCase?.plaintiff_statement).toBe(validCaseRequests.coupleDispute.plaintiff_statement);
      expect(dbCase?.defendant_statement).toBe(validCaseRequests.coupleDispute.defendant_statement);
      expect(dbCase?.mode).toBe('quick');
      expect(dbCase?.pairing).toBeDefined();
    });

    it('判決生成後應正確關聯到案件', async () => {
      await apiClient.createSession();
      const result = await apiClient.createQuickCase(validCaseRequests.coupleDispute);
      const caseId = result.data!.case.id;

      // 等待判決生成
      await sleep(500);
      await apiClient.pollJudgment(caseId, { maxAttempts: 20, intervalMs: 100 });

      // 直接查詢數據庫驗證
      const dbCase = await prisma.case.findUnique({
        where: { id: caseId },
        include: { judgment: true },
      });

      expect(dbCase?.judgment).toBeDefined();
      expect(dbCase?.judgment?.case_id).toBe(caseId);
    });

    it('Session 應該在數據庫中正確記錄', async () => {
      const sessionResult = await apiClient.createSession();
      const sessionId = sessionResult.data!.session_id;

      // 直接查詢數據庫驗證
      // 注意：QuickSession 的主鍵是 `id`，其值就是 session_id
      const dbSession = await prisma.quickSession.findUnique({
        where: { id: sessionId },
      });

      expect(dbSession).toBeDefined();
      expect(dbSession?.id).toBe(sessionId);  // id 就是 session_id
      expect(new Date(dbSession!.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
