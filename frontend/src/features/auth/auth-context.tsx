import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue, type LoginResult } from '@/features/auth/auth-context-state';
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
    async (request: LoginRequest): Promise<LoginResult> => {
      const responseData = await authApi.login(request);

      if (responseData.two_factor_required) {
        return {
          two_factor_required: true,
          challenge_token: responseData.challenge_token,
          expires_at: responseData.expires_at,
        };
      }

      if (responseData.token_type !== 'Bearer' || !responseData.access_token) {
        throw new ApiError('The API returned an invalid authentication response.', 500);
      }

      setAccessToken(responseData.access_token);

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

        return {
          two_factor_required: false,
          user,
        };
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

  const verifyTwoFactor = useCallback(
    async (request: {
      challenge_token: string;
      code?: string;
      recovery_code?: string;
      device_name?: string;
    }): Promise<ApiUser> => {
      const tokenData = await authApi.verifyTwoFactor(request);

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

  const cancelTwoFactor = useCallback(
    async (challengeToken?: string): Promise<void> => {
      if (challengeToken) {
        try {
          await authApi.cancelTwoFactor(challengeToken);
        } catch {
          // Ignore cancellation errors
        }
      }
    },
    [],
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

  const user = token !== null ? currentUserQuery.data ?? null : null;
  const permissionsSignature = [...(user?.permissions ?? [])].sort().join('\u0000');
  const previousPermissionsSignature = useRef<string | null>(null);

  useEffect(() => {
    if (
      previousPermissionsSignature.current !== null
      && previousPermissionsSignature.current !== permissionsSignature
    ) {
      queryClient.removeQueries({ queryKey: ['users'] });
      queryClient.removeQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['teams'] });
    }

    previousPermissionsSignature.current = permissionsSignature;
  }, [permissionsSignature, queryClient]);

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
      verifyTwoFactor,
      cancelTwoFactor,
      logout,
      retrySession,
    }),
    [
      cancelTwoFactor,
      clearReason,
      currentUserQuery.error,
      currentUserQuery.isPending,
      login,
      logout,
      retrySession,
      token,
      user,
      verifyTwoFactor,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

