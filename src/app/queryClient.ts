import { QueryClient } from '@tanstack/react-query';

/**
 * One client-side cache for server state. Authentication still comes from the
 * secure HttpOnly session cookie; this cache never stores credentials.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});
