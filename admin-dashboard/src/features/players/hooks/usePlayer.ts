import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { EP } from '../../../api/endpoints';
import { queryKeys } from '../../../lib/queryKeys';
import type { Player } from '../../../api/types';

export function usePlayer(id: string) {
  return useQuery({
    queryKey: queryKeys.players.detail(id),
    queryFn: async (): Promise<Player> => {
      const { data } = await apiClient.get<{ data: Player }>(EP.userDetail(id));
      return data.data;
    },
    enabled: !!id,
  });
}
