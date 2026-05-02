import { PsychDomain } from '@prisma/client';
import type {
  InterviewAIResponse,
  SSECompleteEvent,
  SSEMetadataEvent,
} from '../types/interview.types';

export const INTERVIEW_METADATA_DELIMITER = '---METADATA---';
export const INTERVIEW_DEFAULT_FALLBACK_TEXT = '謝謝你的分享，我們下次再聊。';

const INTERVIEW_METADATA_DELIMITER_PATTERN = new RegExp(INTERVIEW_METADATA_DELIMITER, 'gi');

export type InterviewAIContentParseWarning =
  | 'metadata_json_parse_failed'
  | 'json_parse_failed';

export interface InterviewAIStreamParseState {
  fullContent: string;
  sentTextLength: number;
  isJsonFormat: boolean;
  formatDetected: boolean;
}

export interface InterviewAIStreamParseResult {
  text: string;
  parsedMeta: Partial<InterviewAIResponse>;
  pendingTextDelta: string;
  warning?: InterviewAIContentParseWarning;
}

export interface InterviewTurnCreateData {
  session_id: string;
  turn_order: number;
  ai_message: string;
  ai_intent?: string;
  ai_target_domains: PsychDomain[];
  extracted_facts: string[];
  safety_flag: boolean;
  safety_detail?: string;
}

export interface InterviewSessionUpdateData {
  domains_touched: PsychDomain[];
  total_ai_words: { increment: number };
  collected_facts?: string[];
}

export function sanitizeInterviewUserResponse(userResponse: string | null | undefined, isSkip: boolean): string {
  if (isSkip) return '';
  return (userResponse || '').replace(INTERVIEW_METADATA_DELIMITER_PATTERN, '').trim();
}

export function countInterviewWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function normalizeInterviewTargetDomains(targetDomains: unknown): PsychDomain[] {
  if (!Array.isArray(targetDomains)) return [];
  return targetDomains.filter((domain): domain is PsychDomain =>
    typeof domain === 'string' && Object.values(PsychDomain).includes(domain as PsychDomain)
  );
}

export function extractInterviewKeyFacts(keyFacts: unknown): string[] {
  if (!Array.isArray(keyFacts)) return [];
  return keyFacts.filter((fact): fact is string => typeof fact === 'string' && fact.trim().length > 0);
}

export function mergeInterviewFacts(existingFacts: string[], newFacts: string[]): string[] {
  return [...new Set([...existingFacts, ...newFacts])];
}

export function createInterviewAIStreamParseState(): InterviewAIStreamParseState {
  return {
    fullContent: '',
    sentTextLength: 0,
    isJsonFormat: false,
    formatDetected: false,
  };
}

export function applyInterviewAIStreamDelta(
  state: InterviewAIStreamParseState,
  delta: string | null | undefined
): string {
  if (!delta) return '';
  state.fullContent += delta;

  if (!state.formatDetected) {
    const trimmed = state.fullContent.trimStart();
    if (trimmed.length > 0) {
      state.formatDetected = true;
      state.isJsonFormat = trimmed.startsWith('{') || trimmed.startsWith('[');
    }
  }

  if (state.isJsonFormat) return '';

  const delimiterIndex = state.fullContent.lastIndexOf(INTERVIEW_METADATA_DELIMITER);
  if (delimiterIndex >= 0) {
    const textPart = state.fullContent.substring(0, delimiterIndex);
    if (state.sentTextLength < textPart.length) {
      const textDelta = textPart.substring(state.sentTextLength);
      state.sentTextLength = textPart.length;
      return textDelta;
    }
    return '';
  }

  const safeEnd = Math.max(0, state.fullContent.length - INTERVIEW_METADATA_DELIMITER.length);
  if (safeEnd > state.sentTextLength) {
    const textDelta = state.fullContent.substring(state.sentTextLength, safeEnd);
    state.sentTextLength = safeEnd;
    return textDelta;
  }
  return '';
}

export function parseInterviewAIStreamContent(
  state: InterviewAIStreamParseState
): InterviewAIStreamParseResult {
  let text: string;
  let parsedMeta: Partial<InterviewAIResponse> = {};
  let warning: InterviewAIContentParseWarning | undefined;
  let pendingTextDelta = '';
  const delimiterIndex = state.fullContent.lastIndexOf(INTERVIEW_METADATA_DELIMITER);

  if (delimiterIndex >= 0) {
    text = state.fullContent.substring(0, delimiterIndex).trim();
    const metaStr = state.fullContent
      .substring(delimiterIndex + INTERVIEW_METADATA_DELIMITER.length)
      .trim();
    try {
      const jsonMatch = metaStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedMeta = JSON.parse(jsonMatch[0]);
    } catch {
      warning = 'metadata_json_parse_failed';
    }
    if (state.sentTextLength < text.length) {
      pendingTextDelta = text.substring(state.sentTextLength);
    }
  } else if (state.isJsonFormat) {
    try {
      const jsonMatch = state.fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonParsed = JSON.parse(jsonMatch[0]) as InterviewAIResponse;
        text = (jsonParsed.text || '').trim();
        parsedMeta = jsonParsed;
      } else {
        text = state.fullContent.trim();
      }
    } catch {
      warning = 'json_parse_failed';
      text = state.fullContent.trim();
    }
    pendingTextDelta = text;
  } else {
    text = state.fullContent.trim();
    if (state.sentTextLength < text.length) {
      pendingTextDelta = text.substring(state.sentTextLength);
    }
  }

  return {
    text: text || INTERVIEW_DEFAULT_FALLBACK_TEXT,
    parsedMeta,
    pendingTextDelta,
    warning,
  };
}

export function buildInterviewResponseArtifacts({
  parsedMeta,
  collectedFacts,
  existingDomains,
  text,
}: {
  parsedMeta: Partial<InterviewAIResponse>;
  collectedFacts: string[];
  existingDomains: PsychDomain[];
  text: string;
}): {
  targetDomains: PsychDomain[];
  newFacts: string[];
  updatedCollectedFacts: string[];
  aiWordCount: number;
  newDomains: PsychDomain[];
} {
  const targetDomains = normalizeInterviewTargetDomains(parsedMeta.target_domains);
  const newFacts = extractInterviewKeyFacts(parsedMeta.key_facts);
  return {
    targetDomains,
    newFacts,
    updatedCollectedFacts: mergeInterviewFacts(collectedFacts, newFacts),
    aiWordCount: countInterviewWords(text),
    newDomains: [...new Set([...existingDomains, ...targetDomains])],
  };
}

export function buildInterviewTurnCreateData({
  sessionId,
  nextOrder,
  text,
  parsedMeta,
  targetDomains,
  fallbackDomains,
  newFacts,
}: {
  sessionId: string;
  nextOrder: number;
  text: string;
  parsedMeta: Partial<InterviewAIResponse>;
  targetDomains: PsychDomain[];
  fallbackDomains: PsychDomain[];
  newFacts: string[];
}): InterviewTurnCreateData {
  return {
    session_id: sessionId,
    turn_order: nextOrder,
    ai_message: text,
    ai_intent: parsedMeta.intent ?? undefined,
    ai_target_domains: targetDomains.length ? targetDomains : fallbackDomains,
    extracted_facts: newFacts,
    safety_flag: !!parsedMeta.safety_flag,
    safety_detail: parsedMeta.safety_message || undefined,
  };
}

export function buildInterviewSessionUpdateData({
  newDomains,
  aiWordCount,
  newFacts,
  updatedCollectedFacts,
}: {
  newDomains: PsychDomain[];
  aiWordCount: number;
  newFacts: string[];
  updatedCollectedFacts: string[];
}): InterviewSessionUpdateData {
  return {
    domains_touched: newDomains,
    total_ai_words: { increment: aiWordCount },
    ...(newFacts.length > 0 ? { collected_facts: updatedCollectedFacts } : {}),
  };
}

export function buildInterviewMetadataEvent({
  nextOrder,
  parsedMeta,
  domainsTouched,
}: {
  nextOrder: number;
  parsedMeta: Partial<InterviewAIResponse>;
  domainsTouched: PsychDomain[];
}): SSEMetadataEvent {
  return {
    turn_order: nextOrder,
    intent: parsedMeta.intent,
    target_domains: parsedMeta.target_domains,
    domains_touched: domainsTouched,
    total_turns: nextOrder,
    should_end: parsedMeta.should_end || false,
  };
}

export function buildInterviewCompleteEvent({
  sessionId,
  status,
  nextOrder,
  domainsTouched,
}: {
  sessionId: string;
  status: string;
  nextOrder: number;
  domainsTouched: PsychDomain[];
}): SSECompleteEvent {
  return {
    session_id: sessionId,
    status,
    total_turns: nextOrder,
    domains_touched: domainsTouched,
  };
}
