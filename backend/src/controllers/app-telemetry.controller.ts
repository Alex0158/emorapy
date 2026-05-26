import { Request, Response, NextFunction } from 'express';
import {
  appTelemetryService,
  type AppTelemetryEventInput,
  type AppTelemetryOtlpTraceInput,
} from '../services/app-telemetry.service';
import { getAuthUserIdOptional, getRequestId, getSessionIdFromSources } from '../utils/request';

export class AppTelemetryController {
  async recordEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const bodyEvents = Array.isArray(req.body?.events)
        ? req.body.events as AppTelemetryEventInput[]
        : [req.body as AppTelemetryEventInput];
      const { sessionId } = getSessionIdFromSources(req);
      const result = await appTelemetryService.recordEvents(bodyEvents, {
        userId: getAuthUserIdOptional(req),
        sessionId,
        requestId: getRequestId(req),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(202).json({
        success: true,
        data: {
          accepted_count: result.acceptedCount,
          persisted_count: result.persistedCount,
          severities: result.severities,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async recordOtlpTraces(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = getSessionIdFromSources(req);
      const result = await appTelemetryService.recordOtlpTraces(req.body as AppTelemetryOtlpTraceInput, {
        userId: getAuthUserIdOptional(req),
        sessionId,
        requestId: getRequestId(req),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(202).json({
        success: true,
        data: {
          accepted_count: result.acceptedCount,
          persisted_count: result.persistedCount,
          severities: result.severities,
          partial_success: {
            rejected_spans: 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const appTelemetryController = new AppTelemetryController();
