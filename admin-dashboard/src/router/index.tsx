import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { PlayersPage } from '../features/players/PlayersPage';
import { PlayerDetailPage } from '../features/players/PlayerDetailPage';
import { FriendsPage } from '../features/friends/FriendsPage';
import { PresencePage } from '../features/presence/PresencePage';
import { MatchesPage } from '../features/matches/MatchesPage';
import { LeaderboardsPage } from '../features/leaderboards/LeaderboardsPage';
import { LeaderboardDetailPage } from '../features/leaderboards/LeaderboardDetailPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { HealthPage } from '../features/health/HealthPage';
import { useAuthContext } from '../features/auth/AuthContext';
import type { ReactNode } from 'react';

function Guard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <Guard><AppShell /></Guard>,
    children: [
      { path: '/',              element: <DashboardPage /> },
      { path: '/players',       element: <PlayersPage /> },
      { path: '/players/:id',   element: <PlayerDetailPage /> },
      { path: '/friends',       element: <FriendsPage /> },
      { path: '/presence',      element: <PresencePage /> },
      { path: '/matches',       element: <MatchesPage /> },
      { path: '/leaderboards',  element: <LeaderboardsPage /> },
      { path: '/leaderboards/:id', element: <LeaderboardDetailPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/health',        element: <HealthPage /> },
      { path: '*',              element: <Navigate to="/" replace /> },
    ],
  },
]);
