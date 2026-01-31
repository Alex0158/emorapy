import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { Errors } from '../utils/errors';
import { getAuthUserId } from '../utils/request';

const USER_PROFILE_FIELDS = new Set([
  'education_level',
  'major_field',
  'university',
  'ethnicity',
  'cultural_identity',
  'upbringing_environment',
  'religion',
  'religious_practice_level',
  'family_structure',
  'parents_relationship',
  'family_economic_status',
  'mbti_type',
  'big_five_personality',
  'communication_style',
  'occupation',
  'interests',
  'core_values',
  'profile_visibility',
]);

const RELATIONSHIP_PROFILE_FIELDS = new Set([
  'relationship_duration_days',
  'relationship_stage',
  'milestones',
  'user1_location',
  'user2_location',
  'is_long_distance',
  'distance_km',
  'meeting_frequency',
  'user1_bottom_lines',
  'user2_bottom_lines',
  'common_bottom_lines',
  'historical_red_flags',
  'user1_preferences',
  'user2_preferences',
  'common_preferences',
  'dislikes',
  'communication_frequency',
  'preferred_communication_methods',
  'conflict_communication_style',
  'relationship_strengths',
  'relationship_challenges',
  'historical_case_types',
  'historical_responsibility_trends',
  'reconciliation_plan_execution_rate',
  'relationship_improvement_trend',
  'completion_percentage',
]);

const sanitizePayload = (body: any, allowed: Set<string>) => {
  if (typeof body !== 'object' || body === null) {
    throw Errors.VALIDATION_ERROR('請求體必須為 JSON 對象');
  }
  const sanitized: any = {};
  Object.entries(body).forEach(([key, value]) => {
    if (allowed.has(key)) {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

export class ProfileController {
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const profile = await profileService.getUserProfile(userId);
      res.json({ success: true, data: { profile } });
    } catch (error) {
      next(error);
    }
  }

  async upsertUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const payload = sanitizePayload(req.body, USER_PROFILE_FIELDS);
      const profile = await profileService.upsertUserProfile(userId, payload);
      res.json({ success: true, data: { profile }, message: '個人背景已更新' });
    } catch (error) {
      next(error);
    }
  }

  async getRelationshipProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const pairingId = req.params.pairingId;
      const profile = await profileService.getRelationshipProfile(pairingId, userId);
      res.json({ success: true, data: { profile } });
    } catch (error) {
      next(error);
    }
  }

  async upsertRelationshipProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const pairingId = req.params.pairingId;
      const payload = sanitizePayload(req.body, RELATIONSHIP_PROFILE_FIELDS);
      const profile = await profileService.upsertRelationshipProfile(pairingId, userId, payload);
      res.json({ success: true, data: { profile }, message: '關係檔案已更新' });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
