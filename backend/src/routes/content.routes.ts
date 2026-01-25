import { Router } from 'express';
import { contentController } from '../controllers/content.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/content-items', contentController.list.bind(contentController));
router.get('/content-items/recommendations/:caseId', contentController.recommendations.bind(contentController));
router.post('/content-links', authenticate, contentController.link.bind(contentController));

export default router;
