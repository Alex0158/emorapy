import type { AdminTokenEditorState } from './adminTokenState';

interface DeriveAdminOpsJobsAccessStateInput {
  tokenState: AdminTokenEditorState;
  adminMeLoading: boolean;
  adminMeError: unknown;
  hasOpsReadPermission: boolean;
}

interface DeriveAdminOpsJobsDataStateInput {
  canLoadStats: boolean;
  statsError: unknown;
  sampled: boolean;
}

export interface AdminOpsJobsViewState {
  canLoadStats: boolean;
  showPageTokenInvalid: boolean;
  showPageTokenRequired: boolean;
  showVerifyingAccess: boolean;
  showIdentityFailed: boolean;
  showNetworkError: boolean;
  showAccessDenied: boolean;
  showLoadFailed: boolean;
  showSampledHint: boolean;
}

export function deriveAdminOpsJobsAccessState({
  tokenState,
  adminMeLoading,
  adminMeError,
  hasOpsReadPermission,
}: DeriveAdminOpsJobsAccessStateInput): Omit<
  AdminOpsJobsViewState,
  'showLoadFailed' | 'showSampledHint'
> {
  const queryError = adminMeError as { code?: string } | null;
  const errorCode = queryError?.code || '';
  const hasAdminMeError = adminMeError !== null && adminMeError !== undefined;
  const isForbidden = errorCode === 'FORBIDDEN';
  const isNetworkError = errorCode === 'NETWORK_ERROR';
  const showIdentityFailed =
    tokenState.tokenReady && hasAdminMeError && !isForbidden && !isNetworkError;
  const showNetworkError = tokenState.tokenReady && hasAdminMeError && isNetworkError;
  const showAccessDenied =
    tokenState.tokenReady &&
    !adminMeLoading &&
    ((hasAdminMeError && isForbidden) || (!hasAdminMeError && !hasOpsReadPermission));
  const canLoadStats =
    tokenState.tokenReady &&
    !adminMeLoading &&
    !hasAdminMeError &&
    hasOpsReadPermission;

  return {
    canLoadStats,
    showPageTokenInvalid: tokenState.showPageInvalid,
    showPageTokenRequired: tokenState.showPageRequired,
    showVerifyingAccess: tokenState.tokenReady && adminMeLoading,
    showIdentityFailed,
    showNetworkError,
    showAccessDenied,
  };
}

export function deriveAdminOpsJobsDataState({
  canLoadStats,
  statsError,
  sampled,
}: DeriveAdminOpsJobsDataStateInput): Pick<
  AdminOpsJobsViewState,
  'showLoadFailed' | 'showSampledHint'
> {
  const hasStatsError = statsError !== null && statsError !== undefined;
  return {
    showLoadFailed: hasStatsError && canLoadStats,
    showSampledHint: sampled && canLoadStats,
  };
}
