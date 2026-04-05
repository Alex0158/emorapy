import { Router } from 'express';
import { env } from '../config/env';
import { aiStreamMetricsService } from '../services/ai-stream-metrics.service';
import { chatMetricsService } from '../services/chat-metrics.service';

const router = Router();

function isMetricsAllowed(ip: string, allowedIps: string[]): boolean {
  if (!ip || allowedIps.length === 0) return false;
  return allowedIps.includes(ip);
}

router.get('/metrics', async (req, res) => {
  if (!env.METRICS_ENABLED) {
    return res.status(404).send('# metrics disabled');
  }

  if (env.NODE_ENV === 'production') {
    const token = req.header('X-Metrics-Token')?.trim();
    const hasValidToken = !!env.METRICS_TOKEN && token === env.METRICS_TOKEN;
    const hasAllowedIp = isMetricsAllowed(req.ip || '', env.METRICS_ALLOWED_IPS);
    if (!hasValidToken && !hasAllowedIp) {
      return res.status(403).send('# metrics forbidden');
    }
  }

  try {
    const [chatMetrics, aiStreamMetrics] = await Promise.all([
      chatMetricsService.exportPrometheus(),
      aiStreamMetricsService.exportPrometheus(),
    ]);
    const body = [chatMetrics, aiStreamMetrics].filter(Boolean).join('\n');
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.send(body);
  } catch (error) {
    return res.status(500).send('# metrics unavailable');
  }
});

export default router;
