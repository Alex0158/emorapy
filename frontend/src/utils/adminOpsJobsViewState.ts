/**
 * Admin OpsJobs 頁面狀態推導工具
 */

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
  showAccessDenied: boolean;
  showLoadFailed: boolean;
  showSampledHint: boolean;
}

export function deriveAdminOpsJobsAccessState({
  tokenState,
  adminMeLoading,
  adminMeError,
  hasOpsReadPermission,
}: DeriveAdminOpsJobsAccessStateInput): Omit<AdminOpsJobsViewState, 'showLoadFailed' | 'showSampledHint'> {
  const hasAdminMeError = adminMeError !== null && adminMeError !== undefined;
  const canLoadStats = tokenState.tokenReady && !adminMeLoading && !hasAdminMeError && hasOpsReadPermission;

  return {
    canLoadStats,
    showPageTokenInvalid: tokenState.showPageInvalid,
    showPageTokenRequired: tokenState.showPageRequired,
    showVerifyingAccess: tokenState.tokenReady && adminMeLoading,
    showIdentityFailed: tokenState.tokenReady && hasAdminMeError,
    showAccessDenied: tokenState.tokenReady && !adminMeLoading && !hasAdminMeError && !hasOpsReadPermission,
  };
}

export function deriveAdminOpsJobsDataState({
  canLoadStats,
  statsError,
  sampled,
}: DeriveAdminOpsJobsDataStateInput): Pick<AdminOpsJobsViewState, 'showLoadFailed' | 'showSampledHint'> {
  const hasStatsError = statsError !== null && statsError !== undefined;
  return {
    showLoadFailed: hasStatsError && canLoadStats,
    showSampledHint: sampled && canLoadStats,
  };
}

export function deriveAdminOpsJobsViewState({
  tokenState,
  adminMeLoading,
  adminMeError,
  hasOpsReadPermission,
  statsError,
  sampled,
}: DeriveAdminOpsJobsAccessStateInput & Omit<DeriveAdminOpsJobsDataStateInput, 'canLoadStats'>): AdminOpsJobsViewState {
  const accessState = deriveAdminOpsJobsAccessState({
    tokenState,
    adminMeLoading,
    adminMeError,
    hasOpsReadPermission,
  });
  const dataState = deriveAdminOpsJobsDataState({
    canLoadStats: accessState.canLoadStats,
    statsError,
    sampled,
  });

  return {
    ...accessState,
    ...dataState,
  };
}
