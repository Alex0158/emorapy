import { Router } from 'express';
import { contentController } from '../controllers/content.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { caseIdParamSchema, createContentLinkSchema } from '../utils/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/content-items', generalLimiter, contentController.list.bind(contentController));
router.get(
  '/content-items/recommendations/:caseId',
  generalLimiter,
  optionalAuthenticate,
  validate(caseIdParamSchema),
  contentController.recommendations.bind(contentController)
);
router.post('/content-links', generalLimiter, authenticate, validate(createContentLinkSchema), contentController.link.bind(contentController));

export default router;
