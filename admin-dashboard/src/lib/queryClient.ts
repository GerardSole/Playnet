import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: (count, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status;
        if (status && status < 500) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
