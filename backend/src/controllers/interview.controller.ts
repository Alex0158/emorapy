import { Request, Response, NextFunction } from 'express';
import { interviewService } from '../services/interview.service';
import { getAuthUserId } from '../utils/request';
import { INTERVIEW_STATUS } from '../utils/constants';
import { PipelineStep } from '../types/interview.types';

export class InterviewController {
  async startSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const trigger = req.body.trigger;
      const session = await interviewService.startSession(userId, trigger, req.locale);
      res.status(201).json({ success: true, data: session, message: '訪談已開始' });
    } catch (error) {
      next(error);
    }
  }

  async respond(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      const userResponse = req.body.message;
      await interviewService.submitResponse(sessionId, userId, userResponse, req.locale);
      res.status(202).json({
        success: true,
        data: { accepted: true, session_id: sessionId },
        message: '訪談回覆已提交',
      });
    } catch (error) {
      next(error);
    }
  }

  async endSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      await interviewService.endSession(sessionId, userId, req.locale);
      res.json({ success: true, message: '訪談已結束' });
    } catch (error) {
      next(error);
    }
  }

  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      const session = await interviewService.getSession(sessionId, userId);
      const partial_success = session.status === INTERVIEW_STATUS.COMPLETED && session.pipeline_step >= PipelineStep.COMPLETED && !session.feedback_card;
      res.json({ success: true, data: { ...session, partial_success } });
    } catch (error) {
      next(error);
    }
  }

  async checkResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const data = await interviewService.checkResume(userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async skip(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      await interviewService.submitSkip(sessionId, userId, req.locale);
      res.status(202).json({
        success: true,
        data: { accepted: true, session_id: sessionId },
        message: '訪談跳題已提交',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      const cancelled = await interviewService.cancelActiveStream(sessionId, userId);
      res.json({
        success: true,
        data: { cancelled, session_id: sessionId },
        message: cancelled ? '訪談生成已停止' : '目前沒有進行中的訪談生成',
      });
    } catch (error) {
      next(error);
    }
  }

  async retryFailed(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      await interviewService.retryFailed(sessionId, userId, req.locale);
      res.json({ success: true, message: '已重試' });
    } catch (error) {
      next(error);
    }
  }
}

export const interviewController = new InterviewController();
