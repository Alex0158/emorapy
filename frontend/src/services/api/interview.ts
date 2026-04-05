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

import request from '../request';

export const interviewApi = {
  startSession: (trigger: string = 'organic') =>
    request.post('/interview/start', { trigger }),

  checkResume: () =>
    request.get('/interview/resume'),

  getSession: (sessionId: string) =>
    request.get(`/interview/${sessionId}`),

  respond: (sessionId: string, message: string) =>
    request.post(`/interview/${sessionId}/respond`, { message }),

  skip: (sessionId: string) =>
    request.post(`/interview/${sessionId}/skip`),

  cancel: (sessionId: string) =>
    request.post(`/interview/${sessionId}/cancel`),

  endSession: (sessionId: string) =>
    request.post(`/interview/${sessionId}/end`),

  retryFailed: (sessionId: string) =>
    request.post(`/interview/${sessionId}/retry`),
};
