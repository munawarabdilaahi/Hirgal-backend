import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context-state';
import type { ApiUser } from '@/services/api/contracts';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}

export function useRetryAuthSession(): () => Promise<ApiUser> {
  return useAuth().retrySession;
}
