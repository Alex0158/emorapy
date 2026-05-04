/**
 * cleanup.job 單元測試（mock cron、sessionService、aiService、prisma、env、fs）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockExecute = jest.fn();
const scheduleReturn = { start: mockStart, stop: mockStop, execute: mockExecute };
/** 依註冊順序：cleanupExpiredSessions, cleanupOrphanUploads, cleanupTempPairings, cleanupAbandonedInterviewSessions, cleanupExpiredVerifications, resetAIDailyCount, followUp7Day, followUp30Day, cleanupStaleDraftCases, cleanupStuckProcessingSessions */
const scheduledCallbacks: Array<() => void | Promise<void>> = [];

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    createTask: jest.fn((_expr: string, callback: () => void | Promise<void>) => {
      scheduledCallbacks.push(callback);
      return scheduleReturn;
    }),
  },
}));

const mockCleanupExpiredSessions = jest.fn();
jest.mock('../../../src/services/session.service', () => ({
  __esModule: true,
  sessionService: { cleanupExpiredSessions: (...args: unknown[]) => mockCleanupExpiredSessions(...args) },
}));

const mockResetDailyCallCount = jest.fn();
jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: { resetDailyCallCount: (...args: unknown[]) => mockResetDailyCallCount(...args) },
}));

const mockEvidenceFindMany = jest.fn();
const mockPairingDeleteMany = jest.fn();
const mockEmailVerificationDeleteMany = jest.fn();
const mockCaseFindMany = jest.fn();
const mockCaseUpdateMany = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationCreateMany = jest.fn();
jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    evidence: { findMany: (...args: unknown[]) => mockEvidenceFindMany(...args) },
    pairing: { deleteMany: (...args: unknown[]) => mockPairingDeleteMany(...args) },
    emailVerification: { deleteMany: (...args: unknown[]) => mockEmailVerificationDeleteMany(...args) },
    case: {
      findMany: (...args: unknown[]) => mockCaseFindMany(...args),
      updateMany: (...args: unknown[]) => mockCaseUpdateMany(...args),
    },
    notification: {
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
      createMany: (...args: unknown[]) => mockNotificationCreateMany(...args),
    },
  },
}));

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({ __esModule: true, default: mockLogger }));

const mockEnvRef = { NODE_ENV: 'test', UPLOAD_DIR: 'uploads' };
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef;
  },
}));

const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockUnlink = jest.fn();
jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    stat: (...args: unknown[]) => mockStat(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}));

import {
  adminJobs,
  runAdminJobNow,
  startJobs,
  stopJobs,
  jobsStarted,
} from '../../../src/jobs/cleanup.job';

describe('cleanup.job', () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvRef.NODE_ENV = 'test';
    process.env = { ...origEnv };
    (scheduleReturn as any).start = mockStart;
    (scheduleReturn as any).stop = mockStop;
    (scheduleReturn as any).execute = mockExecute;
    (mockPairingDeleteMany as any).mockResolvedValue({ count: 0 });
    (mockEmailVerificationDeleteMany as any).mockResolvedValue({ count: 0 });
    (mockCaseFindMany as any).mockResolvedValue([]);
    (mockCaseUpdateMany as any).mockResolvedValue({ count: 0 });
    (mockNotificationFindMany as any).mockResolvedValue([]);
    (mockNotificationCreateMany as any).mockResolvedValue({ count: 0 });
  });

  describe('startJobs', () => {
    it('測試環境且未設 SKIP_DB_INIT=false 時應跳過啟動並記錄', () => {
      process.env.SKIP_DB_INIT = 'true';
      process.env.ENABLE_SCHEDULED_JOBS = 'true';
      startJobs();
      expect(mockStart).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('跳過定時任務：測試環境且已跳過DB初始化');
    });

    it('ENABLE_SCHEDULED_JOBS=false 時應不啟動並記錄', () => {
      process.env.SKIP_DB_INIT = 'false';
      process.env.ENABLE_SCHEDULED_JOBS = 'false';
      mockEnvRef.NODE_ENV = 'production';
      startJobs();
      expect(mockStart).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled jobs are disabled', expect.any(Object));
    });

    it('測試環境 SKIP_DB_INIT=false 且 ENABLE_SCHEDULED_JOBS=true 時應啟動所有任務', () => {
      process.env.SKIP_DB_INIT = 'false';
      process.env.ENABLE_SCHEDULED_JOBS = 'true';
      mockEnvRef.NODE_ENV = 'test';
      startJobs();
      expect(mockStart).toHaveBeenCalledTimes(adminJobs.length);
      expect(jobsStarted).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled jobs started', expect.objectContaining({ env: 'test' }));
    });
  });

  describe('stopJobs', () => {
    it('應停止所有任務並設置 jobsStarted 為 false', () => {
      process.env.SKIP_DB_INIT = 'false';
      process.env.ENABLE_SCHEDULED_JOBS = 'true';
      startJobs();
      expect(mockStart).toHaveBeenCalled();
      stopJobs();
      expect(mockStop).toHaveBeenCalledTimes(adminJobs.length);
      expect(jobsStarted).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled jobs stopped');
    });
  });

  describe('runAdminJobNow', () => {
    it('應使用 node-cron v4 execute 立即觸發指定任務', async () => {
      (mockExecute as any).mockResolvedValue(undefined);
      const result = await runAdminJobNow('cleanup_expired_sessions', 'admin-1');
      expect(result).toEqual({ accepted: true, mode: 'immediate' });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('未知任務應回傳不接受', async () => {
      const result = await runAdminJobNow('missing_job');
      expect(result).toEqual({ accepted: false, mode: 'unknown' });
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('cron callbacks', () => {
    beforeEach(() => {
      (mockPairingDeleteMany as any).mockResolvedValue({ count: 0 });
      (mockEmailVerificationDeleteMany as any).mockResolvedValue({ count: 0 });
      (mockCaseFindMany as any).mockResolvedValue([]);
      (mockCaseUpdateMany as any).mockResolvedValue({ count: 0 });
      (mockNotificationFindMany as any).mockResolvedValue([]);
      (mockNotificationCreateMany as any).mockResolvedValue({ count: 0 });
    });

    it('cleanupExpiredSessions 成功時依環境記錄 debug 或 info', async () => {
      (mockCleanupExpiredSessions as any).mockResolvedValue(5);
      mockEnvRef.NODE_ENV = 'development';
      await scheduledCallbacks[0]();
      expect(mockCleanupExpiredSessions).toHaveBeenCalledWith(1000);
      expect(mockLogger.debug).toHaveBeenCalledWith('Expired sessions cleaned up', { count: 5 });
      mockEnvRef.NODE_ENV = 'production';
      jest.clearAllMocks();
      (mockCleanupExpiredSessions as any).mockResolvedValue(3);
      await scheduledCallbacks[0]();
      expect(mockLogger.info).toHaveBeenCalledWith('Expired sessions cleaned up', { count: 3 });
    });

    it('cleanupExpiredSessions 失敗時記錄 error', async () => {
      (mockCleanupExpiredSessions as any).mockRejectedValue(new Error('db error'));
      await scheduledCallbacks[0]();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup expired sessions', expect.objectContaining({ error: expect.any(Error) }));
    });

    it('cleanupOrphanUploads 無文件時提早 return', async () => {
      (mockReaddir as any).mockResolvedValue([]);
      await scheduledCallbacks[1]();
      expect(mockEvidenceFindMany).not.toHaveBeenCalled();
    });

    it('cleanupOrphanUploads 刪除未在 evidence 中的文件並記錄', async () => {
      (mockReaddir as any).mockResolvedValue(['orphan.txt']);
      (mockStat as any).mockResolvedValue({ isFile: () => true });
      (mockEvidenceFindMany as any).mockResolvedValue([{ file_url: 'https://x.com/other.pdf' }]);
      (mockUnlink as any).mockResolvedValue(undefined);
      await scheduledCallbacks[1]();
      expect(mockUnlink).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Orphan uploads cleaned', { removed: 1 });
    });

    it('cleanupOrphanUploads 跳過目錄與已使用文件', async () => {
      (mockReaddir as any).mockResolvedValue(['used.pdf', 'subdir']);
      (mockStat as any).mockResolvedValueOnce({ isFile: () => true }).mockResolvedValueOnce({ isFile: () => false });
      (mockEvidenceFindMany as any).mockResolvedValue([{ file_url: 'https://x.com/used.pdf' }]);
      await scheduledCallbacks[1]();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('cleanupOrphanUploads 失敗時記錄 error', async () => {
      (mockReaddir as any).mockResolvedValue(['f1']);
      (mockEvidenceFindMany as any).mockRejectedValue(new Error('db failed'));
      await scheduledCallbacks[1]();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup orphan uploads', expect.any(Object));
    });

    it('cleanupTempPairings 有刪除時記錄 info', async () => {
      (mockPairingDeleteMany as any).mockResolvedValue({ count: 3 });
      await scheduledCallbacks[2]();
      expect(mockPairingDeleteMany).toHaveBeenCalledWith({
        where: {
          pairing_type: 'quick',
          status: 'temp',
          created_at: { lt: expect.any(Date) },
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Temp pairings cleaned', { count: 3 });
    });

    it('cleanupTempPairings 失敗時記錄 error', async () => {
      (mockPairingDeleteMany as any).mockRejectedValue(new Error('db error'));
      await scheduledCallbacks[2]();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup temp pairings', expect.any(Object));
    });

    it('cleanupExpiredVerifications 依環境記錄 debug 或 info', async () => {
      (mockEmailVerificationDeleteMany as any).mockResolvedValue({ count: 2 });
      mockEnvRef.NODE_ENV = 'development';
      await scheduledCallbacks[4]();
      expect(mockLogger.debug).toHaveBeenCalledWith('Expired verifications cleaned up', { count: 2 });
      jest.clearAllMocks();
      mockEnvRef.NODE_ENV = 'production';
      (mockEmailVerificationDeleteMany as any).mockResolvedValue({ count: 1 });
      await scheduledCallbacks[4]();
      expect(mockLogger.info).toHaveBeenCalledWith('Expired verifications cleaned up', { count: 1 });
    });

    it('cleanupExpiredVerifications 失敗時記錄 error', async () => {
      (mockEmailVerificationDeleteMany as any).mockRejectedValue(new Error('db error'));
      await scheduledCallbacks[4]();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup expired verifications', expect.any(Object));
    });

    it('resetAIDailyCount 成功時記錄 info', async () => {
      (mockResetDailyCallCount as any).mockResolvedValue(undefined);
      mockEnvRef.NODE_ENV = 'production';
      await scheduledCallbacks[5]();
      expect(mockResetDailyCallCount).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('AI service daily call count reset');
    });

    it('resetAIDailyCount 在 development 時記錄 debug', async () => {
      (mockResetDailyCallCount as any).mockResolvedValue(undefined);
      mockEnvRef.NODE_ENV = 'development';
      await scheduledCallbacks[5]();
      expect(mockLogger.debug).toHaveBeenCalledWith('AI service daily call count reset');
    });

    it('resetAIDailyCount 失敗時 catch 並記錄 error', async () => {
      (mockResetDailyCallCount as any).mockRejectedValue(new Error('reset failed'));
      await scheduledCallbacks[5]();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to reset AI daily count', expect.objectContaining({ error: expect.any(Error) }));
    });

    it('followUp7Day 應掃 user-bound product case，並帶 product_flow payload', async () => {
      const completedAt = new Date(Date.now() - 49 * 60 * 60 * 1000);
      (mockCaseFindMany as any).mockResolvedValue([
        {
          id: 'case-1',
          title: '正式協作案件',
          mode: 'collaborative',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
          plaintiff: { notification_enabled: true },
          defendant: { notification_enabled: false },
          judgment: { id: 'judgment-1' },
          chat_to_case_links: [{ id: 'link-1' }],
          completed_at: completedAt,
        },
      ]);
      (mockNotificationFindMany as any).mockResolvedValue([]);
      (mockNotificationCreateMany as any).mockResolvedValue({ count: 1 });

      await scheduledCallbacks[6]();

      expect(mockCaseFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          status: 'completed',
          OR: [
            { chat_to_case_links: { some: {} } },
            { chat_to_case_links: { none: {} }, mode: 'remote' },
            { chat_to_case_links: { none: {} }, mode: 'collaborative', session_id: null },
          ],
          judgment: {
            reconciliation_plans: { none: {} },
          },
        }),
        include: expect.objectContaining({
          chat_to_case_links: { select: { id: true }, take: 1 },
        }),
      }));
      expect(mockNotificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            user_id: 'u1',
            payload: expect.objectContaining({
              case_id: 'case-1',
              judgment_id: 'judgment-1',
              product_flow: 'chat_to_case',
            }),
          }),
        ],
        skipDuplicates: true,
      });
    });

    it('cleanupStaleDraftCases 應清理 user-bound formal draft，排除 quick/session-bound/chat-to-case', async () => {
      (mockCaseUpdateMany as any).mockResolvedValue({ count: 2 });

      await scheduledCallbacks[8]();

      expect(mockCaseUpdateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'draft',
          OR: [
            { mode: 'remote' },
            { mode: 'collaborative', session_id: null },
          ],
          chat_to_case_links: { none: {} },
          defendant_statement: null,
          created_at: { lt: expect.any(Date) },
        }),
        data: { status: 'cancelled' },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Stale formal draft cases cancelled', { count: 2 });
    });
  });
});
