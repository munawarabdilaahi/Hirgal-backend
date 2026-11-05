import { createContext } from 'react';
import type { ApiUser, LoginRequest } from '@/services/api/contracts';

export interface AuthContextValue {
  user: ApiUser | null;
  hasSession: boolean;
  isAuthenticated: boolean;
  isInitializing: boolean;
  sessionError: Error | null;
  sessionMessage: string | null;
  login: (request: LoginRequest) => Promise<ApiUser>;
  logout: () => Promise<void>;
  retrySession: () => Promise<ApiUser>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
