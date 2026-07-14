#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const failures = [];

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing required file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireNeedles(relativePath, label, needles) {
  const source = readText(relativePath);
  if (!source) return;
  for (const needle of needles) {
    if (!source.includes(needle)) {
      failures.push(`${label} missing "${needle}" in ${relativePath}`);
    }
  }
}

function requireAnyNeedle(relativePath, label, needles) {
  const source = readText(relativePath);
  if (!source) return;
  if (!needles.some((needle) => source.includes(needle))) {
    failures.push(`${label} missing one of ${needles.map((needle) => `"${needle}"`).join(', ')} in ${relativePath}`);
  }
}

const contracts = [
  {
    id: 'm0_foundation',
    files: [
      {
        path: 'mobile/app/_layout.tsx',
        label: 'root App shell',
        needles: [
          '<AppProviders>',
          '<DeepLinkLandingHandler />',
          '<NotificationLandingHandler />',
          '<Stack.Screen name="(public)"',
          '<Stack.Screen name="(app)"',
          '<Stack.Screen name="modal"',
        ],
      },
      {
        path: 'mobile/src/providers/AppProviders.tsx',
        label: 'App provider shell',
        needles: [
          '<QueryClientProvider',
          '<SafeAreaProvider>',
          '<AuthSessionBootstrap />',
          '<ObservabilityBootstrap />',
        ],
      },
      {
        path: 'mobile/src/platform/api/client.ts',
        label: 'App API adapter',
        needles: [
          "headers.set('X-Request-Id'",
          "headers.set('X-Locale'",
          "headers.set('X-Session-Id'",
          "headers.set('Authorization'",
          "headers.set('Content-Type', 'multipart/form-data')",
          'readApiResponseError',
          'statusToRequestCode',
        ],
      },
      {
        path: 'mobile/src/platform/storage/secureStore.ts',
        label: 'SecureStore boundary',
        needles: [
          'tokenStorage',
          'sessionStorage',
          'getDeviceMetadata',
          'setDeviceMetadata',
          'pendingLandingStorage',
          'SecureStore.setItemAsync',
        ],
      },
    ],
  },
  {
    id: 'm1_quick_auth',
    files: [
      {
        path: 'mobile/app/(public)/quick/index.tsx',
        label: 'Quick solo screen',
        needles: [
          'testID="quick.screen"',
          'testID="quick.plaintiff.input"',
          'testID="quick.defendant.input"',
          'testID="quick.submit"',
          'getOrCreateQuickSession',
          'm1Api.quick.createQuickCase',
          'sessionStorage.setSessionId',
          'router.push(`/quick/result?caseId=',
        ],
      },
      {
        path: 'mobile/app/(public)/quick/collaborative.tsx',
        label: 'Quick collaborative handoff screen',
        needles: [
          'testID="quick.collaborative.screen"',
          'm1Api.quick.createCollaborativeCase',
          'sessionStorage.setSessionId',
        ],
      },
      {
        path: 'mobile/app/(public)/quick/result.tsx',
        label: 'Quick result claim screen',
        needles: [
          'testID="quick.result.screen"',
          'm1Api.quick.getCase',
          'm1Api.quick.getCaseBySessionId',
          'href="/auth',
        ],
      },
      {
        path: 'mobile/app/(public)/auth/index.tsx',
        label: 'Auth and claim-session screen',
        needles: [
          'testID="auth.screen"',
          'testID="auth.submit"',
          'useAuthFlow',
        ],
      },
      {
        path: 'mobile/src/features/m1/useAuthFlow.ts',
        label: 'Proof-first Auth and claim-session state machine',
        needles: [
          'm1Api.auth.login',
          'm1Api.auth.sendVerificationCode',
          'm1Api.auth.verifyRegistrationCode',
          'm1Api.auth.verifyEmail',
          'm1Api.auth.register',
          'm1Api.auth.claimSession',
          'tokenStorage.setToken',
          'pendingLandingStorage.consumePendingHref',
          'clearAppStorageWithPushCleanup',
        ],
      },
      {
        path: 'mobile/src/features/m1/RegistrationVerificationStep.tsx',
        label: 'Proof-first registration and existing-email verification step',
        needles: [
          "root: 'auth.registration.verification'",
          "codeInput: 'auth.registration.code.input'",
          "complete: 'auth.registration.complete'",
          "resend: 'auth.registration.resend'",
          "back: 'auth.registration.back'",
          "root: 'auth.login-verification.verification'",
          "codeInput: 'auth.login-verification.code.input'",
        ],
      },
      {
        path: 'packages/api-client/src/m1.ts',
        label: 'M1 shared API client',
        needles: [
          '/sessions/quick',
          '/sessions/refresh',
          '/auth/login',
          '/auth/register',
          '/auth/claim-session',
          '/cases/quick',
          '/cases/by-session',
          '/cases/collaborative',
        ],
      },
    ],
  },
  {
    id: 'm2_profile_interview',
    files: [
      {
        path: 'mobile/app/(app)/profile/index.tsx',
        label: 'Profile shell',
        needles: [
          'testID="profile.screen"',
          'testID="profile.start-interview"',
          'testID="profile.resume-interview"',
          'testID="profile.retry-failed-interview"',
          'm2Api.psychProfile.giveConsent',
          "m2Api.interview.startSession('organic')",
          'm2Api.interview.checkResume',
        ],
      },
      {
        path: 'mobile/app/(app)/profile/interview.tsx',
        label: 'Interview streaming screen',
        needles: [
          'testID="profile.interview.screen"',
          'testID="profile.interview.message.input"',
          'testID="profile.interview.respond"',
          'testID="profile.interview.skip"',
          'testID="profile.interview.cancel"',
          'testID="profile.interview.end"',
          'connectInterviewStream',
          'useAIStreamSubscription',
          'isRecovering',
          'labelInterviewSyncProgress',
          "t('profileInterview.syncStatus')",
        ],
      },
      {
        path: 'mobile/src/i18n/catalogs/zh-TW.ts',
        label: 'Interview zh-TW copy catalog',
        needles: [
          "'profileInterview.syncStatus': '同步狀態'",
        ],
      },
      {
        path: 'mobile/src/i18n/catalogs/en-US.ts',
        label: 'Interview en-US copy catalog',
        needles: [
          "'profileInterview.syncStatus': 'Sync status'",
        ],
      },
      {
        path: 'mobile/app/(app)/profile/story.tsx',
        label: 'My Story screen',
        needles: [
          'testID="profile.story.screen"',
          'm2Api.psychProfile.getProfile',
          'm2Api.psychProfile.getFeedbackHistory',
          'm2Api.psychProfile.deleteAllData',
        ],
      },
      {
        path: 'packages/api-client/src/m2.ts',
        label: 'M2 shared API client',
        needles: [
          '/profile/me',
          '/psych-profile',
          '/psych-profile/feedback',
          '/psych-profile/consent',
          '/interview/start',
          '/interview/resume',
          '/respond',
          '/skip',
          '/cancel',
          '/end',
          '/retry',
        ],
      },
      {
        path: 'mobile/src/features/m2/api.ts',
        label: 'M2 stream adapter',
        needles: [
          "connectAIStream('interview_session'",
          'connectInterviewStream',
          'normalizeM2Error',
        ],
      },
    ],
  },
  {
    id: 'm3_chat',
    files: [
      {
        path: 'mobile/app/(app)/chat/index.tsx',
        label: 'Chat entry screen',
        needles: [
          'testID="chat.home.screen"',
          'testID="chat.home.create-room"',
          'testID="chat.home.accept-invite"',
          'm3Api.chat.createRoom',
          'm3Api.chat.acceptInvite',
          'sessionStorage.getSessionId',
        ],
      },
      {
        path: 'mobile/app/(app)/chat/invite.tsx',
        label: 'Chat invite landing screen',
        needles: [
          'testID="chat.invite.screen"',
          'testID="chat.invite.accept"',
          'testID="chat.invite.decline"',
          'm3Api.chat.acceptInvite',
          'm3Api.chat.declineInvite',
        ],
      },
      {
        path: 'mobile/app/(app)/chat/room.tsx',
        label: 'Chat room and judgment handoff screen',
        needles: [
          'testID="chat.room.screen"',
          'testID="chat.room.compose.input"',
          'testID="chat.room.send-message"',
          'testID="chat.room.create-invite"',
          'connectChatRoomStream',
          'connectChatAIStream',
          'useAIStreamSubscription',
          'labelChatAISyncProgress',
          "t('chatRoom.aiDraftStatus')",
          'm3Api.chat.listMessages',
          'm3Api.chat.listChannels',
          'm3Api.chat.sendChannelMessage',
          'm3Api.chat.getJudgmentStatus',
          'chatQueryKeys.contextPreference',
          'chatQueryKeys.contextUsageReceipts',
          'chatQueryKeys.safetyStatus',
          'sharedSafety.blocked',
          'sharedGovernanceBlocked',
        ],
      },
      {
        path: 'mobile/src/features/m3/ChatAnalysisConsentPanel.tsx',
        label: 'Chat analysis consent ledger',
        needles: [
          'testID="chat.room.request-judgment"',
          'testID="chat.room.analysis.approve"',
          'testID="chat.room.analysis.decline"',
          'testID="chat.room.analysis.revoke-approval"',
          'testID="chat.room.analysis.submit"',
          "t('chatRoom.analysis.roleAStarts')",
          'formalActionsBlocked',
        ],
      },
      {
        path: 'mobile/src/features/m3/useChatAnalysisConsent.ts',
        label: 'Chat exact-selection consent orchestration',
        needles: [
          'm3Api.chat.listAnalysisRequests',
          'm3Api.chat.createAnalysisRequest',
          'm3Api.chat.decideAnalysisRequest',
          'm3Api.chat.revokeAnalysisApproval',
          'm3Api.chat.submitAnalysisRequest',
          'm3Api.chat.requestJudgment',
        ],
      },
      {
        path: 'mobile/src/features/m3/ChatSharedContextManager.tsx',
        label: 'Chat Context Capsule lifecycle manager UI',
        needles: [
          'useChatContextCapsuleLifecycle',
          'findActiveCapsuleAuthorization',
          'getExactCapsuleSourceMessageIds',
          'shared_mediation',
          'formal_analysis_evidence',
          "kind: 'revise'",
          "kind: 'discard'",
          'chat.room.capsule.discard-confirm.',
          'formalActionsBlocked',
        ],
      },
      {
        path: 'mobile/src/features/m3/ChatContextCapsuleComposer.tsx',
        label: 'Chat Context Capsule saved-draft composer',
        needles: [
          "kind: 'create'",
          'chat.room.capsule.save-draft',
        ],
      },
      {
        path: 'mobile/src/features/m3/useChatContextCapsuleLifecycle.ts',
        label: 'Chat Context Capsule lifecycle orchestration',
        needles: [
          'm3Api.chat.createContextCapsule',
          'm3Api.chat.grantContextAuthorization',
          'm3Api.chat.revokeContextAuthorization',
          'm3Api.chat.reviseContextCapsule',
          'm3Api.chat.discardContextCapsule',
          "reason_code: 'user_revoked'",
          'chatQueryKeys.contextUsageReceipts',
        ],
      },
      {
        path: 'mobile/src/features/m3/ChatContextUsageReceipts.tsx',
        label: 'Chat low-sensitivity context usage receipts',
        needles: [
          'm3Api.chat.listContextUsageReceipts',
          'receipt.category',
          'receipt.purpose',
          'receipt.decision',
          'receipt.source_type_counts',
          'receipt.authorization_count',
          'receipt.created_at',
        ],
      },
      {
        path: 'mobile/src/features/m3/useChatRoomSafetyStatus.ts',
        label: 'Chat sanitized shared safety-status query',
        needles: [
          'm3Api.chat.getRoomSafetyStatus',
          'chatQueryKeys.safetyStatus',
          "blocked: query.isError || status !== 'open'",
        ],
      },
      {
        path: 'mobile/src/features/m3/ChatSharedSafetyStatusNotice.tsx',
        label: 'Chat generic shared safety pause notice',
        needles: [
          "state.status === 'paused'",
          "t('chatRoom.safety.sharedPaused')",
          "t('chatRoom.safety.statusUnavailable')",
        ],
      },
      {
        path: 'mobile/src/i18n/catalogs/zh-TW.ts',
        label: 'Chat room zh-TW copy catalog',
        needles: [
          "'chatRoom.aiDraftStatus': '協調草稿'",
        ],
      },
      {
        path: 'mobile/src/i18n/catalogs/en-US.ts',
        label: 'Chat room en-US copy catalog',
        needles: [
          "'chatRoom.aiDraftStatus': 'Mediator draft'",
        ],
      },
      {
        path: 'packages/api-client/src/m3.ts',
        label: 'M3 shared API client',
        needles: [
          '/chat/rooms',
          '/invites',
          '/accept',
          '/decline',
          '/messages',
          '/channels',
          '/request-judgment',
          '/judgment-status',
          '/leave',
          '/kick-b',
        ],
      },
      {
        path: 'packages/api-client/src/m3ChatContext.ts',
        label: 'M3 shared context and consent API client',
        needles: [
          '/analysis-requests',
          '/approval/revoke',
          '/context-authorizations/',
          'revokeContextAuthorization',
          'revokeAnalysisApproval',
        ],
      },
      {
        path: 'mobile/src/features/m3/api.ts',
        label: 'M3 stream adapter',
        needles: [
          'connectAIStream(scopeType, scopeId',
          'connectChatAIStream',
          'connectChatRoomStream',
        ],
      },
    ],
  },
  {
    id: 'm4_formal_case_repair',
    files: [
      {
        path: 'mobile/app/(app)/case/index.tsx',
        label: 'Formal case screen',
        needles: [
          'testID="case.screen"',
          'testID="case.create-pairing"',
          'testID="case.join-pairing"',
          'testID="case.create-case"',
          'testID="case.accept-judgment"',
          'testID="case.repair"',
          'testID="case.evidence-safety.no-blocked.toggle"',
          'm4Api.pairing.create',
          'm4Api.pairing.join',
          'm4Api.cases.create',
          'm4Api.cases.submit',
          'm4Api.judgment.generate',
          'm4Api.judgment.accept',
          'pickImage',
          'createEvidenceUploadFormData',
          'm5Api.media.uploadEvidence',
        ],
      },
      {
        path: 'mobile/app/(app)/repair/index.tsx',
        label: 'Repair journey screen',
        needles: [
          'testID="repair.screen"',
          'testID="repair.get-plans"',
          'testID="repair.generate-plans"',
          'testID="repair.replan-submit"',
          'testID="repair.select-plan"',
          'testID="repair.confirm-execution"',
          'testID="repair.checkin"',
          'connectRepairTrackStream',
          'useAIStreamSubscription',
          'm4Api.reconciliation.getPlans',
          'm4Api.reconciliation.generatePlans',
          'm4Api.reconciliation.selectPlan',
          'm4Api.execution.confirm',
          'm4Api.execution.checkin',
          'm4Api.execution.replanTrack',
        ],
      },
      {
        path: 'packages/api-client/src/m4.ts',
        label: 'M4 shared API client',
        needles: [
          '/pairing/create',
          '/pairing/join',
          '/pairing/status',
          '/cases',
          '/submit',
          '/judgments/generate',
          '/judgment',
          '/accept',
          '/reconciliation-plans',
          '/execution/confirm',
          '/execution/checkin',
          '/execution/status',
          '/execution/dashboard',
          '/replan',
          '/resume',
        ],
      },
      {
        path: 'mobile/src/features/m4/api.ts',
        label: 'M4 repair stream adapter',
        needles: [
          "connectAIStream('repair_track'",
          'connectRepairTrackStream',
        ],
      },
    ],
  },
  {
    id: 'm5_push_deeplink_upload_telemetry',
    files: [
      {
        path: 'mobile/app/(app)/notifications/index.tsx',
        label: 'Notifications screen',
        needles: [
          'testID="notifications.screen"',
          'testID="notifications.mark-all-read"',
          'testID="notifications.push-setup"',
          'm5Api.notifications.list',
          'm5Api.notifications.markAllRead',
          'm5Api.notifications.markRead',
          'm5Api.notifications.snooze',
          'm5Api.notifications.act',
          'requestPushPermission',
          'getPushTokenPayload',
          'registerPushTokenForCurrentUser',
        ],
      },
      {
        path: 'mobile/src/features/m5/DeepLinkLandingHandler.tsx',
        label: 'Deep link landing handler',
        needles: [
          'getInitialAppLandingTarget',
          'subscribeToAppLandingTargets',
          'requiresAuthForAppLandingHref',
          'pendingLandingStorage.setPendingHref',
          'deep_link_landing_deferred',
          'deep_link_landing_open',
          'router.push',
        ],
      },
      {
        path: 'mobile/src/features/m5/NotificationLandingHandler.tsx',
        label: 'Notification landing handler',
        needles: [
          'getLastNotificationLandingTarget',
          'subscribeToNotificationLandingTargets',
          'requiresAuthForAppLandingHref',
          'pendingLandingStorage.setPendingHref',
          'notification_landing_deferred',
          'notification_landing_open',
          'router.push',
        ],
      },
      {
        path: 'mobile/src/platform/notifications/native.ts',
        label: 'Native notifications adapter',
        needles: [
          'expo-notifications',
          'getExpoPushTokenAsync',
          'addNotificationResponseReceivedListener',
          'getLastNotificationResponseAsync',
          'resolveNotificationLandingTargetFromData',
        ],
      },
      {
        path: 'mobile/src/platform/linking/native.ts',
        label: 'Native linking adapter',
        needles: [
          'expo-linking',
          'getInitialURL',
          'addEventListener',
          'resolveAppHrefFromBackendPath',
          'resolveAppHrefFromUrl',
        ],
      },
      {
        path: 'mobile/src/platform/upload/native.ts',
        label: 'Native upload adapter',
        needles: [
          'expo-image-picker',
          'launchImageLibraryAsync',
          'createUploadFormData',
          'createEvidenceUploadFormData',
          'safety_assertion',
        ],
      },
      {
        path: 'mobile/src/platform/telemetry/client.ts',
        label: 'Telemetry adapter',
        needles: [
          'sanitizeTelemetryContext',
          'initializeOpenTelemetryProvider',
          '/telemetry/otlp/v1/traces',
          'captureTelemetry',
          'startTelemetrySpan',
          'resourceSpans',
        ],
      },
      {
        path: 'packages/api-client/src/m5.ts',
        label: 'M5 shared API client',
        needles: [
          '/notifications',
          '/notifications/unread-count',
          '/read',
          '/read-all',
          '/dismiss',
          '/snooze',
          '/act',
          '/notifications/device-tokens',
          '/notifications/device-tokens/revoke',
          '/evidence',
        ],
      },
      {
        path: 'backend/src/routes/notification.routes.ts',
        label: 'Backend notification routes',
        needles: [
          "router.get(\n  '/notifications'",
          "router.get(\n  '/notifications/unread-count'",
          "router.post(\n  '/notifications/:id/read'",
          "router.post(\n  '/notifications/read-all'",
          "router.post(\n  '/notifications/:id/snooze'",
          "router.post(\n  '/notifications/:id/act'",
          "router.post(\n  '/notifications/device-tokens'",
          "router.post(\n  '/notifications/device-tokens/revoke'",
        ],
      },
      {
        path: 'backend/src/routes/app-telemetry.routes.ts',
        label: 'Backend telemetry routes',
        needles: [
          '/events',
          '/telemetry/otlp/v1/traces',
          'recordOtlpTraces',
        ],
      },
      {
        path: 'backend/src/services/push-notification.service.ts',
        label: 'Backend push provider adapter',
        needles: [
          'https://exp.host/--/api/v2/push/send',
          'https://exp.host/--/api/v2/push/getReceipts',
          'redactPushTokens',
          'sendMessages',
          'getReceipts',
        ],
      },
    ],
  },
];

for (const contract of contracts) {
  for (const file of contract.files) {
    requireNeedles(file.path, `${contract.id} ${file.label}`, file.needles);
  }
}

requireAnyNeedle(
  'mobile/src/platform/storage/secureStore.ts',
  'SecureStore implementation',
  ['SecureStore.getItemAsync', 'expo-secure-store']
);

if (failures.length) {
  console.error('[app-feature-coverage] contract failures:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const fileCount = contracts.reduce((total, contract) => total + contract.files.length, 0);
console.log(
  `[app-feature-coverage] ok: ${contracts.length} milestone coverage contract(s), ${fileCount} source contract file(s) checked`
);
