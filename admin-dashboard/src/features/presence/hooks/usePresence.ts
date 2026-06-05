import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { MOCK_PRESENCE } from '../../../lib/mockData';
import type { PresenceEntry } from '../../../api/types';

// TODO: replace with GET /api/v1/admin/presence when endpoint is available
// Polls every 15 seconds to simulate live presence
export function usePresence() {
  return useQuery({
    queryKey: queryKeys.presence.online(),
    queryFn: async (): Promise<PresenceEntry[]> => {
      await new Promise((r) => setTimeout(r, 100));
      return MOCK_PRESENCE;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
