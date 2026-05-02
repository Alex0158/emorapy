import { INTERVIEW_STATUS } from '../utils/constants';

const SUBSTANTIVE_SESSION_MIN_TURNS = 3;

export type InterviewStartTrigger = 'organic' | 'pre_case' | 'post_judgment' | 'onboarding';

export interface InterviewStartRateLimitWindow {
  todayStart: Date;
  oneHourAgo: Date;
  queryStart: string;
}

export interface RecentInterviewSessionForStartLimit {
  created_at: Date | string;
  _count: { turns: number };
}

export interface InterviewStartLimits {
  dailySessionLimit: number;
  startRateLimit: number;
}

export interface PreviousInterviewSessionForStart {
  id: string;
  turns: unknown[];
}

export type PreviousInterviewSessionDisposition =
  | {
      sessionId: string;
      status: typeof INTERVIEW_STATUS.PROCESSING;
      shouldProcess: true;
    }
  | {
      sessionId: string;
      status: typeof INTERVIEW_STATUS.ABANDONED;
      shouldProcess: false;
    }
  | null;

export function buildInterviewStartRateLimitWindow(now = new Date()): InterviewStartRateLimitWindow {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const todayStartIso = todayStart.toISOString();
  const oneHourAgoIso = oneHourAgo.toISOString();
  return {
    todayStart,
    oneHourAgo,
    queryStart: oneHourAgoIso < todayStartIso ? oneHourAgoIso : todayStartIso,
  };
}

export function getInterviewStartRateLimitViolation(
  recentSessions: RecentInterviewSessionForStartLimit[],
  limits: InterviewStartLimits,
  window: InterviewStartRateLimitWindow
): string | null {
  const substantive = recentSessions.filter((session) => session._count.turns >= SUBSTANTIVE_SESSION_MIN_TURNS);
  const dailyCount = substantive.filter((session) => new Date(session.created_at) >= window.todayStart).length;
  if (dailyCount >= limits.dailySessionLimit) {
    return '今日開始訪談次數已達上限';
  }

  const hourlyCount = substantive.filter((session) => new Date(session.created_at) >= window.oneHourAgo).length;
  if (hourlyCount >= limits.startRateLimit) {
    return '每小時開始訪談次數已達上限，請稍後再試';
  }

  return null;
}

export function getPreviousInterviewSessionDisposition(
  inProgress: PreviousInterviewSessionForStart | null,
  minTurnsForPipeline: number
): PreviousInterviewSessionDisposition {
  if (!inProgress) return null;
  if (inProgress.turns.length >= minTurnsForPipeline) {
    return {
      sessionId: inProgress.id,
      status: INTERVIEW_STATUS.PROCESSING,
      shouldProcess: true,
    };
  }
  return {
    sessionId: inProgress.id,
    status: INTERVIEW_STATUS.ABANDONED,
    shouldProcess: false,
  };
}
