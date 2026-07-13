import { Router } from 'express';
import type {
  CreateChatAnalysisRequestInput,
  CreateContextCapsuleInput,
  DecideChatAnalysisRequestInput,
  GrantContextAuthorizationInput,
  RevokeContextAuthorizationInput,
} from '@emorapy/contracts/chat';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import { ContextCapsuleService, contextCapsuleService } from '../services/context-capsule.service';
import {
  ChatAnalysisRequestService,
  chatAnalysisRequestService,
} from '../services/chat-analysis-request.service';
import {
  ChatContextReadService,
  chatContextReadService,
} from '../services/chat-context-read.service';
import {
  chatAnalysisRequestParamsSchema,
  chatContextAuthorizationParamsSchema,
  chatContextCapsuleParamsSchema,
  chatContextRoomParamsSchema,
  createChatAnalysisRequestSchema,
  createContextCapsuleSchema,
  decideChatAnalysisRequestSchema,
  grantContextAuthorizationSchema,
  revokeChatAnalysisApprovalSchema,
  revokeContextAuthorizationSchema,
} from '../utils/chat-context-validation';
import { getChatActorFromRequest } from './chat-route-actor';

type ContextCapsuleRuntime = Pick<
  ContextCapsuleService,
  'createDraft' | 'reviseDraft' | 'grantAuthorization' | 'revokeAuthorization'
>;

type ChatAnalysisRuntime = Pick<
  ChatAnalysisRequestService,
  'createRequest' | 'decideRequest' | 'revokeApproval' | 'submitRequest'
>;

type ChatContextReadRuntime = Pick<
  ChatContextReadService,
  'listOwnCapsules' | 'listAnalysisRequests'
>;

export type ChatContextRouterDependencies = {
  capsuleService: ContextCapsuleRuntime;
  analysisService: ChatAnalysisRuntime;
  readService: ChatContextReadRuntime;
};

export function createChatContextRouter(
  dependencies: ChatContextRouterDependencies = {
    capsuleService: contextCapsuleService,
    analysisService: chatAnalysisRequestService,
    readService: chatContextReadService,
  }
) {
  const router = Router();

  router.get(
    '/rooms/:roomId/context-capsules',
    generalLimiter,
    optionalAuthenticate,
    validate(chatContextRoomParamsSchema),
    async (req, res, next) => {
      try {
        const capsules = await dependencies.readService.listOwnCapsules(
          req.params.roomId,
          getChatActorFromRequest(req)
        );
        res.json({ success: true, data: { capsules } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/rooms/:roomId/analysis-requests',
    generalLimiter,
    optionalAuthenticate,
    validate(chatContextRoomParamsSchema),
    async (req, res, next) => {
      try {
        const analysisRequests = await dependencies.readService.listAnalysisRequests(
          req.params.roomId,
          getChatActorFromRequest(req)
        );
        res.json({ success: true, data: { analysis_requests: analysisRequests } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/context-capsules',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatContextRoomParamsSchema, ...createContextCapsuleSchema }),
    async (req, res, next) => {
      try {
        const capsule = await dependencies.capsuleService.createDraft(
          req.params.roomId,
          getChatActorFromRequest(req),
          req.body as CreateContextCapsuleInput
        );
        res.status(201).json({ success: true, data: { capsule } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/context-capsules/:capsuleId/revisions',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatContextCapsuleParamsSchema, ...createContextCapsuleSchema }),
    async (req, res, next) => {
      try {
        const capsule = await dependencies.capsuleService.reviseDraft(
          req.params.roomId,
          req.params.capsuleId,
          getChatActorFromRequest(req),
          req.body as CreateContextCapsuleInput
        );
        res.status(201).json({ success: true, data: { capsule } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/context-capsules/:capsuleId/authorizations',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatContextCapsuleParamsSchema, ...grantContextAuthorizationSchema }),
    async (req, res, next) => {
      try {
        const authorization = await dependencies.capsuleService.grantAuthorization(
          req.params.roomId,
          req.params.capsuleId,
          getChatActorFromRequest(req),
          req.body as GrantContextAuthorizationInput
        );
        res.status(201).json({ success: true, data: { authorization } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/context-authorizations/:authorizationId/revoke',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatContextAuthorizationParamsSchema, ...revokeContextAuthorizationSchema }),
    async (req, res, next) => {
      try {
        const authorization = await dependencies.capsuleService.revokeAuthorization(
          req.params.roomId,
          req.params.authorizationId,
          getChatActorFromRequest(req),
          req.body as RevokeContextAuthorizationInput
        );
        res.json({ success: true, data: { authorization } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/analysis-requests',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatContextRoomParamsSchema, ...createChatAnalysisRequestSchema }),
    async (req, res, next) => {
      try {
        const analysisRequest = await dependencies.analysisService.createRequest(
          req.params.roomId,
          getChatActorFromRequest(req),
          req.body as CreateChatAnalysisRequestInput
        );
        res.status(201).json({ success: true, data: { analysis_request: analysisRequest } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/analysis-requests/:requestId/decision',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatAnalysisRequestParamsSchema, ...decideChatAnalysisRequestSchema }),
    async (req, res, next) => {
      try {
        const approval = await dependencies.analysisService.decideRequest(
          req.params.roomId,
          req.params.requestId,
          getChatActorFromRequest(req),
          req.body as DecideChatAnalysisRequestInput
        );
        res.status(201).json({ success: true, data: { approval } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/analysis-requests/:requestId/approval/revoke',
    generalLimiter,
    optionalAuthenticate,
    validate({ ...chatAnalysisRequestParamsSchema, ...revokeChatAnalysisApprovalSchema }),
    async (req, res, next) => {
      try {
        const approval = await dependencies.analysisService.revokeApproval(
          req.params.roomId,
          req.params.requestId,
          getChatActorFromRequest(req),
          req.body as { selection_hash: string; policy_version: string }
        );
        res.json({ success: true, data: { approval } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/rooms/:roomId/analysis-requests/:requestId/submit',
    generalLimiter,
    optionalAuthenticate,
    validate(chatAnalysisRequestParamsSchema),
    async (req, res, next) => {
      try {
        const analysisRequest = await dependencies.analysisService.submitRequest(
          req.params.roomId,
          req.params.requestId,
          getChatActorFromRequest(req)
        );
        res.json({ success: true, data: { analysis_request: analysisRequest } });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createChatContextRouter();
