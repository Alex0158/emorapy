import { Request, Response, NextFunction } from 'express';
import { opsMetricsService } from '../services/ops-metrics.service';

const EXCLUDED_PREFIXES = ['/health', '/health/live', '/health/ready'];

function shouldTrack(path: string): boolean {
  return !EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export const opsMetrics = (req: Request, res: Response, next: NextFunction): void => {
  const path = req.path || req.originalUrl || '';
  if (!shouldTrack(path)) {
    next();
    return;
  }

  res.on('finish', () => {
    // Fire-and-forget metrics write to avoid impacting request latency.
    void opsMetricsService.recordHttpStatus(res.statusCode);
  });

  next();
};
