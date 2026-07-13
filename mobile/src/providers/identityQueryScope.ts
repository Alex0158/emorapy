import {
  useQuery,
  type Query,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

export const APP_AUTH_TOKEN_QUERY_KEY = ['app', 'auth-token'] as const;
export const APP_SESSION_ID_QUERY_KEY = ['app', 'session-id'] as const;

const IDENTITY_SCOPE_STATE_QUERY_KEY = ['app', 'identity-query-scope'] as const;
const IDENTITY_SCOPED_QUERY_ROOT = 'identity-scoped';
const LEGACY_USER_SCOPED_ROOTS = new Set(['m2', 'm3', 'm4', 'm5', 'quick-result']);

export interface IdentityQueryScopeState {
  epoch: number;
  privateDataEnabled: boolean;
  transitioning: boolean;
}

const INITIAL_IDENTITY_QUERY_SCOPE: IdentityQueryScopeState = {
  epoch: 0,
  privateDataEnabled: true,
  transitioning: false,
};

function readIdentityQueryScope(queryClient: QueryClient): IdentityQueryScopeState {
  return queryClient.getQueryData<IdentityQueryScopeState>(IDENTITY_SCOPE_STATE_QUERY_KEY)
    ?? INITIAL_IDENTITY_QUERY_SCOPE;
}

export function getIdentityQueryScopeEpoch(queryClient: QueryClient): number {
  return readIdentityQueryScope(queryClient).epoch;
}

export function isIdentityQueryScopeCurrent(
  queryClient: QueryClient,
  epoch: number,
): boolean {
  const current = readIdentityQueryScope(queryClient);
  return current.epoch === epoch && !current.transitioning;
}

function isExactQueryKey(queryKey: QueryKey, expected: QueryKey): boolean {
  return queryKey.length === expected.length
    && queryKey.every((segment, index) => segment === expected[index]);
}

function isUserScopedQuery(query: Query): boolean {
  const root = query.queryKey[0];
  return root === IDENTITY_SCOPED_QUERY_ROOT
    || (typeof root === 'string' && LEGACY_USER_SCOPED_ROOTS.has(root))
    || isExactQueryKey(query.queryKey, APP_AUTH_TOKEN_QUERY_KEY)
    || isExactQueryKey(query.queryKey, APP_SESSION_ID_QUERY_KEY);
}

export function identityScopedQueryKey(
  epoch: number,
  ...segments: readonly unknown[]
): QueryKey {
  return [IDENTITY_SCOPED_QUERY_ROOT, epoch, ...segments];
}

export function useIdentityQueryScope(): IdentityQueryScopeState {
  const { data } = useQuery({
    queryKey: IDENTITY_SCOPE_STATE_QUERY_KEY,
    queryFn: () => INITIAL_IDENTITY_QUERY_SCOPE,
    initialData: INITIAL_IDENTITY_QUERY_SCOPE,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

/**
 * Rotate before writing or clearing credentials. The new epoch is disabled first,
 * so mounted screens cannot start requests with the previous actor while old
 * user-scoped queries are being cancelled and removed.
 */
export async function beginIdentityQueryTransition(queryClient: QueryClient): Promise<number> {
  const current = readIdentityQueryScope(queryClient);
  const epoch = current.epoch + 1;
  queryClient.setQueryData<IdentityQueryScopeState>(IDENTITY_SCOPE_STATE_QUERY_KEY, {
    epoch,
    privateDataEnabled: false,
    transitioning: true,
  });
  await queryClient.cancelQueries({ predicate: isUserScopedQuery });
  queryClient.removeQueries({ predicate: isUserScopedQuery });
  return epoch;
}

/** Only the latest transition may re-enable private data. */
export function completeIdentityQueryTransition(
  queryClient: QueryClient,
  epoch: number,
  options: { privateDataEnabled: boolean },
): void {
  const current = readIdentityQueryScope(queryClient);
  if (current.epoch !== epoch) return;
  queryClient.setQueryData<IdentityQueryScopeState>(IDENTITY_SCOPE_STATE_QUERY_KEY, {
    epoch,
    privateDataEnabled: options.privateDataEnabled,
    transitioning: false,
  });
}
