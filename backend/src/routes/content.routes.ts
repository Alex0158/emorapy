import { Router } from 'express';
import { contentController } from '../controllers/content.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { caseIdParamSchema } from '../utils/validation';

const router = Router();

router.get('/content-items', contentController.list.bind(contentController));
router.get(
  '/content-items/recommendations/:caseId',
  validate(caseIdParamSchema),
  contentController.recommendations.bind(contentController)
);
router.post('/content-links', authenticate, contentController.link.bind(contentController));

export default router;
