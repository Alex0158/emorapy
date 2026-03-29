import { Router } from 'express';
import {
  authenticateAdmin,
  requireAdminPermission,
} from '../middleware/adminAuth';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import {
  mediaProviderCatalogQuerySchema,
  mediaProviderEstimateSchema,
  mediaProviderGenerateImageSchema,
  mediaProviderGenerateVideoSchema,
  mediaProviderTestSchema,
} from '../utils/validation';
import { mediaProviderController } from '../controllers/media-provider.controller';

const router = Router();

router.get(
  '/providers',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:read'),
  validate(mediaProviderCatalogQuerySchema),
  mediaProviderController.listCatalog.bind(mediaProviderController)
);

router.post(
  '/providers/:providerKey/test',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:write'),
  validate(mediaProviderTestSchema),
  mediaProviderController.testProvider.bind(mediaProviderController)
);
router.post(
  '/providers/:providerKey/estimate',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:read'),
  validate(mediaProviderEstimateSchema),
  mediaProviderController.estimateCost.bind(mediaProviderController)
);
router.post(
  '/providers/:providerKey/images',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:write'),
  validate(mediaProviderGenerateImageSchema),
  mediaProviderController.generateImages.bind(mediaProviderController)
);
router.post(
  '/providers/:providerKey/videos',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:write'),
  validate(mediaProviderGenerateVideoSchema),
  mediaProviderController.generateVideos.bind(mediaProviderController)
);

export default router;
