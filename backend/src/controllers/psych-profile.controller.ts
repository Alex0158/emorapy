import { Request, Response, NextFunction } from 'express';
import { psychProfileService } from '../services/psych-profile.service';
import { getAuthUserId } from '../utils/request';

export class PsychProfileController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const data = await psychProfileService.getProfile(userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getFeedbackHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const data = await psychProfileService.getFeedbackHistory(userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async giveConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      await psychProfileService.giveConsent(userId);
      res.json({ success: true, message: '已同意心理畫像知情同意' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAllData(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      await psychProfileService.deleteAllData(userId);
      res.json({ success: true, message: '心理畫像相關資料已刪除' });
    } catch (error) {
      next(error);
    }
  }
}

export const psychProfileController = new PsychProfileController();
