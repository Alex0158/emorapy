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
const mockExportOverviewCsv = jest.fn();
const mockCustomReport = jest.fn();
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
    exportOverviewCsv: (req: unknown, res: unknown, next: unknown) => mockExportOverviewCsv(req, res, next),
    customReport: (req: unknown, res: unknown, next: unknown) => mockCustomReport(req, res, next),
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
    mockExportOverviewCsv.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true }));
    mockCustomReport.mockImplementation((_req: unknown, res: unknown) => sendJson(res, { success: true, data: {} }));
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

  it('GET /users/:userId 應調用 getUserDetail', async () => {
    const app = createApp();
    const res = await request(app).get('/users/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(200);
    expect(mockGetUserDetail).toHaveBeenCalled();
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

  it('GET /admin-users 應調用 listAdminUsers', async () => {
    const app = createApp();
    const res = await request(app).get('/admin-users');
    expect(res.status).toBe(200);
    expect(mockListAdminUsers).toHaveBeenCalled();
  });

  it('DELETE /admin-users/:adminUserId 應調用 deleteAdminUser', async () => {
    const app = createApp();
    const res = await request(app).delete('/admin-users/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(200);
    expect(mockDeleteAdminUser).toHaveBeenCalled();
  });
});

