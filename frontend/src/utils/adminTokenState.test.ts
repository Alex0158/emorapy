/**
 * Admin token 狀態推導工具測試
 */

import { describe, expect, it, vi } from 'vitest';
import { deriveAdminTokenEditorState, deriveAdminTokenStatus } from './adminTokenState';

vi.mock('@/services/api/admin', () => ({
  isLikelyAdminJwt: (token: string) => token === 'h.payload.s',
}));

describe('adminTokenState', () => {
  it('deriveAdminTokenStatus 應正確推導空 token', () => {
    expect(deriveAdminTokenStatus('   ')).toEqual({
      tokenPresent: false,
      tokenReady: false,
      tokenFormatInvalid: false,
    });
  });

  it('deriveAdminTokenStatus 應正確推導有效 token', () => {
    expect(deriveAdminTokenStatus('  h.payload.s  ')).toEqual({
      tokenPresent: true,
      tokenReady: true,
      tokenFormatInvalid: false,
    });
  });

  it('deriveAdminTokenStatus 應正確推導無效 token', () => {
    expect(deriveAdminTokenStatus('invalid')).toEqual({
      tokenPresent: true,
      tokenReady: false,
      tokenFormatInvalid: true,
    });
  });

  it('deriveAdminTokenEditorState 應在 dirty+invalid input 時顯示 inline invalid', () => {
    const state = deriveAdminTokenEditorState('h.payload.s', 'invalid');

    expect(state.tokenDirty).toBe(true);
    expect(state.inputTokenFormatInvalid).toBe(true);
    expect(state.showInlineInvalid).toBe(true);
    expect(state.showInlineNotApplied).toBe(false);
    expect(state.showPageInvalid).toBe(false);
    expect(state.showPageRequired).toBe(false);
  });

  it('deriveAdminTokenEditorState 應在 dirty+valid input 時顯示 tokenNotApplied', () => {
    const state = deriveAdminTokenEditorState('invalid', 'h.payload.s');

    expect(state.tokenDirty).toBe(true);
    expect(state.inputTokenFormatInvalid).toBe(false);
    expect(state.showInlineInvalid).toBe(false);
    expect(state.showInlineNotApplied).toBe(true);
    expect(state.showPageInvalid).toBe(false);
    expect(state.showPageRequired).toBe(false);
  });

  it('deriveAdminTokenEditorState 應在 non-dirty+invalid saved 時顯示 page invalid', () => {
    const state = deriveAdminTokenEditorState('invalid', 'invalid');

    expect(state.tokenDirty).toBe(false);
    expect(state.showInlineInvalid).toBe(false);
    expect(state.showInlineNotApplied).toBe(false);
    expect(state.showPageInvalid).toBe(true);
    expect(state.showPageRequired).toBe(false);
  });

  it('deriveAdminTokenEditorState 應在 non-dirty+missing saved 時顯示 page required', () => {
    const state = deriveAdminTokenEditorState('   ', '   ');

    expect(state.tokenDirty).toBe(false);
    expect(state.showInlineInvalid).toBe(false);
    expect(state.showInlineNotApplied).toBe(false);
    expect(state.showPageInvalid).toBe(false);
    expect(state.showPageRequired).toBe(true);
  });
});
