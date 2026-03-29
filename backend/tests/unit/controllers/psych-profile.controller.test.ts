/**
 * PsychProfileController 單元測試（mock psychProfileService、getAuthUserId）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { PsychProfileController } from '../../../src/controllers/psych-profile.controller';
import { psychProfileService } from '../../../src/services/psych-profile.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetProfile: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetFeedbackHistory: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGiveConsent: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDeleteAllData: any = jest.fn();
const mockGetAuthUserId = jest.fn();

jest.mock('../../../src/services/psych-profile.service', () => ({
  psychProfileService: {
    getProfile: (userId: string) => mockGetProfile(userId),
    getFeedbackHistory: (userId: string) => mockGetFeedbackHistory(userId),
    giveConsent: (userId: string) => mockGiveConsent(userId),
    deleteAllData: (userId: string) => mockDeleteAllData(userId),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
}));

describe('PsychProfileController', () => {
  let controller: PsychProfileController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PsychProfileController();
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
  });

  describe('getProfile', () => {
    it('getProfile 拋錯時應 next(error)', async () => {
      mockGetProfile.mockRejectedValue(new Error('db error'));

      await controller.getProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('無敘事與洞見時應返回 narratives、insights 空陣列（F06 邊界）', async () => {
      mockGetProfile.mockResolvedValue({
        consent_given: false,
        consent_at: null,
        narratives: [],
        insights: [],
        richness_score: 0,
      });

      await controller.getProfile(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetProfile).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          narratives: [],
          insights: [],
        }),
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getFeedbackHistory', () => {
    it('無反饋時應返回 history 空陣列（F06 邊界）', async () => {
      mockGetFeedbackHistory.mockResolvedValue({ history: [] });

      await controller.getFeedbackHistory(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetFeedbackHistory).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { history: [] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('有反饋時應返回 history 陣列', async () => {
      const history = [
        {
          session_id: 's1',
          feedback_card: { summary: 'ok' },
          domains_touched: ['personality'],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      mockGetFeedbackHistory.mockResolvedValue({ history });

      await controller.getFeedbackHistory(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { history },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('getFeedbackHistory 拋錯時應 next(error)', async () => {
      mockGetFeedbackHistory.mockRejectedValue(new Error('db error'));

      await controller.getFeedbackHistory(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('giveConsent', () => {
    it('giveConsent 拋錯時應 next(error)', async () => {
      mockGiveConsent.mockRejectedValue(new Error('db error'));

      await controller.giveConsent(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteAllData', () => {
    it('deleteAllData 拋錯時應 next(error)', async () => {
      mockDeleteAllData.mockRejectedValue(new Error('db error'));

      await controller.deleteAllData(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
