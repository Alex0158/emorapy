/**
 * cleanup.job 單元測試（mock cron、sessionService、aiService、prisma、env、fs）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockStart = jest.fn();
const mockStop = jest.fn();
const scheduleReturn = { start: mockStart, stop: mockStop };
/** 依註冊順序：cleanupExpiredSessions, cleanupOrphanUploads, cleanupTempPairings, cleanupAbandonedInterviewSessions, cleanupExpiredVerifications, resetAIDailyCount, followUp7Day, followUp30Day, cleanupStaleDraftCases, cleanupStuckProcessingSessions */
const scheduledCallbacks: Array<() => void | Promise<void>> = [];

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn((_expr: string, callback: () => void | Promise<void>) => {
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
jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    evidence: { findMany: (...args: unknown[]) => mockEvidenceFindMany(...args) },
    pairing: { deleteMany: (...args: unknown[]) => mockPairingDeleteMany(...args) },
    emailVerification: { deleteMany: (...args: unknown[]) => mockEmailVerificationDeleteMany(...args) },
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
    (mockPairingDeleteMany as any).mockResolvedValue({ count: 0 });
    (mockEmailVerificationDeleteMany as any).mockResolvedValue({ count: 0 });
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

  describe('cron callbacks', () => {
    beforeEach(() => {
      (mockPairingDeleteMany as any).mockResolvedValue({ count: 0 });
      (mockEmailVerificationDeleteMany as any).mockResolvedValue({ count: 0 });
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
  });
});
