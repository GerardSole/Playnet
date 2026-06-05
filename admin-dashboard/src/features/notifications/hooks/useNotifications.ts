import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_NOTIFICATIONS } from '../../../lib/mockData';
import type { Notification, PaginatedResponse } from '../../../api/types';

// TODO: replace with GET /api/v1/admin/notifications when admin endpoint is available
export function useNotifications(params: { page: number; limit: number; q: string; type: string }) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: async (): Promise<PaginatedResponse<Notification>> => {
      await new Promise((r) => setTimeout(r, 150));
      let filtered = MOCK_NOTIFICATIONS;
      if (params.q) {
        const q = params.q.toLowerCase();
        filtered = filtered.filter((n) => n.username.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
      }
      if (params.type) {
        filtered = filtered.filter((n) => n.type === params.type);
      }
      const start = (params.page - 1) * params.limit;
      return { data: filtered.slice(start, start + params.limit), total: filtered.length, page: params.page, limit: params.limit };
    },
  });
}
