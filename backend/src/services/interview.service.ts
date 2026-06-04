import logger from '../config/logger';
import { Errors } from '../utils/errors';
import { lockService } from '../utils/lock';
import {
  type SSETokenEvent,
  type SSEMetadataEvent,
  type SSESafetyAlertEvent,
  type SSECompleteEvent,
  type SSEErrorEvent,
} from '../types/interview.types';
import { asyncPipelineService } from './async-pipeline.service';
import { INTERVIEW_STATUS, CLEANUP_THRESHOLDS } from '../utils/constants';
import type { AIStreamHandle } from './ai-stream.service';
import {
  type InterviewStartTrigger,
  getPreviousInterviewSessionDisposition,
} from './interview-start-session-utils';
import { persistInterviewStartSession } from './interview-start-session-persistence';
import { loadPersonalizedInterviewSeedQuestion } from './interview-seed-question-loader';
import { loadValidatedInterviewStartContext } from './interview-start-session-context';
import { getInterviewStreamMode } from './interview-stream-payload-utils';
import { consumeInterviewAIResponseStream } from './interview-ai-response-consumer';
import { settleInterviewResponseError } from './interview-response-settlement';
import { loadValidatedInterviewTurnContext } from './interview-turn-context';
import { prepareInterviewResponseContext } from './interview-response-context';
import { startInterviewResponseStreamLifecycle } from './interview-response-stream-lifecycle';
import { persistInterviewEndSession } from './interview-end-session-persistence';
import { prepareInterviewProcessingRetry } from './interview-processing-retry';
import { loadInterviewResumeStatus } from './interview-resume-status';
import { buildRuntimeAILedgerSourceTracking } from '../utils/ai-ledger-source';
import { getAIPromptVersion } from '../utils/ai-prompt-version';
import type { BackendLocale } from '../i18n';
import {
  ensureInterviewSessionAccess,
  loadOwnedInterviewSession,
} from './interview-session-access';
import { finalizeInterviewAIResponse } from './interview-ai-response-finalizer';

type InterviewSSEHandler = (
  event: SSETokenEvent | SSEMetadataEvent | SSESafetyAlertEvent | SSECompleteEvent | SSEErrorEvent
) => void;

export class InterviewService {
  private activeStreamControllers = new Map<string, AbortController>();

  /**
   * 開始新訪談：檢查同意、每日/每小時限額，放棄舊進行中 session，建立新 session 與第一輪
   */
  async startSession(
    userId: string,
    trigger: InterviewStartTrigger = 'organic'
  ) {
    return lockService.withLock(`interview:start:${userId}`, async () => {
      const { inProgress } = await loadValidatedInterviewStartContext(userId);

      const firstQuestion = await loadPersonalizedInterviewSeedQuestion(userId, trigger);

      const previousSessionDisposition = getPreviousInterviewSessionDisposition(
        inProgress,
        CLEANUP_THRESHOLDS.MIN_TURNS_FOR_PIPELINE
      );

      const withTurns = await persistInterviewStartSession({
        userId,
        trigger,
        firstQuestion,
        previousSessionDisposition,
      });

      if (previousSessionDisposition?.shouldProcess) {
        asyncPipelineService.process(previousSessionDisposition.sessionId).catch((err) => {
          logger.error('Async pipeline after abandon failed', {
            sessionId: previousSessionDisposition.sessionId,
            error: err,
          });
        });
      }

      return withTurns!;
    }); // lockService.withLock
  }

  /**
   * 用戶回覆一輪：加鎖、驗證、寫入、呼叫 AI（可選 SSE 回調）、寫入 AI 輪、回傳 SSE 事件
   */
  async respond(
    sessionId: string,
    userId: string,
    userResponse: string,
    onSSE?: InterviewSSEHandler,
    isSkip = false,
    options: { signal?: AbortSignal; locale?: BackendLocale } = {}
  ): Promise<void> {
    let streamHandle: AIStreamHandle | null = null;
    let streamSettled = false;
    let latestText = '';
    const streamMode = getInterviewStreamMode(isSkip);
    const locale = options.locale ?? 'zh-TW';
    try {
      await lockService.withLock(
        `interview:respond:${sessionId}`,
        async () => {
          const { runtimeConfig, session, lastTurn } = await loadValidatedInterviewTurnContext(sessionId, userId);
          const responseContext = await prepareInterviewResponseContext({
            sessionId,
            userId,
            userResponse,
            isSkip,
            runtimeConfig,
            session,
            lastTurn,
            onPreviousContextError: (error) => {
              logger.debug('Non-critical: failed to load previous insights', { sessionId: session.id, error });
            },
          });
          const {
            currentTurn,
            nextOrder,
            collectedFacts,
            systemPrompt,
            userPrompt,
          } = responseContext;

          const responseStream = await startInterviewResponseStreamLifecycle({
            sessionId,
            streamMode,
            currentTurn,
            streamSettled,
            signal: options.signal,
            onSSE,
            onLatestTextDelta: (textDelta) => {
              latestText += textDelta;
            },
          });
          streamHandle = responseStream.streamHandle;
          streamSettled = responseStream.streamSettled;
          if (responseStream.shouldReturn) {
            return;
          }
          const { emitTextDelta } = responseStream;

          const { text, parsedMeta } = await consumeInterviewAIResponseStream({
            systemPrompt,
            userPrompt,
            signal: options.signal,
            emitTextDelta,
            ledger: streamHandle ? {
              streamId: streamHandle.streamId,
              scopeType: streamHandle.scopeType,
              scopeId: streamHandle.scopeId,
              requestKind: 'interview_ai_response',
              promptVersion: getAIPromptVersion('interview_ai_response'),
              ...buildRuntimeAILedgerSourceTracking('profile_interview'),
              metadata: {
                parent_request_id: streamHandle.requestId,
                current_turn: currentTurn,
                stream_mode: streamMode,
              },
            } : undefined,
            onParseWarning: (warning) => {
              if (warning === 'metadata_json_parse_failed') {
                logger.warn('Interview: metadata JSON parse failed', { sessionId });
              } else if (warning === 'json_parse_failed') {
                logger.warn('Interview AI: JSON parse failed, using raw text', { sessionId });
              }
            },
          });
          latestText = text;

          await finalizeInterviewAIResponse({
            onSSE,
            streamHandle,
            sessionId,
            status: INTERVIEW_STATUS.IN_PROGRESS,
            nextOrder,
            text,
            parsedMeta,
            collectedFacts,
            existingDomains: responseContext.session.domains_touched,
            fallbackDomains: session.domains_touched,
            streamMode,
            locale,
          });
          streamSettled = true;
        },
        30
      );
    } catch (e: unknown) {
      const settlement = await settleInterviewResponseError({
        error: e,
        streamHandle,
        streamSettled,
        streamMode,
        latestText,
        locale,
      });
      streamSettled = settlement.streamSettled;
      if (settlement.shouldReturn) {
        return;
      }
      throw settlement.errorToThrow;
    }
  }

  async submitResponse(
    sessionId: string,
    userId: string,
    userResponse: string,
    locale?: BackendLocale
  ): Promise<void> {
    await this.submitBackgroundTurn({
      sessionId,
      userId,
      logMessage: 'Interview background respond failed',
      run: (signal) => this.respond(sessionId, userId, userResponse, undefined, false, { signal, locale }),
    });
  }

  async submitSkip(sessionId: string, userId: string, locale?: BackendLocale): Promise<void> {
    await this.submitBackgroundTurn({
      sessionId,
      userId,
      logMessage: 'Interview background skip failed',
      run: (signal) => this.skipTurn(sessionId, userId, undefined, { signal, locale }),
    });
  }

  private async submitBackgroundTurn({
    sessionId,
    userId,
    logMessage,
    run,
  }: {
    sessionId: string;
    userId: string;
    logMessage: string;
    run: (signal: AbortSignal) => Promise<void>;
  }): Promise<void> {
    await this.ensureNoActiveStream(sessionId);
    await loadValidatedInterviewTurnContext(sessionId, userId);
    const controller = new AbortController();
    this.activeStreamControllers.set(sessionId, controller);

    void run(controller.signal)
      .catch((error) => {
        logger.error(logMessage, { sessionId, userId, error });
      })
      .finally(() => {
        if (this.activeStreamControllers.get(sessionId) === controller) {
          this.activeStreamControllers.delete(sessionId);
        }
      });
  }

  async cancelActiveStream(sessionId: string, userId: string): Promise<boolean> {
    await ensureInterviewSessionAccess(sessionId, userId);
    const controller = this.activeStreamControllers.get(sessionId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  private async ensureNoActiveStream(sessionId: string): Promise<void> {
    const controller = this.activeStreamControllers.get(sessionId);
    if (controller && !controller.signal.aborted) {
      throw Errors.CONCURRENT_REQUEST();
    }
    this.activeStreamControllers.delete(sessionId);
  }

  async endSession(sessionId: string, userId: string): Promise<void> {
    await lockService.withLock(
      `interview:respond:${sessionId}`,
      async () => {
        const disposition = await persistInterviewEndSession({ sessionId, userId });
        if (!disposition.shouldProcess) {
          logger.info('Session ended without pipeline (insufficient content)', {
            sessionId,
            turns: disposition.turnCount,
            totalUserChars: disposition.totalUserChars,
            reason: disposition.insufficientReason,
          });
          return;
        }

        asyncPipelineService.process(sessionId).catch((err) => {
          logger.error('Async pipeline after endSession failed', { sessionId, error: err });
        });
      },
      10
    );
  }

  async getSession(sessionId: string, userId: string) {
    return loadOwnedInterviewSession(sessionId, userId);
  }

  async checkResume(userId: string) {
    return loadInterviewResumeStatus(userId);
  }

  async skipTurn(
    sessionId: string,
    userId: string,
    onSSE?: InterviewSSEHandler,
    options: { signal?: AbortSignal; locale?: BackendLocale } = {}
  ): Promise<void> {
    await this.respond(sessionId, userId, '', onSSE, true, options);
  }

  async retryFailed(sessionId: string, userId: string): Promise<void> {
    const retry = await prepareInterviewProcessingRetry(sessionId, userId);
    asyncPipelineService.resume(retry.sessionId, retry.fromStep).catch((err) => {
      logger.error('Async pipeline retry failed', { sessionId, error: err });
    });
  }
}

export const interviewService = new InterviewService();
