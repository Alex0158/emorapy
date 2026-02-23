import { Request, Response, NextFunction } from 'express';
import { interviewService } from '../services/interview.service';
import { getAuthUserId } from '../utils/request';
import { AppError } from '../utils/errors';
import { INTERVIEW_STATUS } from '../utils/constants';
import {
  PipelineStep,
  type SSETokenEvent,
  type SSEMetadataEvent,
  type SSESafetyAlertEvent,
  type SSECompleteEvent,
  type SSEErrorEvent,
} from '../types/interview.types';

export class InterviewController {
  async startSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const trigger = req.body.trigger;
      const session = await interviewService.startSession(userId, trigger);
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

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      let clientDisconnected = false;
      req.on('close', () => {
        clientDisconnected = true;
      });

      const onSSE = (event: SSETokenEvent | SSEMetadataEvent | SSESafetyAlertEvent | SSECompleteEvent | SSEErrorEvent) => {
        if (clientDisconnected) return;
        if ('text' in event && !('turn_order' in event) && !('code' in event)) {
          res.write(`event: token\ndata: ${JSON.stringify({ text: (event as SSETokenEvent).text })}\n\n`);
        } else if ('turn_order' in event) {
          res.write(`event: metadata\ndata: ${JSON.stringify(event)}\n\n`);
        } else if ('message' in event && 'severity' in event) {
          res.write(`event: safety_alert\ndata: ${JSON.stringify(event)}\n\n`);
        } else if ('session_id' in event && 'status' in event) {
          res.write(`event: complete\ndata: ${JSON.stringify(event)}\n\n`);
        } else if ('code' in event && 'message' in event) {
          res.write(`event: error\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };

      await interviewService.respond(sessionId, userId, userResponse, onSSE);

      if (!clientDisconnected) res.end();
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      } else if (!res.writableEnded) {
        try {
          const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
          const msg = error instanceof AppError ? error.message : '服務內部錯誤';
          res.write(`event: error\ndata: ${JSON.stringify({ code, message: msg })}\n\n`);
        } catch { /* client disconnected, ignore write error */ }
        if (!res.writableEnded) res.end();
      }
    }
  }

  async endSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      await interviewService.endSession(sessionId, userId);
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
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sessionId = req.params.id;
      const userId = getAuthUserId(req);

      let clientDisconnected = false;
      req.on('close', () => {
        clientDisconnected = true;
      });

      const onSSE = (event: SSETokenEvent | SSEMetadataEvent | SSESafetyAlertEvent | SSECompleteEvent | SSEErrorEvent) => {
        if (clientDisconnected) return;
        if ('text' in event && !('turn_order' in event) && !('code' in event)) {
          res.write(`event: token\ndata: ${JSON.stringify({ text: (event as SSETokenEvent).text })}\n\n`);
        } else if ('turn_order' in event) {
          res.write(`event: metadata\ndata: ${JSON.stringify(event)}\n\n`);
        } else if ('message' in event && 'severity' in event) {
          res.write(`event: safety_alert\ndata: ${JSON.stringify(event)}\n\n`);
        } else if ('session_id' in event && 'status' in event) {
          res.write(`event: complete\ndata: ${JSON.stringify(event)}\n\n`);
        } else if ('code' in event && 'message' in event) {
          res.write(`event: error\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };

      await interviewService.skipTurn(sessionId, userId, onSSE);

      if (!clientDisconnected) res.end();
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      } else if (!res.writableEnded) {
        try {
          const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
          const msg = error instanceof AppError ? error.message : '服務內部錯誤';
          res.write(`event: error\ndata: ${JSON.stringify({ code, message: msg })}\n\n`);
        } catch { /* client disconnected, ignore write error */ }
        if (!res.writableEnded) res.end();
      }
    }
  }

  async retryFailed(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.id;
      const userId = getAuthUserId(req);
      await interviewService.retryFailed(sessionId, userId);
      res.json({ success: true, message: '已重試' });
    } catch (error) {
      next(error);
    }
  }
}

export const interviewController = new InterviewController();
