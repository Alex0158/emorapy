/**
 * 心理畫像 API
 */

import { createM2ApiClient } from '@cj/api-client';
import request from '../request';

const sharedPsychProfileApi = createM2ApiClient(request).psychProfile;

export const psychProfileApi = {
  getProfile: () => sharedPsychProfileApi.getProfile(),
  getFeedbackHistory: () => sharedPsychProfileApi.getFeedbackHistory(),
  giveConsent: () => sharedPsychProfileApi.giveConsent(),
  deleteAllData: () => sharedPsychProfileApi.deleteAllData(),
};
