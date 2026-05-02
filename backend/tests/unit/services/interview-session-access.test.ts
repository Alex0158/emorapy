import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: {
      findFirst: jest.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import {
  ensureInterviewSessionAccess,
  loadOwnedInterviewSession,
} from '../../../src/services/interview-session-access';

describe('interview-session-access', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loadOwnedInterviewSession 應返回當前用戶可訪問的 session 並按 turn_order 正序讀 turns', async () => {
    const session = {
      id: 's1',
      user_id: 'u1',
      turns: [{ id: 't1', turn_order: 1 }],
    };
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(session);

    await expect(loadOwnedInterviewSession('s1', 'u1')).resolves.toBe(session);

    expect(mockedPrisma.interviewSession.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', user_id: 'u1' },
      include: { turns: { orderBy: { turn_order: 'asc' } } },
    });
  });

  it('loadOwnedInterviewSession session 不存在或無權限時應拋 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(null);

    await expect(loadOwnedInterviewSession('s1', 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: '訪談不存在或無權限',
    });
  });

  it('ensureInterviewSessionAccess 應用輕量查詢確認 session 歸屬', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue({ id: 's1' });

    await expect(ensureInterviewSessionAccess('s1', 'u1')).resolves.toBeUndefined();

    expect(mockedPrisma.interviewSession.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', user_id: 'u1' },
      select: { id: true },
    });
  });

  it('ensureInterviewSessionAccess session 不存在或無權限時應拋 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(null);

    await expect(ensureInterviewSessionAccess('s1', 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: '訪談不存在或無權限',
    });
  });
});
