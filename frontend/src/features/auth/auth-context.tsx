import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context-state';
import { ApiError } from '@/services/api/ApiError';
import { authApi, authQueryKey } from '@/services/api/authApi';
import {
  clearAccessToken,
  getAccessToken,
  getTokenClearReason,
  setAccessToken,
  subscribeToAccessToken,
} from '@/services/api/tokenStore';
import type { ApiUser, LoginRequest } from '@/services/api/contracts';

const inactiveAccountMessage =
  'Your account is not active. Please contact an administrator.';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(
    subscribeToAccessToken,
    getAccessToken,
    getAccessToken,
  );
  const clearReason = useSyncExternalStore(
    subscribeToAccessToken,
    getTokenClearReason,
    getTokenClearReason,
  );
  const previousToken = useRef(token);
  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: authApi.getCurrentUser,
    enabled: token !== null,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (previousToken.current !== null && token === null) {
      queryClient.clear();
    }

    previousToken.current = token;
  }, [queryClient, token]);

  const login = useCallback(
    async (request: LoginRequest): Promise<ApiUser> => {
      const tokenData = await authApi.login(request);

      if (tokenData.token_type !== 'Bearer' || !tokenData.access_token) {
        throw new ApiError('The API returned an invalid authentication response.', 500);
      }

      setAccessToken(tokenData.access_token);

      try {
        const user = await queryClient.fetchQuery({
          queryKey: authQueryKey,
          queryFn: authApi.getCurrentUser,
          staleTime: 0,
          retry: false,
        });

        if (user.account_status !== 'active') {
          clearAccessToken('account_inactive');
          throw new ApiError(inactiveAccountMessage, 403, 'ACCOUNT_NOT_ACTIVE');
        }

        return user;
      } catch (error: unknown) {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          error.code === 'ACCOUNT_NOT_ACTIVE'
        ) {
          clearAccessToken('account_inactive');
        }

        throw error;
      }
    },
    [queryClient],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (getAccessToken()) {
        await authApi.logout();
      }
    } finally {
      clearAccessToken('logout');
      queryClient.clear();
    }
  }, [queryClient]);

  const retrySession = useCallback(async (): Promise<ApiUser> => {
    const user = await queryClient.fetchQuery({
      queryKey: authQueryKey,
      queryFn: authApi.getCurrentUser,
      staleTime: 0,
      retry: false,
    });

    if (user.account_status !== 'active') {
      clearAccessToken('account_inactive');
      throw new ApiError(inactiveAccountMessage, 403, 'ACCOUNT_NOT_ACTIVE');
    }

    return user;
  }, [queryClient]);

  const user = currentUserQuery.data ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hasSession: token !== null,
      isAuthenticated: token !== null && user?.account_status === 'active',
      isInitializing: token !== null && currentUserQuery.isPending,
      sessionError:
        token !== null && currentUserQuery.error instanceof Error
          ? currentUserQuery.error
          : null,
      sessionMessage:
        clearReason === 'account_inactive' ? inactiveAccountMessage : null,
      login,
      logout,
      retrySession,
    }),
    [
      clearReason,
      currentUserQuery.error,
      currentUserQuery.isPending,
      login,
      logout,
      retrySession,
      token,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

