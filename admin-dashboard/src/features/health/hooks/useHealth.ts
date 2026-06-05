import { useQuery } from '@tanstack/react-query';
import { healthClient } from '../../../api/client';
import { queryKeys } from '../../../lib/queryKeys';
import type { HealthStatus } from '../../../api/types';

// Calls the real GET /health endpoint — polls every 10 seconds
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: async (): Promise<HealthStatus> => {
      const { data } = await healthClient.get<HealthStatus>('/health');
      return data;
    },
    refetchInterval: 10_000,
    retry: 1,
  });
}
