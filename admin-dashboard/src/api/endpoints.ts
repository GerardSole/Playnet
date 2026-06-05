// Real endpoints available in the Mini-Nakama backend
export const EP = {
  // Auth
  login:   '/auth/login',
  refresh: '/auth/refresh',
  logout:  '/auth/logout',

  // Users (admin needs player detail, list not available → mock)
  userDetail: (id: string) => `/users/${id}`,

  // Leaderboards (real endpoints)
  leaderboards:        '/leaderboards',
  leaderboardDetail:   (id: string) => `/leaderboards/${id}`,
  leaderboardPlayer:   (id: string, playerId: string) => `/leaderboards/${id}/player/${playerId}`,

  // Health (real endpoint at root)
  health: '/health',

  // Matchmaking (real endpoints)
  matchmakingJoin:  '/matchmaking/join',
  matchmakingLeave: '/matchmaking/leave',
} as const;
