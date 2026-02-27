import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import {
  authenticateAdmin,
  requireAdminPermission,
  requireAdminPermissionAll,
} from '../middleware/adminAuth';
import { authLimiter, generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import {
  adminAdminUserDeleteSchema,
  adminAdminUserCreateSchema,
  adminAdminUserUpdateSchema,
  adminAuditLogsQuerySchema,
  adminBootstrapSchema,
  adminCustomReportSchema,
  adminJobTriggerSchema,
  adminJobStatsQuerySchema,
  adminLoginSchema,
  adminUpsertConfigSchema,
  adminUserDetailParamSchema,
  adminUserStatusSchema,
} from '../utils/validation';

const router = Router();

router.post('/bootstrap', authLimiter, validate(adminBootstrapSchema), adminController.bootstrap.bind(adminController));
router.post('/login', authLimiter, validate(adminLoginSchema), adminController.login.bind(adminController));
router.get('/me', generalLimiter, authenticateAdmin, adminController.me.bind(adminController));

router.get(
  '/health/detailed',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('ops:read'),
  adminController.healthDetailed.bind(adminController)
);

router.get(
  '/jobs',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('ops:read'),
  adminController.listJobs.bind(adminController)
);
router.get(
  '/jobs/stats',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('ops:read'),
  validate(adminJobStatsQuerySchema),
  adminController.getJobStats.bind(adminController)
);
router.post(
  '/jobs/:jobKey/trigger',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('ops:execute'),
  validate(adminJobTriggerSchema),
  adminController.triggerJob.bind(adminController)
);

router.get(
  '/configs',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:read'),
  adminController.listConfigs.bind(adminController)
);
router.put(
  '/configs',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:write'),
  validate(adminUpsertConfigSchema),
  adminController.upsertConfig.bind(adminController)
);

router.get(
  '/users',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('users:read'),
  adminController.listUsers.bind(adminController)
);
router.get(
  '/users/:userId',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('users:read'),
  validate(adminUserDetailParamSchema),
  adminController.getUserDetail.bind(adminController)
);
router.patch(
  '/users/:userId/status',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('users:write'),
  validate(adminUserStatusSchema),
  adminController.updateUserStatus.bind(adminController)
);

router.get(
  '/audit-logs',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermissionAll('users:read', 'ops:read'),
  validate(adminAuditLogsQuerySchema),
  adminController.listAuditLogs.bind(adminController)
);
router.get(
  '/audit-logs.csv',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermissionAll('users:read', 'ops:read'),
  validate(adminAuditLogsQuerySchema),
  adminController.exportAuditLogsCsv.bind(adminController)
);

router.get(
  '/admin-users',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('admin:all'),
  adminController.listAdminUsers.bind(adminController)
);
router.post(
  '/admin-users',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('admin:all'),
  validate(adminAdminUserCreateSchema),
  adminController.createAdminUser.bind(adminController)
);
router.patch(
  '/admin-users/:adminUserId',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('admin:all'),
  validate(adminAdminUserUpdateSchema),
  adminController.updateAdminUser.bind(adminController)
);
router.delete(
  '/admin-users/:adminUserId',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('admin:all'),
  validate(adminAdminUserDeleteSchema),
  adminController.deleteAdminUser.bind(adminController)
);

router.get(
  '/reports/overview',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('reports:read'),
  adminController.reportOverview.bind(adminController)
);
router.get(
  '/reports/funnel',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('reports:read'),
  adminController.reportFunnel.bind(adminController)
);
router.get(
  '/reports/overview.csv',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('reports:read'),
  adminController.exportOverviewCsv.bind(adminController)
);
router.post(
  '/reports/custom',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('reports:read'),
  validate(adminCustomReportSchema),
  adminController.customReport.bind(adminController)
);
router.get(
  '/runtime/interview',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:read'),
  adminController.getInterviewRuntimeConfig.bind(adminController)
);

router.put(
  '/alerts/rules',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermissionAll('alerts:write', 'ops:execute'),
  adminController.upsertAlertRules.bind(adminController)
);
router.put(
  '/feature-flags',
  generalLimiter,
  authenticateAdmin,
  requireAdminPermission('config:write'),
  adminController.setFeatureFlags.bind(adminController)
);

export default router;

