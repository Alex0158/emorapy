import type { InterviewAIResponse } from '../types/interview.types';
import { Errors } from '../utils/errors';
import { createInterviewAIResponseStream } from './interview-ai-stream-request-utils';
import {
  applyInterviewAIStreamDelta,
  createInterviewAIStreamParseState,
  parseInterviewAIStreamContent,
  type InterviewAIContentParseWarning,
} from './interview-response-utils';

export interface ConsumeInterviewAIResponseStreamParams {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
  emitTextDelta: (textDelta: string) => void;
  onParseWarning?: (warning: InterviewAIContentParseWarning) => void;
}

export interface ConsumedInterviewAIResponse {
  text: string;
  parsedMeta: Partial<InterviewAIResponse>;
}

export async function consumeInterviewAIResponseStream({
  systemPrompt,
  userPrompt,
  signal,
  emitTextDelta,
  onParseWarning,
}: ConsumeInterviewAIResponseStreamParams): Promise<ConsumedInterviewAIResponse> {
  const emitNonEmptyTextDelta = (textDelta: string) => {
    if (textDelta) {
      emitTextDelta(textDelta);
    }
  };

  const stream = await createInterviewAIResponseStream({
    systemPrompt,
    userPrompt,
    signal,
  });

  const aiContent = createInterviewAIStreamParseState();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    emitNonEmptyTextDelta(applyInterviewAIStreamDelta(aiContent, delta));
  }

  if (!aiContent.fullContent.trim()) {
    throw Errors.AI_CALL_FAILED('AI 返回空內容');
  }

  const { text, parsedMeta, pendingTextDelta, warning } =
    parseInterviewAIStreamContent(aiContent);
  if (warning) {
    onParseWarning?.(warning);
  }
  emitNonEmptyTextDelta(pendingTextDelta);

  return { text, parsedMeta };
}
