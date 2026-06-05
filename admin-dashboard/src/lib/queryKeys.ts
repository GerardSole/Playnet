export const queryKeys = {
  health: {
    status: () => ['health'] as const,
  },
  players: {
    all: () => ['players'] as const,
    list: (params: Record<string, unknown>) => ['players', 'list', params] as const,
    detail: (id: string) => ['players', 'detail', id] as const,
  },
  friends: {
    all: () => ['friends'] as const,
    byPlayer: (playerId: string) => ['friends', playerId] as const,
  },
  presence: {
    online: () => ['presence', 'online'] as const,
  },
  matches: {
    all: () => ['matches'] as const,
    list: (params: Record<string, unknown>) => ['matches', 'list', params] as const,
    detail: (id: string) => ['matches', 'detail', id] as const,
  },
  leaderboards: {
    all: () => ['leaderboards'] as const,
    list: () => ['leaderboards', 'list'] as const,
    detail: (id: string) => ['leaderboards', 'detail', id] as const,
    rankings: (id: string, params: Record<string, unknown>) =>
      ['leaderboards', id, 'rankings', params] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    list: (params: Record<string, unknown>) => ['notifications', 'list', params] as const,
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
  },
};
