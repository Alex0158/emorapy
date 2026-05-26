import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';

export const APP_AUTH_TOKEN_QUERY_KEY = ['app', 'auth-token'] as const;
export const APP_SESSION_ID_QUERY_KEY = ['app', 'session-id'] as const;

export function AuthSessionBootstrap() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    void Promise.all([
      tokenStorage.getToken(),
      sessionStorage.getSessionId(),
    ]).then(([token, sessionId]) => {
      if (!mounted) return;
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, token);
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, sessionId);
    });

    return () => {
      mounted = false;
    };
  }, [queryClient]);

  return null;
}
