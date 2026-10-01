import { QueryClient } from '@tanstack/react-query';

/**
 * One client-side cache for server state. Authentication still comes from the
 * secure HttpOnly session cookie; this cache never stores credentials.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
