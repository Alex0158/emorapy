import { Router } from 'express';
import { chatMetricsService } from '../services/chat-metrics.service';

const router = Router();

router.get('/metrics', async (_req, res) => {
  try {
    const body = await chatMetricsService.exportPrometheus();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(body);
  } catch (error) {
    res.status(500).send('# metrics unavailable');
  }
});

export default router;
