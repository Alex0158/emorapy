/**
 * 元資訊路由（版本等，無需認證）
 */

import { Router, Response } from 'express';
import packageJson from '../../package.json';

const router = Router();
const backendVersion = packageJson.version || '1.0.0';

/**
 * @route   GET /api/v1/version
 * @desc    後端版本資訊（輕量，供前端版本面板使用）
 * @access  Public
 */
router.get('/version', (_req, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    service: 'backend',
    version: backendVersion,
    timestamp: new Date().toISOString(),
  });
});

export default router;
