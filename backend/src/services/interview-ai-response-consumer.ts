import type { InterviewAIResponse } from '../types/interview.types';
import { Errors } from '../utils/errors';
import { INTERVIEW_AI_CONFIG } from '../config/openai';
import type { AIRequestLedgerStartInput } from './ai-request-ledger.service';
import { aiRequestLedgerService } from './ai-request-ledger.service';
import { createInterviewAIResponseStream } from './interview-ai-stream-request-utils';
import { buildRuntimeAILedgerSourceTracking } from '../utils/ai-ledger-source';
import { getAIPromptVersion } from '../utils/ai-prompt-version';
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
  ledger?: AIRequestLedgerStartInput;
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
  ledger: ledgerInput,
}: ConsumeInterviewAIResponseStreamParams): Promise<ConsumedInterviewAIResponse> {
  const emitNonEmptyTextDelta = (textDelta: string) => {
    if (textDelta) {
      emitTextDelta(textDelta);
    }
  };
  const defaultSourceTracking = buildRuntimeAILedgerSourceTracking('profile_interview');

  const ledger = await aiRequestLedgerService.start({
    ...ledgerInput,
    model: INTERVIEW_AI_CONFIG.model,
    requestKind: ledgerInput?.requestKind || 'interview_ai_response',
    promptVersion: ledgerInput?.promptVersion || getAIPromptVersion('interview_ai_response'),
    productFlow: ledgerInput?.productFlow ?? defaultSourceTracking.productFlow,
    sourceChannel: ledgerInput?.sourceChannel ?? defaultSourceTracking.sourceChannel,
    entryPoint: ledgerInput?.entryPoint ?? defaultSourceTracking.entryPoint,
    metadata: {
      ...(ledgerInput?.metadata || {}),
      stream: true,
      prompt_chars: userPrompt.length,
      max_tokens: INTERVIEW_AI_CONFIG.maxTokens,
      temperature: INTERVIEW_AI_CONFIG.temperature,
    },
  });
  let usage: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null } = {};

  const aiContent = createInterviewAIStreamParseState();

  try {
    const stream = await createInterviewAIResponseStream({
      systemPrompt,
      userPrompt,
      signal,
    });

    for await (const chunk of stream) {
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens ?? null,
          outputTokens: chunk.usage.completion_tokens ?? null,
          totalTokens: chunk.usage.total_tokens ?? null,
        };
      }
      const delta = chunk.choices[0]?.delta?.content;
      emitNonEmptyTextDelta(applyInterviewAIStreamDelta(aiContent, delta));
    }

    if (!aiContent.fullContent.trim()) {
      throw Errors.AI_CALL_FAILED('AI 返回空內容');
    }
  } catch (error) {
    await aiRequestLedgerService.fail({
      requestId: ledger.requestId,
      provider: ledgerInput?.provider || 'openai',
      model: INTERVIEW_AI_CONFIG.model,
      status: isAbortLikeError(error) ? 'cancelled' : 'failed',
      failureReason: error instanceof Error ? error.message : String(error),
      ...usage,
    });
    throw error;
  }

  await aiRequestLedgerService.complete({
    requestId: ledger.requestId,
    provider: ledgerInput?.provider || 'openai',
    model: INTERVIEW_AI_CONFIG.model,
    ...usage,
  });

  const { text, parsedMeta, pendingTextDelta, warning } =
    parseInterviewAIStreamContent(aiContent);
  if (warning) {
    onParseWarning?.(warning);
  }
  emitNonEmptyTextDelta(pendingTextDelta);

  return { text, parsedMeta };
}

function isAbortLikeError(error: unknown): boolean {
  const e = error as { name?: string; message?: string };
  const msg = String(e?.message || '').toLowerCase();
  return e?.name === 'AbortError' || msg.includes('aborted');
}
