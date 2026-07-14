import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse } from '@emorapy/contracts/auth';

import { clearAppStorageWithPushCleanup } from '@/src/features/m5/pushLifecycle';
import { t } from '@/src/i18n';
import { getPostAuthResumeHref } from '@/src/platform/linking/authGate';
import {
  pendingLandingStorage,
  sessionStorage,
  tokenStorage,
} from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { APP_AUTH_TOKEN_QUERY_KEY, APP_SESSION_ID_QUERY_KEY } from '@/src/providers/AuthSessionBootstrap';
import {
  beginIdentityQueryTransition,
  completeIdentityQueryTransition,
} from '@/src/providers/identityQueryScope';

import { normalizeM1Error, m1Api } from './api';
import {
  getAuthFlowErrorMessage,
  getRegistrationPasswordErrorMessage,
  isValidAuthEmail,
  isValidRegistrationPassword,
  shouldDiscardRegistrationProof,
  type RegistrationDraft,
} from './authRegistration';
import { useResendCountdown } from './useResendCountdown';

export type AuthMode = 'login' | 'register';
export type RegistrationStep = 'details' | 'verification';

interface LoginVerificationDraft {
  email: string;
  password: string;
}

const CLEAR_SESSION_ON_CLAIM_ERROR_CODES = new Set([
  'INVALID_SESSION_ID',
  'SESSION_EXPIRED',
  'SESSION_ID_REQUIRED',
  'HTTP_400',
  'HTTP_404',
]);

export function useAuthFlow(nextParam?: string | null) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('details');
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft | null>(null);
  const [loginVerificationDraft, setLoginVerificationDraft] = useState<LoginVerificationDraft | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const registrationProofRef = useRef<string | null>(null);
  const {
    clear: clearResendCountdown,
    secondsRemaining: resendSecondsRemaining,
    start: startResendCountdown,
  } = useResendCountdown();

  const finishAuthentication = async (auth: AuthResponse) => {
    const identityEpoch = await beginIdentityQueryTransition(queryClient);
    try {
      await tokenStorage.setToken(auth.token);
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, auth.token);

      const sessionId = await sessionStorage.getSessionId();
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, sessionId);
      if (sessionId) {
        try {
          const claim = await m1Api.auth.claimSession(sessionId);
          setStatusText(
            claim.case_id
              ? t('auth.status.claimSaved')
              : t('auth.status.noAnonymousCase')
          );
        } catch (error) {
          const claimError = normalizeM1Error(error);
          captureTelemetry({
            name: 'app_auth_claim_session_failed',
            severity: 'warning',
            route: '/auth',
            context: {
              code: claimError.code,
              hasSession: true,
            },
          });
          if (CLEAR_SESSION_ON_CLAIM_ERROR_CODES.has(claimError.code)) {
            await sessionStorage.clearSessionId();
            queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, null);
            setStatusText(t('auth.status.claimExpired'));
          } else {
            setStatusText(t('auth.status.claimFailed'));
          }
        }
      } else {
        setStatusText(t('auth.status.loggedIn'));
      }

      const pendingHref = await pendingLandingStorage.consumePendingHref();
      const resumeHref = getPostAuthResumeHref(nextParam) ?? getPostAuthResumeHref(pendingHref);
      completeIdentityQueryTransition(queryClient, identityEpoch, {
        privateDataEnabled: true,
      });
      return { resumeHref };
    } catch (error) {
      const cleanupResults = await Promise.allSettled([
        tokenStorage.clearToken(),
        sessionStorage.clearSessionId(),
      ]);
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, null);
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, null);
      completeIdentityQueryTransition(queryClient, identityEpoch, {
        privateDataEnabled: cleanupResults.every((result) => result.status === 'fulfilled'),
      });
      throw error;
    }
  };

  const clearRegistrationProgress = (
    options: { keepDraft?: boolean; keepCooldown?: boolean } = {}
  ) => {
    registrationProofRef.current = null;
    setVerificationCode('');
    if (!options.keepCooldown) clearResendCountdown();
    if (!options.keepDraft) {
      setRegistrationDraft(null);
      setRegistrationStep('details');
    }
  };

  const loginVerificationCodeMutation = useMutation({
    mutationFn: async ({
      draft,
    }: {
      draft: LoginVerificationDraft;
      intent: 'initial' | 'resend';
    }) => {
      const delivery = await m1Api.auth.sendVerificationCode(draft.email, 'verify_email');
      return { delivery, draft };
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: ({ delivery, draft }, { intent }) => {
      setLoginVerificationDraft(draft);
      setVerificationCode('');
      startResendCountdown(delivery.resend_after);
      setStatusText(
        intent === 'resend'
          ? t('auth.verification.resent')
          : t('auth.verification.sent')
      );
    },
    onError: (error) => {
      setFormError(getAuthFlowErrorMessage(normalizeM1Error(error)));
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const auth = await m1Api.auth.login(input);
      return finishAuthentication(auth);
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: ({ resumeHref }) => {
      router.replace((resumeHref ?? '/case') as Href);
    },
    onError: (error, input) => {
      const normalized = normalizeM1Error(error);
      if (normalized.code === 'EMAIL_NOT_VERIFIED') {
        loginVerificationCodeMutation.mutate({ draft: input, intent: 'initial' });
        return;
      }
      setFormError(getAuthFlowErrorMessage(normalized));
    },
  });

  const loginVerificationMutation = useMutation({
    mutationFn: async () => {
      if (!loginVerificationDraft) {
        throw {
          code: 'INVALID_CODE',
          message: t('auth.error.invalidCode'),
        };
      }
      const verified = await m1Api.auth.verifyEmail(
        loginVerificationDraft.email,
        verificationCode
      );
      if (!verified) {
        throw {
          code: 'INVALID_CODE',
          message: t('auth.error.invalidCode'),
        };
      }
      const auth = await m1Api.auth.login(loginVerificationDraft);
      return finishAuthentication(auth);
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: ({ resumeHref }) => {
      setLoginVerificationDraft(null);
      clearRegistrationProgress();
      router.replace((resumeHref ?? '/case') as Href);
    },
    onError: (error) => {
      setFormError(getAuthFlowErrorMessage(normalizeM1Error(error)));
    },
  });

  const registrationCodeMutation = useMutation({
    mutationFn: async ({ draft }: { draft: RegistrationDraft; intent: 'initial' | 'resend' }) => {
      const delivery = await m1Api.auth.sendVerificationCode(draft.email, 'register');
      return { delivery, draft };
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: ({ delivery, draft }, { intent }) => {
      if (intent === 'resend') {
        clearRegistrationProgress({ keepDraft: true, keepCooldown: true });
      }
      setRegistrationDraft(draft);
      setRegistrationStep('verification');
      startResendCountdown(delivery.resend_after);
      setStatusText(
        intent === 'resend'
          ? t('auth.verification.resent')
          : t('auth.verification.sent')
      );
    },
    onError: (error) => {
      setFormError(getAuthFlowErrorMessage(normalizeM1Error(error)));
    },
  });

  const registrationMutation = useMutation({
    mutationFn: async () => {
      if (!registrationDraft) {
        throw {
          code: 'REGISTRATION_PROOF_INVALID',
          message: t('auth.error.proofInvalid'),
        };
      }

      let registrationProof = registrationProofRef.current;
      if (!registrationProof) {
        const verification = await m1Api.auth.verifyRegistrationCode(
          registrationDraft.email,
          verificationCode
        );
        registrationProof = verification.registration_proof;
        if (!registrationProof) {
          throw {
            code: 'INVALID_REGISTRATION_PROOF_RESPONSE',
            message: t('appApi.error.invalidResponse'),
          };
        }
        registrationProofRef.current = registrationProof;
      }

      const auth = await m1Api.auth.register({
        ...registrationDraft,
        registration_proof: registrationProof,
      });
      return finishAuthentication(auth);
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: ({ resumeHref }) => {
      clearRegistrationProgress();
      router.replace((resumeHref ?? '/case') as Href);
    },
    onError: (error) => {
      const normalized = normalizeM1Error(error);
      if (shouldDiscardRegistrationProof(normalized.code)) {
        clearRegistrationProgress({ keepDraft: true, keepCooldown: true });
        setStatusText(t('auth.verification.proofRetry'));
      }
      setFormError(getAuthFlowErrorMessage(normalized));
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const identityEpoch = await beginIdentityQueryTransition(queryClient);
      let storageCleared = false;
      try {
        await clearAppStorageWithPushCleanup();
        storageCleared = true;
      } finally {
        queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, null);
        queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, null);
        completeIdentityQueryTransition(queryClient, identityEpoch, {
          privateDataEnabled: storageCleared,
        });
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, null);
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, null);
      setStatusText(t('auth.status.cleared'));
    },
  });

  const isAuthBusy = loginMutation.isPending
    || loginVerificationCodeMutation.isPending
    || loginVerificationMutation.isPending
    || registrationCodeMutation.isPending
    || registrationMutation.isPending;

  const handleModeChange = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    clearRegistrationProgress();
    setLoginVerificationDraft(null);
    setMode(nextMode);
    setFormError(null);
    setStatusText(null);
  };

  const handleEmailChange = (value: string) => {
    clearRegistrationProgress();
    setLoginVerificationDraft(null);
    setEmail(value);
  };

  const handlePrimarySubmit = () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedNickname = nickname.trim();
    if (!isValidAuthEmail(trimmedEmail)) {
      setFormError(t('auth.error.invalidEmail'));
      return;
    }
    if (mode === 'login') {
      if (password.length < 8) {
        setFormError(t('auth.error.passwordMin'));
        return;
      }
      loginMutation.mutate({ email: trimmedEmail, password });
      return;
    }

    const passwordError = getRegistrationPasswordErrorMessage(password);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    registrationCodeMutation.mutate({
      draft: {
        email: trimmedEmail,
        password,
        nickname: trimmedNickname || undefined,
      },
      intent: 'initial',
    });
  };

  const handleRegistrationBack = () => {
    clearRegistrationProgress();
    setFormError(null);
    setStatusText(null);
  };

  const handleRegistrationResend = () => {
    if (!registrationDraft) {
      handleRegistrationBack();
      return;
    }
    if (resendSecondsRemaining > 0 || registrationCodeMutation.isPending) return;
    registrationCodeMutation.mutate({ draft: registrationDraft, intent: 'resend' });
  };

  const handleVerificationBack = () => {
    if (loginVerificationDraft) {
      setLoginVerificationDraft(null);
      setVerificationCode('');
      clearResendCountdown();
      setFormError(null);
      setStatusText(null);
      return;
    }
    handleRegistrationBack();
  };

  const handleVerificationResend = () => {
    if (resendSecondsRemaining > 0) return;
    if (loginVerificationDraft) {
      if (loginVerificationCodeMutation.isPending) return;
      loginVerificationCodeMutation.mutate({
        draft: loginVerificationDraft,
        intent: 'resend',
      });
      return;
    }
    handleRegistrationResend();
  };

  const verificationPurpose = loginVerificationDraft
    ? 'verify_email' as const
    : mode === 'register' && registrationStep === 'verification' && registrationDraft
      ? 'register' as const
      : null;
  const verificationEmail = loginVerificationDraft?.email ?? registrationDraft?.email ?? null;

  return {
    canSubmit: isValidAuthEmail(email) && (
      mode === 'register'
        ? isValidRegistrationPassword(password)
        : password.length >= 8
    ),
    clearLocalSession: () => clearMutation.mutate(),
    clearPending: clearMutation.isPending,
    completeVerification: () => {
      if (verificationPurpose === 'verify_email') loginVerificationMutation.mutate();
      else registrationMutation.mutate();
    },
    email,
    formError,
    handleEmailChange,
    handleModeChange,
    handlePrimarySubmit,
    handleVerificationBack,
    handleVerificationResend,
    isAuthBusy,
    loginPending: loginMutation.isPending,
    mode,
    nickname,
    password,
    registrationDraft,
    verificationPending: verificationPurpose === 'verify_email'
      ? loginVerificationMutation.isPending
      : registrationMutation.isPending,
    resendSecondsRemaining,
    verificationSendPending: loginVerificationCodeMutation.isPending
      || registrationCodeMutation.isPending,
    registrationStep,
    setNickname,
    setPassword,
    setVerificationCode,
    statusText,
    verificationCode,
    verificationEmail,
    verificationPurpose,
  };
}
