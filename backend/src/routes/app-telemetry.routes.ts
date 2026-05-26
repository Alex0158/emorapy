import { Router } from 'express';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import { appTelemetryEventSchema, appTelemetryOtlpTraceSchema } from '../utils/validation';
import { appTelemetryController } from '../controllers/app-telemetry.controller';

const router = Router();

router.post(
  '/telemetry/events',
  generalLimiter,
  optionalAuthenticate,
  validate(appTelemetryEventSchema),
  appTelemetryController.recordEvents.bind(appTelemetryController)
);

router.post(
  '/telemetry/otlp/v1/traces',
  generalLimiter,
  optionalAuthenticate,
  validate(appTelemetryOtlpTraceSchema),
  appTelemetryController.recordOtlpTraces.bind(appTelemetryController)
);

export default router;
