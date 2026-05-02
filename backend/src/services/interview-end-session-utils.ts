import { INTERVIEW_STATUS } from '../utils/constants';

export interface InterviewEndSessionTurnForDecision {
  user_response?: string | null;
}

export type InterviewEndSessionInsufficientReason = 'turns' | 'chars';

export interface InterviewEndSessionDisposition {
  status: typeof INTERVIEW_STATUS.COMPLETED | typeof INTERVIEW_STATUS.PROCESSING;
  shouldProcess: boolean;
  turnCount: number;
  totalUserChars: number;
  insufficientReason?: InterviewEndSessionInsufficientReason;
}

export interface BuildInterviewEndSessionDispositionParams {
  turns: InterviewEndSessionTurnForDecision[];
  turnCount: number;
  minTurnsForPipeline: number;
  minUserContentChars: number;
}

export function countInterviewEndSessionUserChars(
  turns: InterviewEndSessionTurnForDecision[]
): number {
  return turns.reduce((sum, turn) => sum + (turn.user_response?.length ?? 0), 0);
}

export function buildInterviewEndSessionDisposition({
  turns,
  turnCount,
  minTurnsForPipeline,
  minUserContentChars,
}: BuildInterviewEndSessionDispositionParams): InterviewEndSessionDisposition {
  const totalUserChars = countInterviewEndSessionUserChars(turns);
  const insufficientTurns = turnCount < minTurnsForPipeline;
  const insufficientContent = totalUserChars < minUserContentChars;

  if (insufficientTurns || insufficientContent) {
    return {
      status: INTERVIEW_STATUS.COMPLETED,
      shouldProcess: false,
      turnCount,
      totalUserChars,
      insufficientReason: insufficientTurns ? 'turns' : 'chars',
    };
  }

  return {
    status: INTERVIEW_STATUS.PROCESSING,
    shouldProcess: true,
    turnCount,
    totalUserChars,
  };
}
