import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { INTERVIEW_STATUS } from '../utils/constants';
import {
  buildInterviewStartRateLimitWindow,
  getInterviewStartRateLimitViolation,
  type PreviousInterviewSessionForStart,
} from './interview-start-session-utils';
import {
  loadRuntimeInterviewConfig,
  type RuntimeInterviewConfig,
} from './interview-runtime-config';
import { getPsychInterviewStartPolicy } from '../utils/product-safety-policy';

export interface ValidatedInterviewStartContext {
  runtimeConfig: RuntimeInterviewConfig;
  inProgress: PreviousInterviewSessionForStart | null;
}

export async function loadValidatedInterviewStartContext(
  userId: string
): Promise<ValidatedInterviewStartContext> {
  const runtimeConfig = await loadRuntimeInterviewConfig();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { psych_consent_given: true, age: true },
  });
  if (!user?.psych_consent_given) {
    throw Errors.CONSENT_REQUIRED();
  }
  const interviewPolicy = getPsychInterviewStartPolicy({ age: user.age });
  if (!interviewPolicy.canStartInterview) {
    throw Errors.FORBIDDEN(interviewPolicy.rejectionMessage ?? '目前不可開始心理訪談');
  }

  const startLimitWindow = buildInterviewStartRateLimitWindow();
  const recentSessions = await prisma.interviewSession.findMany({
    where: {
      user_id: userId,
      created_at: { gte: startLimitWindow.queryStart },
      status: { notIn: [INTERVIEW_STATUS.ABANDONED] },
    },
    include: { _count: { select: { turns: true } } },
  });
  const rateLimitViolation = getInterviewStartRateLimitViolation(
    recentSessions,
    runtimeConfig,
    startLimitWindow
  );
  if (rateLimitViolation) {
    throw Errors.RATE_LIMIT_EXCEEDED(rateLimitViolation);
  }

  const inProgress = await prisma.interviewSession.findFirst({
    where: { user_id: userId, status: INTERVIEW_STATUS.IN_PROGRESS },
    include: { turns: true },
  });

  return { runtimeConfig, inProgress };
}
