import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_PLAYERS } from '../../../lib/mockData';
import type { Player, PaginatedResponse } from '../../../api/types';

// TODO: replace with GET /api/v1/admin/users?page=&q= when admin endpoint is available
export function usePlayers(params: { page: number; limit: number; q: string }) {
  return useQuery({
    queryKey: queryKeys.players.list(params),
    queryFn: async (): Promise<PaginatedResponse<Player>> => {
      await new Promise((r) => setTimeout(r, 200)); // simulate network
      const filtered = MOCK_PLAYERS.filter(
        (p) =>
          !params.q ||
          p.username.toLowerCase().includes(params.q.toLowerCase()) ||
          p.email.toLowerCase().includes(params.q.toLowerCase())
      );
      const start = (params.page - 1) * params.limit;
      return {
        data: filtered.slice(start, start + params.limit),
        total: filtered.length,
        page: params.page,
        limit: params.limit,
      };
    },
    staleTime: 60_000,
  });
}
