import { PsychDomain } from '@prisma/client';
import prisma from '../config/database';
import type { InterviewAIResponse } from '../types/interview.types';
import {
  buildInterviewSessionUpdateData,
  buildInterviewTurnCreateData,
} from './interview-response-utils';

export interface PersistInterviewAIResponseParams {
  sessionId: string;
  nextOrder: number;
  text: string;
  parsedMeta: Partial<InterviewAIResponse>;
  targetDomains: PsychDomain[];
  fallbackDomains: PsychDomain[];
  newFacts: string[];
  newDomains: PsychDomain[];
  aiWordCount: number;
  updatedCollectedFacts: string[];
}

export interface PersistInterviewAIResponseResult {
  createdTurn: { id: string };
}

export async function persistInterviewAIResponse({
  sessionId,
  nextOrder,
  text,
  parsedMeta,
  targetDomains,
  fallbackDomains,
  newFacts,
  newDomains,
  aiWordCount,
  updatedCollectedFacts,
}: PersistInterviewAIResponseParams): Promise<PersistInterviewAIResponseResult> {
  const createdTurn = await prisma.interviewTurn.create({
    data: buildInterviewTurnCreateData({
      sessionId,
      nextOrder,
      text,
      parsedMeta,
      targetDomains,
      fallbackDomains,
      newFacts,
    }),
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: buildInterviewSessionUpdateData({
      newDomains,
      aiWordCount,
      newFacts,
      updatedCollectedFacts,
    }),
  });

  return { createdTurn };
}
