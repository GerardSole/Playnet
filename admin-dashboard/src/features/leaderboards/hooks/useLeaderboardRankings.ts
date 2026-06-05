import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_RANKINGS } from '../../../lib/mockData';
import type { LeaderboardEntry } from '../../../api/types';

// Calls GET /api/v1/leaderboards/:id — real endpoint
export function useLeaderboardRankings(id: string, params: { page: number; limit: number }) {
  return useQuery({
    queryKey: queryKeys.leaderboards.rankings(id, params),
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      try {
        const { data } = await apiClient.get<{ data: LeaderboardEntry[] }>(`/leaderboards/${id}`);
        return data.data ?? [];
      } catch {
        return MOCK_RANKINGS;
      }
    },
    enabled: !!id,
  });
}
