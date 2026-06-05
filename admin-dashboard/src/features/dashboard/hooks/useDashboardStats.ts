import { useQuery } from '@tanstack/react-query';
import { healthClient } from '../../../api/client';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_PLAYERS, MOCK_MATCHES, MOCK_LEADERBOARDS, MOCK_PRESENCE } from '../../../lib/mockData';
import type { HealthStatus } from '../../../api/types';

export function useDashboardStats() {
  const healthQuery = useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: async () => {
      const { data } = await healthClient.get<HealthStatus>('/health');
      return data;
    },
    refetchInterval: 30_000,
  });

  return {
    health: healthQuery.data,
    isLoading: healthQuery.isLoading,
    totalPlayers: MOCK_PLAYERS.length,
    onlinePlayers: MOCK_PRESENCE.length,
    activeMatches: MOCK_MATCHES.filter((m) => m.state === 'active').length,
    totalLeaderboards: MOCK_LEADERBOARDS.length,
    recentPlayers: MOCK_PLAYERS.slice(0, 5),
  };
}
