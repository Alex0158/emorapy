/**
 * admin.routes 單元測試（mock adminController、adminAuth、validator、limiters）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockBootstrap = jest.fn();
const mockLogin = jest.fn();
const mockMe = jest.fn();
const mockHealthDetailed = jest.fn();
const mockListJobs = jest.fn();
const mockGetJobStats = jest.fn();
const mockTriggerJob = jest.fn();
const mockListConfigs = jest.fn();
const mockUpsertConfig = jest.fn();
const mockListUsers = jest.fn();
const mockGetUserDetail = jest.fn();
const mockUpdateUserStatus = jest.fn();
const mockListAuditLogs = jest.fn();
const mockExportAuditLogsCsv = jest.fn();
const mockReportOverview = jest.fn();
const mockReportFunnel = jest.fn();
const mockReportCosts = jest.fn();
const mockReportAIStreams = jest.fn();
const mockListAIStreamSessions = jest.fn();
const mockGetAIStreamDetail = jest.fn();
const mockExportOverviewCsv = jest.fn();
const mockCustomReport = jest.fn();
const mockListNotifications = jest.fn();
const mockCancelNotification = jest.fn();
const mockUpsertAlertRules = jest.fn();
const mockSetFeatureFlags = jest.fn();
const mockGetInterviewRuntimeConfig = jest.fn();
const mockListAdminUsers = jest.fn();
const mockCreateAdminUser = jest.fn();
const mockUpdateAdminUser = jest.fn();
const mockDeleteAdminUser = jest.fn();

jest.mock('../../../src/controllers/admin.controller', () => ({
  adminController: {
    bootstrap: (req: unknown, res: unknown, next: unknown) => mockBootstrap(req, res, next),
    login: (req: unknown, res: unknown, next: unknown) => mockLogin(req, res, next),
    me: (req: unknown, res: unknown, next: unknown) => mockMe(req, res, next),
    healthDetailed: (req: unknown, res: unknown, next: unknown) => mockHealthDetailed(req, res, next),
    listJobs: (req: unknown, res: unknown, next: unknown) => mockListJobs(req, res, next),
    getJobStats: (req: unknown, res: unknown, next: unknown) => mockGetJobStats(req, res, next),
    triggerJob: (req: unknown, res: unknown, next: unknown) => mockTriggerJob(req, res, next),
    listConfigs: (req: unknown, res: unknown, next: unknown) => mockListConfigs(req, res, next),
    upsertConfig: (req: unknown, res: unknown, next: unknown) => mockUpsertConfig(req, res, next),
    listUsers: (req: unknown, res: unknown, next: unknown) => mockListUsers(req, res, next),
    getUserDetail: (req: unknown, res: unknown, next: unknown) => mockGetUserDetail(req, res, next),
    updateUserStatus: (req: unknown, res: unknown, next: unknown) => mockUpdateUserStatus(req, res, next),
    listAuditLogs: (req: unknown, res: unknown, next: unknown) => mockListAuditLogs(req, res, next),
    exportAuditLogsCsv: (req: unknown, res: unknown, next: unknown) => mockExportAuditLogsCsv(req, res, next),
    reportOverview: (req: unknown, res: unknown, next: unknown) => mockReportOverview(req, res, next),
    reportFunnel: (req: unknown, res: unknown, next: unknown) => mockReportFunnel(req, res, next),
    reportCosts: (req: unknown, res: unknown, next: unknown) => mockReportCosts(req, res, next),
    reportAIStreams: (req: unknown, res: unknown, next: unknown) => mockReportAIStreams(req, res, next),
    listAIStreamSessions: (req: unknown, res: unknown, next: unknown) => mockListAIStreamSessions(req, res, next),
    getAIStreamDetail: (req: unknown, res: unknown, next: unknown) => mockGetAIStreamDetail(req, res, next),
    exportOverviewCsv: (req: unknown, res: unknown, next: unknown) => mockExportOverviewCsv(req, res, next),
    customReport: (req: unknown, res: unknown, next: unknown) => mockCustomReport(req, res, next),
    listNotifications: (req: unknown, res: unknown, next: unknown) => mockListNotifications(req, res, next),
    cancelNotification: (req: unknown, res: unknown, next: unknown) => mockCancelNotification(req, res, next),
    upsertAlertRules: (req: unknown, res: unknown, next: unknown) => mockUpsertAlertRules(req, res, next),
    setFeatureFlags: (req: unknown, res: unknown, next: unknown) => mockSetFeatureFlags(req, res, next),
    getInterviewRuntimeConfig: (req: unknown, res: unknown, next: unknown) => mockGetInterviewRuntimeConfig(req, res, next),
    listAdminUsers: (req: unknown, res: unknown, next: unknown) => mockListAdminUsers(req, res, next),
    createAdminUser: (req: unknown, res: unknown, next: unknown) => mockCreateAdminUser(req, res, next),
    updateAdminUser: (req: unknown, res: unknown, next: unknown) => mockUpdateAdminUser(req, res, next),
    deleteAdminUser: (req: unknown, res: unknown, next: unknown) => mockDeleteAdminUser(req, res, next),
  },
}));

jest.mock('../../../src/middleware/adminAuth', () => ({
  authenticateAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdminPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdminPermissionAll: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../src/middleware/rateLimiter', () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import adminRouter from '../../../src/routes/admin.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', adminRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendCreated = (res: any, body: unknown) => res.status(201).json(body);

describe('admin.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBootstrap.mockImplementation((_req: unknown, res: unknown) => sendCreated(res, { success: true, data: { id: 'a1' } }));
    mockLogin.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { token: 't' } }));
    mockMe.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { admin: {} } }));
    mockHealthDetailed.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
    mockListJobs.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { jobs: [] } }));
    mockGetJobStats.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { perJob: [] } }));
    mockTriggerJob.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { status: 'queued' } }));
    mockListConfigs.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { items: [] } }));
    mockUpsertConfig.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { item: {} } }));
    mockListUsers.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { items: [] } }));
    mockGetUserDetail.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { user: {} } }));
    mockUpdateUserStatus.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { user: {} } }));
    mockListAuditLogs.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { items: [] } }));
    mockExportAuditLogsCsv.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true }));
    mockReportOverview.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
    mockReportFunnel.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
    mockReportCosts.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
    mockReportAIStreams.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
    mockListAIStreamSessions.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { items: [], total: 0 } }));
    mockGetAIStreamDetail.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { session: null, events: [] } }));
    mockExportOverviewCsv.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true }));
    mockCustomReport.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
    mockListNotifications.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { items: [], total: 0 } }));
    mockCancelNotification.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { notification: {} } }));
    mockUpsertAlertRules.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { item: {} } }));
    mockSetFeatureFlags.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { item: {} } }));
    mockGetInterviewRuntimeConfig.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { runtime: {} } }));
    mockListAdminUsers.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { items: [] } }));
    mockCreateAdminUser.mockImplementation((_req: unknown, res: unknown) => sendCreated(res, { success: true, data: { item: {} } }));
    mockUpdateAdminUser.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { item: {} } }));
    mockDeleteAdminUser.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: { item: {} } }));
  });

  it('POST /bootstrap 應調用 bootstrap 並返回 201', async () => {
    const app = createApp();
    const res = await request(app).post('/bootstrap').send({ email: 'admin@test.com', password: 'Password1234', name: 'Admin' });
    expect(res.status).toBe(201);
    expect(mockBootstrap).toHaveBeenCalled();
  });

  it('POST /login 應調用 login 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/login').send({ email: 'admin@test.com', password: 'Password1234' });
    expect(res.status).toBe(200);
    expect(mockLogin).toHaveBeenCalled();
  });

  it('GET /jobs 應調用 listJobs', async () => {
    const app = createApp();
    const res = await request(app).get('/jobs');
    expect(res.status).toBe(200);
    expect(mockListJobs).toHaveBeenCalled();
  });

  it('GET /jobs 無日誌時應返回 jobs 空陣列（F10 邊界）', async () => {
    mockListJobs.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { jobs: [] } })
    );
    const app = createApp();
    const res = await request(app).get('/jobs');
    expect(res.status).toBe(200);
    expect(res.body.data.jobs).toEqual([]);
    expect(mockListJobs).toHaveBeenCalled();
  });

  it('POST /jobs/:jobKey/trigger 應調用 triggerJob', async () => {
    const app = createApp();
    const res = await request(app).post('/jobs/cleanup_expired_sessions/trigger');
    expect(res.status).toBe(200);
    expect(mockTriggerJob).toHaveBeenCalled();
  });

  it('GET /jobs/stats 應調用 getJobStats', async () => {
    const app = createApp();
    const res = await request(app).get('/jobs/stats?days=7');
    expect(res.status).toBe(200);
    expect(mockGetJobStats).toHaveBeenCalled();
  });

  it('GET /configs 無配置時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
    mockListConfigs.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { items: [], total: 0, limit: 20, offset: 0 } })
    );
    const app = createApp();
    const res = await request(app).get('/configs');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(mockListConfigs).toHaveBeenCalled();
  });

  it('PUT /configs 應調用 upsertConfig', async () => {
    const app = createApp();
    const res = await request(app).put('/configs').send({ key: 'jobs.enabled', value: true });
    expect(res.status).toBe(200);
    expect(mockUpsertConfig).toHaveBeenCalled();
  });

  it('GET /runtime/interview 應調用 getInterviewRuntimeConfig', async () => {
    const app = createApp();
    const res = await request(app).get('/runtime/interview');
    expect(res.status).toBe(200);
    expect(mockGetInterviewRuntimeConfig).toHaveBeenCalled();
  });

  it('GET /users 無用戶時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
    mockListUsers.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { items: [], total: 0, limit: 20, offset: 0 } })
    );
    const app = createApp();
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(mockListUsers).toHaveBeenCalled();
  });

  it('GET /users/:userId 應調用 getUserDetail', async () => {
    const app = createApp();
    const res = await request(app).get('/users/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(200);
    expect(mockGetUserDetail).toHaveBeenCalled();
  });

  it('GET /audit-logs 無審計時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
    mockListAuditLogs.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { items: [], total: 0, limit: 20, offset: 0 } })
    );
    const app = createApp();
    const res = await request(app).get('/audit-logs');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(mockListAuditLogs).toHaveBeenCalled();
  });

  it('GET /audit-logs.csv 應調用 exportAuditLogsCsv', async () => {
    const app = createApp();
    const res = await request(app).get('/audit-logs.csv');
    expect(res.status).toBe(200);
    expect(mockExportAuditLogsCsv).toHaveBeenCalled();
  });

  it('GET /reports/costs 應調用 reportCosts', async () => {
    const app = createApp();
    const res = await request(app).get('/reports/costs');
    expect(res.status).toBe(200);
    expect(mockReportCosts).toHaveBeenCalled();
  });

  it('GET /reports/ai-streams 應調用 reportAIStreams', async () => {
    const app = createApp();
    const res = await request(app).get('/reports/ai-streams');
    expect(res.status).toBe(200);
    expect(mockReportAIStreams).toHaveBeenCalled();
  });

  it('GET /reports/ai-streams/sessions 應調用 listAIStreamSessions', async () => {
    const app = createApp();
    const res = await request(app).get('/reports/ai-streams/sessions?source=all&limit=20');
    expect(res.status).toBe(200);
    expect(mockListAIStreamSessions).toHaveBeenCalled();
  });

  it('GET /reports/ai-streams/sessions/:streamId 應調用 getAIStreamDetail', async () => {
    const app = createApp();
    const res = await request(app).get('/reports/ai-streams/sessions/stream-1?source=archive');
    expect(res.status).toBe(200);
    expect(mockGetAIStreamDetail).toHaveBeenCalled();
  });

  it('GET /notifications 應調用 listNotifications', async () => {
    const app = createApp();
    const res = await request(app).get('/notifications?status=pending&limit=20');
    expect(res.status).toBe(200);
    expect(mockListNotifications).toHaveBeenCalled();
  });

  it('POST /notifications/:notificationId/cancel 應調用 cancelNotification', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/notifications/11111111-1111-4111-8111-111111111111/cancel')
      .send({ reason: 'duplicate' });
    expect(res.status).toBe(200);
    expect(mockCancelNotification).toHaveBeenCalled();
  });

  it('GET /admin-users 應調用 listAdminUsers', async () => {
    const app = createApp();
    const res = await request(app).get('/admin-users');
    expect(res.status).toBe(200);
    expect(mockListAdminUsers).toHaveBeenCalled();
  });

  it('GET /admin-users 無管理員時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
    mockListAdminUsers.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { items: [], total: 0, limit: 20, offset: 0 } })
    );
    const app = createApp();
    const res = await request(app).get('/admin-users');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(mockListAdminUsers).toHaveBeenCalled();
  });

  it('DELETE /admin-users/:adminUserId 應調用 deleteAdminUser', async () => {
    const app = createApp();
    const res = await request(app).delete('/admin-users/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(200);
    expect(mockDeleteAdminUser).toHaveBeenCalled();
  });

  describe('成功回應結構邊界（F10 data.xxx）', () => {
    it('bootstrap 成功時應返回 data（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/bootstrap')
        .send({ email: 'admin@test.com', password: 'Password1234', name: 'Admin' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('login 成功時應返回 data.token（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).post('/login').send({ email: 'admin@test.com', password: 'Password1234' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
    });

    it('me 成功時應返回 data.admin（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/me');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('admin');
    });

    it('listJobs 成功時應返回 data.jobs（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/jobs');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('jobs');
      expect(Array.isArray(res.body.data.jobs)).toBe(true);
    });

    it('listConfigs 成功時應返回 data.items（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/configs');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('getUserDetail 成功時應返回 data.user（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/users/11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
    });

    it('listAdminUsers 成功時應返回 data.items（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/admin-users');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('listUsers 成功時應返回 data.items（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/users');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('listAuditLogs 成功時應返回 data.items（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/audit-logs');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('triggerJob 成功時應返回 data.status（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).post('/jobs/cleanup_expired_sessions/trigger');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
    });

    it('getJobStats 成功時應返回 data.perJob（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/jobs/stats?days=7');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('perJob');
      expect(Array.isArray(res.body.data.perJob)).toBe(true);
    });

    it('upsertConfig 成功時應返回 data.item（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).put('/configs').send({ key: 'jobs.enabled', value: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('item');
    });

    it('updateUserStatus 成功時應返回 data.user（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).patch('/users/11111111-1111-1111-1111-111111111111/status').send({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
    });

    it('getInterviewRuntimeConfig 成功時應返回 data（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/runtime/interview');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('createAdminUser 成功時應返回 data.item（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/admin-users')
        .send({ email: 'new@test.com', password: 'Password1234', name: 'New Admin', roleKey: 'admin' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('item');
    });

    it('updateAdminUser 成功時應返回 data.item（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .patch('/admin-users/11111111-1111-1111-1111-111111111111')
        .send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('item');
    });

    it('deleteAdminUser 成功時應返回 data.item（F10 邊界）', async () => {
      const app = createApp();
      const res = await request(app).delete('/admin-users/11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('item');
    });
  });

  describe('錯誤傳遞', () => {
    it('login 調用 next(error) 時應返回 500', async () => {
      mockLogin.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('login failed'));
      });
      const app = createApp();
      const res = await request(app).post('/login').send({ email: 'admin@test.com', password: 'Password1234' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'login failed' });
    });

    it('me 調用 next(error) 時應返回 500', async () => {
      mockMe.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('me failed'));
      });
      const app = createApp();
      const res = await request(app).get('/me');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'me failed' });
    });

    it('bootstrap 調用 next(error) 時應返回 500', async () => {
      mockBootstrap.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('bootstrap failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/bootstrap')
        .send({ email: 'admin@test.com', password: 'Password1234', name: 'Admin' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'bootstrap failed' });
    });

    it('listJobs 調用 next(error) 時應返回 500', async () => {
      mockListJobs.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('jobs load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/jobs');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'jobs load failed' });
    });

    it('listConfigs 調用 next(error) 時應返回 500', async () => {
      mockListConfigs.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('configs load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/configs');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'configs load failed' });
    });

    it('listUsers 調用 next(error) 時應返回 500', async () => {
      mockListUsers.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('users load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/users');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'users load failed' });
    });

    it('listAdminUsers 調用 next(error) 時應返回 500', async () => {
      mockListAdminUsers.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('admin users load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/admin-users');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'admin users load failed' });
    });

    it('listAuditLogs 調用 next(error) 時應返回 500', async () => {
      mockListAuditLogs.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('audit logs load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/audit-logs');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'audit logs load failed' });
    });

    it('triggerJob 調用 next(error) 時應返回 500', async () => {
      mockTriggerJob.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('trigger failed'));
      });
      const app = createApp();
      const res = await request(app).post('/jobs/cleanup_expired_sessions/trigger');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'trigger failed' });
    });

    it('getJobStats 調用 next(error) 時應返回 500', async () => {
      mockGetJobStats.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('stats failed'));
      });
      const app = createApp();
      const res = await request(app).get('/jobs/stats?days=7');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'stats failed' });
    });

    it('upsertConfig 調用 next(error) 時應返回 500', async () => {
      mockUpsertConfig.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('upsert failed'));
      });
      const app = createApp();
      const res = await request(app).put('/configs').send({ key: 'jobs.enabled', value: true });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'upsert failed' });
    });

    it('getUserDetail 調用 next(error) 時應返回 500', async () => {
      mockGetUserDetail.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('user detail failed'));
      });
      const app = createApp();
      const res = await request(app).get('/users/11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'user detail failed' });
    });

    it('updateUserStatus 調用 next(error) 時應返回 500', async () => {
      mockUpdateUserStatus.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('update status failed'));
      });
      const app = createApp();
      const res = await request(app).patch('/users/11111111-1111-1111-1111-111111111111/status').send({ status: 'active' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'update status failed' });
    });

    it('createAdminUser 調用 next(error) 時應返回 500', async () => {
      mockCreateAdminUser.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('create admin failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/admin-users')
        .send({ email: 'new@test.com', password: 'Password1234', name: 'New Admin', roleKey: 'admin' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'create admin failed' });
    });

    it('updateAdminUser 調用 next(error) 時應返回 500', async () => {
      mockUpdateAdminUser.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('update admin failed'));
      });
      const app = createApp();
      const res = await request(app)
        .patch('/admin-users/11111111-1111-1111-1111-111111111111')
        .send({ name: 'Updated' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'update admin failed' });
    });

    it('deleteAdminUser 調用 next(error) 時應返回 500', async () => {
      mockDeleteAdminUser.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('delete admin failed'));
      });
      const app = createApp();
      const res = await request(app).delete('/admin-users/11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'delete admin failed' });
    });

    it('healthDetailed 調用 next(error) 時應返回 500', async () => {
      mockHealthDetailed.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('health failed'));
      });
      const app = createApp();
      const res = await request(app).get('/health/detailed');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'health failed' });
    });

    it('exportAuditLogsCsv 調用 next(error) 時應返回 500', async () => {
      mockExportAuditLogsCsv.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('export csv failed'));
      });
      const app = createApp();
      const res = await request(app).get('/audit-logs.csv');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'export csv failed' });
    });

    it('reportOverview 調用 next(error) 時應返回 500', async () => {
      mockReportOverview.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('overview failed'));
      });
      const app = createApp();
      const res = await request(app).get('/reports/overview');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'overview failed' });
    });

    it('reportFunnel 調用 next(error) 時應返回 500', async () => {
      mockReportFunnel.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('funnel failed'));
      });
      const app = createApp();
      const res = await request(app).get('/reports/funnel');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'funnel failed' });
    });

    it('reportCosts 調用 next(error) 時應返回 500', async () => {
      mockReportCosts.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('costs failed'));
      });
      const app = createApp();
      const res = await request(app).get('/reports/costs');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'costs failed' });
    });

    it('reportAIStreams 調用 next(error) 時應返回 500', async () => {
      mockReportAIStreams.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('ai streams failed'));
      });
      const app = createApp();
      const res = await request(app).get('/reports/ai-streams');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'ai streams failed' });
    });

    it('exportOverviewCsv 調用 next(error) 時應返回 500', async () => {
      mockExportOverviewCsv.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('export overview csv failed'));
      });
      const app = createApp();
      const res = await request(app).get('/reports/overview.csv');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'export overview csv failed' });
    });

    it('customReport 調用 next(error) 時應返回 500', async () => {
      mockCustomReport.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('custom report failed'));
      });
      const app = createApp();
      const res = await request(app).post('/reports/custom').send({ type: 'overview' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'custom report failed' });
    });

    it('getInterviewRuntimeConfig 調用 next(error) 時應返回 500', async () => {
      mockGetInterviewRuntimeConfig.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('runtime config failed'));
      });
      const app = createApp();
      const res = await request(app).get('/runtime/interview');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'runtime config failed' });
    });

    it('upsertAlertRules 調用 next(error) 時應返回 500', async () => {
      mockUpsertAlertRules.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('alert rules failed'));
      });
      const app = createApp();
      const res = await request(app).put('/alerts/rules').send({ rules: [] });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'alert rules failed' });
    });

    it('setFeatureFlags 調用 next(error) 時應返回 500', async () => {
      mockSetFeatureFlags.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('feature flags failed'));
      });
      const app = createApp();
      const res = await request(app).put('/feature-flags').send({ flags: {} });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'feature flags failed' });
    });
  });
});
