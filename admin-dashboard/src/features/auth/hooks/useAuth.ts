import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { EP } from '../../../api/endpoints';
import { useAuthContext } from '../AuthContext';
import type { LoginResponse } from '../../../api/types';

export function useAuth() {
  const ctx = useAuthContext();
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data } = await apiClient.post<LoginResponse>(EP.login, { email, password });
      return data;
    },
    onSuccess: (data) => {
      // Store the admin user info — in a real setup this would come from the token payload
      const fakeUser = { id: 'admin', username: email_ref, email: email_ref };
      ctx.login(data.accessToken, data.refreshToken, fakeUser);
      navigate('/');
    },
  });

  // Capture email for the fake user object
  let email_ref = '';
  const login = (email: string, password: string) => {
    email_ref = email.split('@')[0];
    return loginMutation.mutateAsync({ email, password });
  };

  const logout = () => {
    ctx.logout();
    navigate('/login');
  };

  return {
    user: ctx.user,
    isAuthenticated: ctx.isAuthenticated,
    login,
    logout,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
  };
}
