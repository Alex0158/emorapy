import { PsychDomain } from '@prisma/client';

import {
  buildInterviewSystemPrompt,
  buildInterviewUserPrompt,
} from './interview-prompt-utils';
import {
  EMPTY_INTERVIEW_PREVIOUS_CONTEXT,
  loadInterviewPreviousContext,
} from './interview-previous-context-utils';
import type { RuntimeInterviewConfig } from './interview-runtime-config';
import type { InterviewTurnSession } from './interview-turn-context';
import {
  persistInterviewUserResponse,
  type PersistedInterviewUserResponse,
} from './interview-user-response-persistence';

export interface PrepareInterviewResponseContextParams {
  sessionId: string;
  userId: string;
  userResponse: string;
  isSkip: boolean;
  runtimeConfig: RuntimeInterviewConfig;
  session: InterviewTurnSession;
  lastTurn: InterviewTurnSession['turns'][number];
  onPreviousContextError?: (error: unknown) => void;
}

export interface PreparedInterviewResponseContext extends PersistedInterviewUserResponse {
  session: InterviewTurnSession;
  nextOrder: number;
  currentTurn: number;
  collectedFacts: string[];
  systemPrompt: string;
  userPrompt: string;
}

export async function prepareInterviewResponseContext({
  sessionId,
  userId,
  userResponse,
  isSkip,
  runtimeConfig,
  session,
  lastTurn,
  onPreviousContextError,
}: PrepareInterviewResponseContextParams): Promise<PreparedInterviewResponseContext> {
  const persistedUserResponse = await persistInterviewUserResponse({
    sessionId,
    lastTurnId: lastTurn.id,
    userResponse,
    isSkip,
  });

  const allDomains = Object.values(PsychDomain) as string[];
  const coveredDomains = (session.domains_touched as string[]) || [];
  const uncoveredDomains = allDomains.filter((domain) => !coveredDomains.includes(domain));

  let previousContext = EMPTY_INTERVIEW_PREVIOUS_CONTEXT;
  try {
    previousContext = await loadInterviewPreviousContext(userId);
  } catch (error) {
    onPreviousContextError?.(error);
  }

  const currentTurn = session.turns.length;
  const collectedFacts = (session.collected_facts as string[]) || [];
  const systemPrompt = buildInterviewSystemPrompt({
    coveredDomains,
    uncoveredDomains,
    currentTurn,
    maxTurns: runtimeConfig.maxTurns,
    softTarget: runtimeConfig.softTarget,
    previousInsights: previousContext.previousInsights,
    previousNarrativeHints: previousContext.previousNarrativeHints,
    collectedFacts,
  });

  const historyWithFacts = session.turns.map((turn, index) => ({
    ai: turn.ai_message,
    user: index === session.turns.length - 1 ? (userResponse ?? '') : (turn.user_response ?? ''),
    intent: turn.ai_intent || undefined,
    extractedFacts: (turn.extracted_facts as string[]) || [],
  }));
  const userPrompt = buildInterviewUserPrompt(historyWithFacts, currentTurn);

  return {
    ...persistedUserResponse,
    session,
    nextOrder: session.turns.length + 1,
    currentTurn,
    collectedFacts,
    systemPrompt,
    userPrompt,
  };
}
