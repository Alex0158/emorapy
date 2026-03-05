import { useEffect, useState } from 'react';
import { setAdminToken } from '@/services/api/admin';
import { deriveAdminTokenEditorState } from '@/utils/adminTokenState';
import { useAdminToken } from './useAdminToken';

export type SaveAdminTokenResult = 'saved' | 'required' | 'invalid' | 'storage_failed';
export type ClearAdminTokenResult = 'cleared' | 'storage_failed';

export function useAdminTokenEditor() {
  const savedToken = useAdminToken();
  const [tokenInput, setTokenInput] = useState<string>(() => savedToken);
  const tokenState = deriveAdminTokenEditorState(savedToken, tokenInput);

  useEffect(() => {
    setTokenInput(savedToken);
  }, [savedToken]);

  const saveToken = (): SaveAdminTokenResult => {
    if (!tokenState.normalizedInputToken) {
      return 'required';
    }
    if (tokenState.inputTokenFormatInvalid) {
      return 'invalid';
    }

    return setAdminToken(tokenState.normalizedInputToken) ? 'saved' : 'storage_failed';
  };

  const clearToken = (): ClearAdminTokenResult => {
    setTokenInput('');
    return setAdminToken('') ? 'cleared' : 'storage_failed';
  };

  return {
    savedToken,
    tokenInput,
    setTokenInput,
    tokenState,
    saveToken,
    clearToken,
  };
}
