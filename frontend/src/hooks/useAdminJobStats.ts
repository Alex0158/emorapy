/**
 * 管理員 Cron 統計 Hook
 */

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/services/api/admin';
import type { AdminJobStatsQuery } from '@/types/admin';
import { normalizeAdminJobStatsQuery } from '@/utils/adminJobStatsQuery';

export function useAdminJobStats(query: AdminJobStatsQuery = {}, enabled = true) {
  const normalizedQuery = normalizeAdminJobStatsQuery(query);
  return useQuery({
    queryKey: ['admin', 'jobs', 'stats', normalizedQuery],
    queryFn: () => adminApi.getJobStats(normalizedQuery),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

