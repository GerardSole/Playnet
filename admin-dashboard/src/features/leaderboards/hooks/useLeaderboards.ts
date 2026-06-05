import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_LEADERBOARDS } from '../../../lib/mockData';
import type { Leaderboard } from '../../../api/types';

// Calls GET /api/v1/leaderboards — real endpoint in Mini-Nakama
// Falls back to mock data if the request fails (e.g., no leaderboards created yet)
export function useLeaderboards() {
  return useQuery({
    queryKey: queryKeys.leaderboards.list(),
    queryFn: async (): Promise<Leaderboard[]> => {
      try {
        const { data } = await apiClient.get<{ data: Leaderboard[] }>('/leaderboards');
        return data.data ?? [];
      } catch {
        return MOCK_LEADERBOARDS;
      }
    },
    staleTime: 60_000,
  });
}
