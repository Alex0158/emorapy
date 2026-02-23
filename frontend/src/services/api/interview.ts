/**
 * 心理側寫訪談 API
 *
 * 後端路由: /api/v1/interview (已含 baseURL)
 *   POST /start
 *   GET  /resume
 *   GET  /:id
 *   POST /:id/respond  (SSE，由 sseRequest 處理)
 *   POST /:id/skip     (SSE，由 sseRequest 處理)
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

  endSession: (sessionId: string) =>
    request.post(`/interview/${sessionId}/end`),

  retryFailed: (sessionId: string) =>
    request.post(`/interview/${sessionId}/retry`),
};
