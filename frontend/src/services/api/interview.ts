/**
 * 心理側寫訪談 API
 *
 * 後端路由: /api/v1/interview (已含 baseURL)
 *   POST /start
 *   GET  /resume
 *   GET  /:id
 *   POST /:id/respond
 *   POST /:id/skip
 *   POST /:id/cancel
 *   POST /:id/end
 *   POST /:id/retry
 */

import { createM2ApiClient } from '@emorapy/api-client';
import request from '../request';
import type { InterviewTrigger } from '@/types/interview';

const sharedInterviewApi = createM2ApiClient(request).interview;

export const interviewApi = {
  startSession: (trigger: InterviewTrigger = 'organic') =>
    sharedInterviewApi.startSession(trigger),

  checkResume: () =>
    sharedInterviewApi.checkResume(),

  getSession: (sessionId: string) =>
    sharedInterviewApi.getSession(sessionId),

  respond: (sessionId: string, message: string) =>
    sharedInterviewApi.respond(sessionId, message),

  skip: (sessionId: string) =>
    sharedInterviewApi.skip(sessionId),

  cancel: (sessionId: string) =>
    sharedInterviewApi.cancel(sessionId),

  endSession: (sessionId: string) =>
    sharedInterviewApi.endSession(sessionId),

  retryFailed: (sessionId: string) =>
    sharedInterviewApi.retryFailed(sessionId),
};
