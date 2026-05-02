import prisma from '../config/database';
import { Errors } from '../utils/errors';

async function findOwnedInterviewSession(sessionId: string, userId: string) {
  return prisma.interviewSession.findFirst({
    where: { id: sessionId, user_id: userId },
    include: { turns: { orderBy: { turn_order: 'asc' } } },
  });
}

export type OwnedInterviewSession = NonNullable<
  Awaited<ReturnType<typeof findOwnedInterviewSession>>
>;

export async function loadOwnedInterviewSession(
  sessionId: string,
  userId: string
): Promise<OwnedInterviewSession> {
  const session = await findOwnedInterviewSession(sessionId, userId);
  if (!session) {
    throw Errors.NOT_FOUND('訪談不存在或無權限');
  }
  return session;
}

export async function ensureInterviewSessionAccess(
  sessionId: string,
  userId: string
): Promise<void> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, user_id: userId },
    select: { id: true },
  });
  if (!session) {
    throw Errors.NOT_FOUND('訪談不存在或無權限');
  }
}
