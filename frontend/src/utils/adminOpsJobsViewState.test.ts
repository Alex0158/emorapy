/**
 * Admin OpsJobs 頁面狀態推導工具測試
 */

import { describe, expect, it } from 'vitest';
import type { AdminTokenEditorState } from './adminTokenState';
import {
  deriveAdminOpsJobsAccessState,
  deriveAdminOpsJobsDataState,
  deriveAdminOpsJobsViewState,
} from './adminOpsJobsViewState';

function makeTokenState(overrides: Partial<AdminTokenEditorState> = {}): AdminTokenEditorState {
  return {
    tokenPresent: false,
    tokenReady: false,
    tokenFormatInvalid: false,
    normalizedSavedToken: '',
    normalizedInputToken: '',
    tokenDirty: false,
    inputTokenFormatInvalid: false,
    showInlineInvalid: false,
    showInlineNotApplied: false,
    showPageInvalid: false,
    showPageRequired: true,
    ...overrides,
  };
}

describe('adminOpsJobsViewState', () => {
  it('access state 在 token ready 且有權限時應可載入 stats', () => {
    const state = deriveAdminOpsJobsAccessState({
      tokenState: makeTokenState({ tokenReady: true, showPageRequired: false }),
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: true,
    });

    expect(state.canLoadStats).toBe(true);
    expect(state.showAccessDenied).toBe(false);
    expect(state.showIdentityFailed).toBe(false);
    expect(state.showVerifyingAccess).toBe(false);
  });

  it('data state 在 canLoadStats=false 時不應顯示 sampled 與 loadFailed', () => {
    const state = deriveAdminOpsJobsDataState({
      canLoadStats: false,
      statsError: new Error('500'),
      sampled: true,
    });

    expect(state.showLoadFailed).toBe(false);
    expect(state.showSampledHint).toBe(false);
  });

  it('adminMeError 為空字串時仍應視為錯誤並阻止載入', () => {
    const state = deriveAdminOpsJobsAccessState({
      tokenState: makeTokenState({ tokenReady: true, showPageRequired: false }),
      adminMeLoading: false,
      adminMeError: '',
      hasOpsReadPermission: true,
    });

    expect(state.showIdentityFailed).toBe(true);
    expect(state.canLoadStats).toBe(false);
  });

  it('statsError 為空字串時仍應顯示 loadFailed', () => {
    const state = deriveAdminOpsJobsDataState({
      canLoadStats: true,
      statsError: '',
      sampled: false,
    });

    expect(state.showLoadFailed).toBe(true);
    expect(state.showSampledHint).toBe(false);
  });

  it('access/data 拆分後組合結果應與單次推導一致', () => {
    const tokenState = makeTokenState({ tokenReady: true, showPageRequired: false });
    const accessState = deriveAdminOpsJobsAccessState({
      tokenState,
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: true,
    });
    const dataState = deriveAdminOpsJobsDataState({
      canLoadStats: accessState.canLoadStats,
      statsError: new Error('500'),
      sampled: true,
    });
    const merged = { ...accessState, ...dataState };
    const oneShot = deriveAdminOpsJobsViewState({
      tokenState,
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: true,
      statsError: new Error('500'),
      sampled: true,
    });

    expect(merged).toEqual(oneShot);
  });

  it('token 未 ready 時不應可載入 stats', () => {
    const state = deriveAdminOpsJobsViewState({
      tokenState: makeTokenState({ tokenReady: false, showPageRequired: true }),
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: true,
      statsError: null,
      sampled: true,
    });

    expect(state.canLoadStats).toBe(false);
    expect(state.showPageTokenRequired).toBe(true);
    expect(state.showSampledHint).toBe(false);
  });

  it('token ready + loading 時應顯示 verifyingAccess', () => {
    const state = deriveAdminOpsJobsViewState({
      tokenState: makeTokenState({ tokenReady: true, showPageRequired: false }),
      adminMeLoading: true,
      adminMeError: null,
      hasOpsReadPermission: false,
      statsError: null,
      sampled: false,
    });

    expect(state.showVerifyingAccess).toBe(true);
    expect(state.showAccessDenied).toBe(false);
    expect(state.canLoadStats).toBe(false);
  });

  it('token ready + identity error 時應顯示 identityFailed', () => {
    const state = deriveAdminOpsJobsViewState({
      tokenState: makeTokenState({ tokenReady: true, showPageRequired: false }),
      adminMeLoading: false,
      adminMeError: new Error('401'),
      hasOpsReadPermission: true,
      statsError: null,
      sampled: false,
    });

    expect(state.showIdentityFailed).toBe(true);
    expect(state.showAccessDenied).toBe(false);
    expect(state.canLoadStats).toBe(false);
  });

  it('token ready + 無權限時應顯示 accessDenied', () => {
    const state = deriveAdminOpsJobsViewState({
      tokenState: makeTokenState({ tokenReady: true, showPageRequired: false }),
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: false,
      statsError: null,
      sampled: false,
    });

    expect(state.showAccessDenied).toBe(true);
    expect(state.canLoadStats).toBe(false);
  });

  it('可載入 stats 且有 stats error 時應顯示 loadFailed', () => {
    const state = deriveAdminOpsJobsViewState({
      tokenState: makeTokenState({ tokenReady: true, showPageRequired: false }),
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: true,
      statsError: new Error('500'),
      sampled: true,
    });

    expect(state.canLoadStats).toBe(true);
    expect(state.showLoadFailed).toBe(true);
    expect(state.showSampledHint).toBe(true);
  });

  it('page token invalid 應透傳為 page invalid alert', () => {
    const state = deriveAdminOpsJobsViewState({
      tokenState: makeTokenState({ tokenReady: false, showPageInvalid: true, showPageRequired: false }),
      adminMeLoading: false,
      adminMeError: null,
      hasOpsReadPermission: false,
      statsError: null,
      sampled: false,
    });

    expect(state.showPageTokenInvalid).toBe(true);
    expect(state.showPageTokenRequired).toBe(false);
  });
});
