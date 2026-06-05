import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_MATCHES } from '../../../lib/mockData';
import type { Match, PaginatedResponse } from '../../../api/types';

// TODO: replace with GET /api/v1/admin/matches when admin endpoint is available
export function useMatches(params: { page: number; limit: number; state: string }) {
  return useQuery({
    queryKey: queryKeys.matches.list(params),
    queryFn: async (): Promise<PaginatedResponse<Match>> => {
      await new Promise((r) => setTimeout(r, 150));
      const filtered = params.state
        ? MOCK_MATCHES.filter((m) => m.state === params.state)
        : MOCK_MATCHES;
      const start = (params.page - 1) * params.limit;
      return { data: filtered.slice(start, start + params.limit), total: filtered.length, page: params.page, limit: params.limit };
    },
    refetchInterval: 30_000,
  });
}
