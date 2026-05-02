import prisma from '../config/database';
import {
  countInterviewWords,
  sanitizeInterviewUserResponse,
} from './interview-response-utils';

export interface PersistInterviewUserResponseParams {
  sessionId: string;
  lastTurnId: string;
  userResponse: string;
  isSkip: boolean;
}

export interface PersistedInterviewUserResponse {
  sanitizedResponse: string;
  wordCount: number;
}

export async function persistInterviewUserResponse({
  sessionId,
  lastTurnId,
  userResponse,
  isSkip,
}: PersistInterviewUserResponseParams): Promise<PersistedInterviewUserResponse> {
  const sanitizedResponse = sanitizeInterviewUserResponse(userResponse, isSkip);
  const wordCount = countInterviewWords(sanitizedResponse);

  await prisma.interviewTurn.update({
    where: { id: lastTurnId },
    data: {
      user_response: sanitizedResponse,
      response_word_count: wordCount,
      skipped: isSkip,
    },
  });

  if (wordCount > 0) {
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        total_user_words: { increment: wordCount },
      },
    });
  }

  return { sanitizedResponse, wordCount };
}
