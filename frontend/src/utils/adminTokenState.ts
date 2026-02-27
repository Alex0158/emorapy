/**
 * Admin token 狀態推導工具
 */

import { isLikelyAdminJwt } from '@/services/api/admin';

export interface AdminTokenStatus {
  tokenPresent: boolean;
  tokenReady: boolean;
  tokenFormatInvalid: boolean;
}

export interface AdminTokenEditorState extends AdminTokenStatus {
  normalizedSavedToken: string;
  normalizedInputToken: string;
  tokenDirty: boolean;
  inputTokenFormatInvalid: boolean;
  showInlineInvalid: boolean;
  showInlineNotApplied: boolean;
  showPageInvalid: boolean;
  showPageRequired: boolean;
}

export function deriveAdminTokenStatus(token: string): AdminTokenStatus {
  const normalized = token.trim();
  const tokenPresent = normalized.length > 0;
  const tokenReady = tokenPresent && isLikelyAdminJwt(normalized);

  return {
    tokenPresent,
    tokenReady,
    tokenFormatInvalid: tokenPresent && !tokenReady,
  };
}

export function deriveAdminTokenEditorState(savedToken: string, inputToken: string): AdminTokenEditorState {
  const normalizedSavedToken = savedToken.trim();
  const normalizedInputToken = inputToken.trim();
  const base = deriveAdminTokenStatus(normalizedSavedToken);

  const tokenDirty = normalizedInputToken !== normalizedSavedToken;
  const inputTokenFormatInvalid = normalizedInputToken.length > 0 && !isLikelyAdminJwt(normalizedInputToken);

  return {
    ...base,
    normalizedSavedToken,
    normalizedInputToken,
    tokenDirty,
    inputTokenFormatInvalid,
    showInlineInvalid: tokenDirty && inputTokenFormatInvalid,
    showInlineNotApplied: tokenDirty && !inputTokenFormatInvalid,
    showPageInvalid: !tokenDirty && base.tokenFormatInvalid,
    showPageRequired: !tokenDirty && !base.tokenReady && !base.tokenFormatInvalid,
  };
}
