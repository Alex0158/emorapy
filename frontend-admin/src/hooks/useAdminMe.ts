import { useQuery } from '@tanstack/react-query';
import { adminApi, getAdminTokenFingerprint } from '@/services/api/admin';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { useAdminToken } from './useAdminToken';

export function useAdminMe(enabled = true) {
  const adminToken = useAdminToken();
  const { tokenReady } = deriveAdminTokenStatus(adminToken);
  const tokenFingerprint = tokenReady
    ? getAdminTokenFingerprint(adminToken)
    : 'missing';

  return useQuery({
    queryKey: ['admin', 'me', tokenFingerprint],
    queryFn: () => adminApi.getMe(),
    enabled: enabled && tokenReady && tokenFingerprint !== 'missing',
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
