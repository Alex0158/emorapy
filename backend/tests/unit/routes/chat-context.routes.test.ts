import express from 'express';
import request from 'supertest';
import {
  createChatContextRouter,
  type ChatContextRouterDependencies,
} from '../../../src/routes/chat-context.routes';

const ROOM_ID = '550e8400-e29b-41d4-a716-446655440000';
const CHANNEL_ID = '550e8400-e29b-41d4-a716-446655440001';
const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440002';
const CAPSULE_ID = '550e8400-e29b-41d4-a716-446655440003';
const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440004';
const SESSION_ID = 'guest_1700000000000_abcdefghijklmnop';

function createDependencies() {
  return {
    capsuleService: {
      createDraft: jest.fn().mockResolvedValue({ id: CAPSULE_ID }),
      reviseDraft: jest.fn().mockResolvedValue({ id: CAPSULE_ID, version: 2 }),
      grantAuthorization: jest.fn().mockResolvedValue({ id: 'authorization-1' }),
      revokeAuthorization: jest
        .fn()
        .mockResolvedValue({ id: 'authorization-1', revoked_at: new Date() }),
    },
    analysisService: {
      createRequest: jest.fn().mockResolvedValue({ id: REQUEST_ID }),
      decideRequest: jest.fn().mockResolvedValue({ id: 'approval-1' }),
      revokeApproval: jest.fn().mockResolvedValue({ id: 'approval-1', revoked_at: new Date() }),
      submitRequest: jest.fn().mockResolvedValue({ id: REQUEST_ID, status: 'submitted' }),
    },
    readService: {
      listOwnCapsules: jest
        .fn()
        .mockResolvedValue([{ id: CAPSULE_ID, authorizations: [{ id: 'authorization-1' }] }]),
      listAnalysisRequests: jest.fn().mockResolvedValue([
        {
          id: REQUEST_ID,
          participant_approvals: [{ id: 'approval-1' }],
          source_previews: { messages: [], capsules: [] },
        },
      ]),
    },
  };
}

function createApp(dependencies: ReturnType<typeof createDependencies>) {
  const app = express();
  app.use(express.json());
  app.use(
    '/chat',
    createChatContextRouter(dependencies as unknown as ChatContextRouterDependencies)
  );
  app.use(
    (
      error: Error & { statusCode?: number; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(error.statusCode ?? 500).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
  );
  return app;
}

describe('chat-context.routes', () => {
  it('lists only actor-scoped capsules through the read runtime', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await request(app)
      .get(`/chat/rooms/${ROOM_ID}/context-capsules`)
      .set('x-session-id', SESSION_ID);

    expect(response.status).toBe(200);
    expect(dependencies.readService.listOwnCapsules).toHaveBeenCalledWith(ROOM_ID, {
      userId: undefined,
      sessionId: SESSION_ID,
    });
    expect(response.body.data.capsules[0].authorizations[0].id).toBe('authorization-1');
  });

  it('lists participant-scoped analysis requests with source previews', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await request(app)
      .get(`/chat/rooms/${ROOM_ID}/analysis-requests`)
      .set('x-session-id', SESSION_ID);

    expect(response.status).toBe(200);
    expect(dependencies.readService.listAnalysisRequests).toHaveBeenCalledWith(ROOM_ID, {
      userId: undefined,
      sessionId: SESSION_ID,
    });
    expect(response.body.data.analysis_requests[0].source_previews).toEqual({
      messages: [],
      capsules: [],
    });
  });

  it('forwards capsule creation with the canonical session actor', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);
    const body = {
      source_channel_id: CHANNEL_ID,
      source_message_ids: [MESSAGE_ID],
      summary: 'safe summary',
    };

    const response = await request(app)
      .post(`/chat/rooms/${ROOM_ID}/context-capsules`)
      .set('x-session-id', SESSION_ID)
      .send(body);

    expect(response.status).toBe(201);
    expect(dependencies.capsuleService.createDraft).toHaveBeenCalledWith(
      ROOM_ID,
      { userId: undefined, sessionId: SESSION_ID },
      body
    );
  });

  it('routes exact analysis decisions without accepting a participant ID', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);
    const body = {
      selection_hash: 'a'.repeat(64),
      decision: 'approved',
      policy_version: '2026-07-12.v1',
    };

    const response = await request(app)
      .post(`/chat/rooms/${ROOM_ID}/analysis-requests/${REQUEST_ID}/decision`)
      .set('x-session-id', SESSION_ID)
      .send(body);

    expect(response.status).toBe(201);
    expect(dependencies.analysisService.decideRequest).toHaveBeenCalledWith(
      ROOM_ID,
      REQUEST_ID,
      { userId: undefined, sessionId: SESSION_ID },
      body
    );
    expect(response.body.data.approval.id).toBe('approval-1');
  });

  it('exposes submit as a separate exact-consent transition', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await request(app)
      .post(`/chat/rooms/${ROOM_ID}/analysis-requests/${REQUEST_ID}/submit`)
      .set('x-session-id', SESSION_ID)
      .send({});

    expect(response.status).toBe(200);
    expect(dependencies.analysisService.submitRequest).toHaveBeenCalledWith(ROOM_ID, REQUEST_ID, {
      userId: undefined,
      sessionId: SESSION_ID,
    });
  });

  it('fails before service execution when header and query sessions conflict', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await request(app)
      .post(`/chat/rooms/${ROOM_ID}/analysis-requests/${REQUEST_ID}/submit`)
      .query({ session_id: 'guest_1700000000000_qrstuvwxyzabcdef' })
      .set('x-session-id', SESSION_ID)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_SESSION_ID');
    expect(dependencies.analysisService.submitRequest).not.toHaveBeenCalled();
  });

  it('rejects malformed capsule input before touching runtime services', async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await request(app)
      .post(`/chat/rooms/${ROOM_ID}/context-capsules`)
      .set('x-session-id', SESSION_ID)
      .send({ source_channel_id: CHANNEL_ID, source_message_ids: [], summary: '' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(dependencies.capsuleService.createDraft).not.toHaveBeenCalled();
  });
});
