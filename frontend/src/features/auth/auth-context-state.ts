import { createContext } from 'react';
import type { ApiUser, LoginRequest } from '@/services/api/contracts';

export interface LoginResult {
  two_factor_required: boolean;
  challenge_token?: string;
  expires_at?: string;
  user?: ApiUser;
}

export interface AuthContextValue {
  user: ApiUser | null;
  hasSession: boolean;
  isAuthenticated: boolean;
  isInitializing: boolean;
  sessionError: Error | null;
  sessionMessage: string | null;
  login: (request: LoginRequest) => Promise<LoginResult>;
  verifyTwoFactor: (request: {
    challenge_token: string;
    code?: string;
    recovery_code?: string;
    device_name?: string;
  }) => Promise<ApiUser>;
  cancelTwoFactor: (challengeToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => Promise<ApiUser>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
