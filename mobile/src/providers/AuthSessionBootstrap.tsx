import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import {
  APP_AUTH_TOKEN_QUERY_KEY,
  APP_SESSION_ID_QUERY_KEY,
  getIdentityQueryScopeEpoch,
  isIdentityQueryScopeCurrent,
} from './identityQueryScope';

export { APP_AUTH_TOKEN_QUERY_KEY, APP_SESSION_ID_QUERY_KEY } from './identityQueryScope';

export function AuthSessionBootstrap() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    const identityEpoch = getIdentityQueryScopeEpoch(queryClient);

    void Promise.all([
      tokenStorage.getToken(),
      sessionStorage.getSessionId(),
    ]).then(([token, sessionId]) => {
      if (!mounted || !isIdentityQueryScopeCurrent(queryClient, identityEpoch)) return;
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, token);
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, sessionId);
    });

    return () => {
      mounted = false;
    };
  }, [queryClient]);

  return null;
}
