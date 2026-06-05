import type { Player, Friendship, Match, Leaderboard, LeaderboardEntry, Notification, PresenceEntry } from '../api/types';

// ── Deterministic mock data (replace with real admin endpoints when available) ─

export const MOCK_PLAYERS: Player[] = [
  { id: 'a1b2c3d4-0000-0000-0000-000000000001', username: 'darkslayer99', email: 'dark@game.local', displayName: 'DarkSlayer', createdAt: '2024-11-01T10:00:00Z', updatedAt: '2025-01-15T08:30:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000002', username: 'neonrider', email: 'neon@game.local', displayName: 'NeonRider', createdAt: '2024-11-05T14:20:00Z', updatedAt: '2025-01-14T21:00:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000003', username: 'ghostwitch', email: 'ghost@game.local', displayName: 'GhostWitch', createdAt: '2024-11-10T09:15:00Z', updatedAt: '2025-01-15T10:15:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000004', username: 'voidhunter', email: 'void@game.local', displayName: 'VoidHunter', createdAt: '2024-11-12T17:45:00Z', updatedAt: '2025-01-13T16:45:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000005', username: 'stellarwolf', email: 'stellar@game.local', displayName: 'StellarWolf', createdAt: '2024-11-15T11:30:00Z', updatedAt: '2025-01-15T09:00:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000006', username: 'ironphoenix', email: 'iron@game.local', displayName: 'IronPhoenix', createdAt: '2024-11-20T08:00:00Z', updatedAt: '2025-01-12T18:30:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000007', username: 'crystalblade', email: 'crystal@game.local', displayName: 'CrystalBlade', createdAt: '2024-11-22T13:10:00Z', updatedAt: '2025-01-15T11:00:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000008', username: 'shadowrealm', email: 'shadow@game.local', displayName: 'ShadowRealm', createdAt: '2024-12-01T10:00:00Z', updatedAt: '2025-01-14T14:00:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000009', username: 'quantumstrike', email: 'quantum@game.local', displayName: 'QuantumStrike', createdAt: '2024-12-05T15:30:00Z', updatedAt: '2025-01-15T07:45:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000010', username: 'blazerunner', email: 'blaze@game.local', displayName: 'BlazeRunner', createdAt: '2024-12-10T09:00:00Z', updatedAt: '2025-01-11T20:00:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000011', username: 'frostbyte', email: 'frost@game.local', displayName: 'FrostByte', createdAt: '2024-12-15T12:00:00Z', updatedAt: '2025-01-15T06:30:00Z' },
  { id: 'a1b2c3d4-0000-0000-0000-000000000012', username: 'thunderlord', email: 'thunder@game.local', displayName: 'ThunderLord', createdAt: '2024-12-20T16:00:00Z', updatedAt: '2025-01-10T11:00:00Z' },
];

export const MOCK_FRIENDSHIPS: Friendship[] = [
  { id: 'f001', senderId: MOCK_PLAYERS[0].id, receiverId: MOCK_PLAYERS[1].id, senderUsername: 'darkslayer99', receiverUsername: 'neonrider', status: 'accepted', createdAt: '2024-11-10T10:00:00Z' },
  { id: 'f002', senderId: MOCK_PLAYERS[2].id, receiverId: MOCK_PLAYERS[0].id, senderUsername: 'ghostwitch', receiverUsername: 'darkslayer99', status: 'accepted', createdAt: '2024-11-11T12:00:00Z' },
  { id: 'f003', senderId: MOCK_PLAYERS[3].id, receiverId: MOCK_PLAYERS[4].id, senderUsername: 'voidhunter', receiverUsername: 'stellarwolf', status: 'pending', createdAt: '2024-11-12T14:00:00Z' },
  { id: 'f004', senderId: MOCK_PLAYERS[5].id, receiverId: MOCK_PLAYERS[6].id, senderUsername: 'ironphoenix', receiverUsername: 'crystalblade', status: 'accepted', createdAt: '2024-11-22T09:00:00Z' },
  { id: 'f005', senderId: MOCK_PLAYERS[7].id, receiverId: MOCK_PLAYERS[8].id, senderUsername: 'shadowrealm', receiverUsername: 'quantumstrike', status: 'accepted', createdAt: '2024-12-01T15:00:00Z' },
  { id: 'f006', senderId: MOCK_PLAYERS[1].id, receiverId: MOCK_PLAYERS[9].id, senderUsername: 'neonrider', receiverUsername: 'blazerunner', status: 'rejected', createdAt: '2024-12-05T11:00:00Z' },
  { id: 'f007', senderId: MOCK_PLAYERS[10].id, receiverId: MOCK_PLAYERS[11].id, senderUsername: 'frostbyte', receiverUsername: 'thunderlord', status: 'accepted', createdAt: '2024-12-20T08:00:00Z' },
];

export const MOCK_MATCHES: Match[] = [
  { id: 'm001', mode: 'ranked', state: 'completed', playerIds: [MOCK_PLAYERS[0].id, MOCK_PLAYERS[1].id], playerUsernames: ['darkslayer99', 'neonrider'], createdAt: '2025-01-15T08:00:00Z', completedAt: '2025-01-15T08:18:00Z' },
  { id: 'm002', mode: 'casual', state: 'active', playerIds: [MOCK_PLAYERS[2].id, MOCK_PLAYERS[3].id], playerUsernames: ['ghostwitch', 'voidhunter'], createdAt: '2025-01-15T09:30:00Z', completedAt: undefined },
  { id: 'm003', mode: 'ranked', state: 'completed', playerIds: [MOCK_PLAYERS[4].id, MOCK_PLAYERS[5].id], playerUsernames: ['stellarwolf', 'ironphoenix'], createdAt: '2025-01-14T21:00:00Z', completedAt: '2025-01-14T21:25:00Z' },
  { id: 'm004', mode: 'tournament', state: 'active', playerIds: [MOCK_PLAYERS[6].id, MOCK_PLAYERS[7].id], playerUsernames: ['crystalblade', 'shadowrealm'], createdAt: '2025-01-15T10:00:00Z', completedAt: undefined },
  { id: 'm005', mode: 'casual', state: 'completed', playerIds: [MOCK_PLAYERS[8].id, MOCK_PLAYERS[9].id], playerUsernames: ['quantumstrike', 'blazerunner'], createdAt: '2025-01-14T18:00:00Z', completedAt: '2025-01-14T18:12:00Z' },
  { id: 'm006', mode: 'ranked', state: 'completed', playerIds: [MOCK_PLAYERS[10].id, MOCK_PLAYERS[11].id], playerUsernames: ['frostbyte', 'thunderlord'], createdAt: '2025-01-14T16:00:00Z', completedAt: '2025-01-14T16:31:00Z' },
];

export const MOCK_LEADERBOARDS: Leaderboard[] = [
  { id: 'lb001', name: 'Global Ranked', entryCount: 8, createdAt: '2024-11-01T00:00:00Z' },
  { id: 'lb002', name: 'Weekly Challenge', entryCount: 5, createdAt: '2024-12-01T00:00:00Z' },
  { id: 'lb003', name: 'Season 1', entryCount: 10, createdAt: '2024-10-01T00:00:00Z' },
];

export const MOCK_RANKINGS: LeaderboardEntry[] = [
  { rank: 1, userId: MOCK_PLAYERS[0].id, username: 'darkslayer99', score: 9850, submittedAt: '2025-01-14T20:00:00Z' },
  { rank: 2, userId: MOCK_PLAYERS[4].id, username: 'stellarwolf', score: 9200, submittedAt: '2025-01-14T21:30:00Z' },
  { rank: 3, userId: MOCK_PLAYERS[6].id, username: 'crystalblade', score: 8750, submittedAt: '2025-01-15T09:00:00Z' },
  { rank: 4, userId: MOCK_PLAYERS[2].id, username: 'ghostwitch', score: 8400, submittedAt: '2025-01-13T15:00:00Z' },
  { rank: 5, userId: MOCK_PLAYERS[8].id, username: 'quantumstrike', score: 7900, submittedAt: '2025-01-12T10:00:00Z' },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n001', userId: MOCK_PLAYERS[0].id, username: 'darkslayer99', type: 'friend_request', content: 'GhostWitch sent you a friend request', read: false, createdAt: '2025-01-15T09:00:00Z' },
  { id: 'n002', userId: MOCK_PLAYERS[1].id, username: 'neonrider', type: 'match_result', content: 'You won your last ranked match', read: true, createdAt: '2025-01-15T08:20:00Z' },
  { id: 'n003', userId: MOCK_PLAYERS[2].id, username: 'ghostwitch', type: 'system', content: 'Welcome to Season 2', read: false, createdAt: '2025-01-14T00:00:00Z' },
  { id: 'n004', userId: MOCK_PLAYERS[3].id, username: 'voidhunter', type: 'friend_request', content: 'StellarWolf accepted your request', read: true, createdAt: '2025-01-13T12:00:00Z' },
  { id: 'n005', userId: MOCK_PLAYERS[4].id, username: 'stellarwolf', type: 'leaderboard', content: 'You moved up to #2 in Global Ranked', read: false, createdAt: '2025-01-14T22:00:00Z' },
  { id: 'n006', userId: MOCK_PLAYERS[5].id, username: 'ironphoenix', type: 'match_result', content: 'Match completed — defeat in ranked', read: true, createdAt: '2025-01-14T21:30:00Z' },
];

export const MOCK_PRESENCE: PresenceEntry[] = [
  { userId: MOCK_PLAYERS[2].id, username: 'ghostwitch', socketId: 'sk_a1b2c3', onlineSince: '2025-01-15T09:28:00Z' },
  { userId: MOCK_PLAYERS[3].id, username: 'voidhunter', socketId: 'sk_d4e5f6', onlineSince: '2025-01-15T09:29:00Z' },
  { userId: MOCK_PLAYERS[6].id, username: 'crystalblade', socketId: 'sk_g7h8i9', onlineSince: '2025-01-15T09:58:00Z' },
  { userId: MOCK_PLAYERS[7].id, username: 'shadowrealm', socketId: 'sk_j1k2l3', onlineSince: '2025-01-15T09:59:00Z' },
];
