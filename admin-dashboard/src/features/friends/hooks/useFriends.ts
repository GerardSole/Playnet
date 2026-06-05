import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_FRIENDSHIPS } from '../../../lib/mockData';
import type { Friendship, PaginatedResponse } from '../../../api/types';

// TODO: replace with GET /api/v1/admin/friendships when admin endpoint is available
export function useFriends(params: { page: number; limit: number; q: string; status: string }) {
  return useQuery({
    queryKey: queryKeys.friends.all(),
    queryFn: async (): Promise<PaginatedResponse<Friendship>> => {
      await new Promise((r) => setTimeout(r, 150));
      let filtered = MOCK_FRIENDSHIPS;
      if (params.q) {
        const q = params.q.toLowerCase();
        filtered = filtered.filter(
          (f) => f.senderUsername.toLowerCase().includes(q) || f.receiverUsername.toLowerCase().includes(q)
        );
      }
      if (params.status) {
        filtered = filtered.filter((f) => f.status === params.status);
      }
      const start = (params.page - 1) * params.limit;
      return { data: filtered.slice(start, start + params.limit), total: filtered.length, page: params.page, limit: params.limit };
    },
  });
}
