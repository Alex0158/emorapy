/**
 * 心理畫像 API
 */

import request from '../request';

export const psychProfileApi = {
  getProfile: () => request.get('/psych-profile'),

  getFeedbackHistory: () => request.get('/psych-profile/feedback'),

  giveConsent: () => request.post('/psych-profile/consent'),

  deleteAllData: () => request.delete('/psych-profile'),
};
