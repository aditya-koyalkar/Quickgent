import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  authApi,
  type AuthUser,
  type AuthResponse,
  type SignUpPayload,
  type SignInPayload,
} from '../lib/api';

// ── Query Keys ──────────────────────────────────────────────────────
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

// ── Queries ─────────────────────────────────────────────────────────
export function useMe(
  options?: Partial<UseQueryOptions<AuthUser, Error>>,
) {
  return useQuery<AuthUser, Error>({
    queryKey: authKeys.me(),
    queryFn: authApi.getMe,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
    ...options,
  });
}

// ── Mutations ───────────────────────────────────────────────────────
export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, Error, SignUpPayload>({
    mutationFn: authApi.signUp,
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data.user);
    },
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, Error, SignInPayload>({
    mutationFn: authApi.signIn,
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, void>({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

export function useLogoutAll() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, void>({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}
