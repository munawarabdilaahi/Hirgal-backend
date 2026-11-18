import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-hooks';
import { authApi, authQueryKey } from '@/services/api/authApi';
import type { ApiUser, UpdateProfileRequest } from '@/services/api/contracts';
import { AccountSettings } from './AccountSettings';

export function AccountSettingsRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<ApiUser | null>(user);

  useEffect(() => {
    setCurrent(user);
  }, [user]);

  if (!current) {
    return null;
  }

  async function save(payload: UpdateProfileRequest): Promise<void> {
    const updated = await authApi.updateProfile(payload);
    setCurrent(updated);
    queryClient.setQueryData(authQueryKey, updated);
  }

  async function signOut(): Promise<void> {
    try {
      await logout();
    } catch {
      // The server session may already be revoked (deactivation/deletion).
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <AccountSettings
      onSignedOut={() => void signOut()}
      onUserChanged={(updated) => {
        setCurrent(updated);
        queryClient.setQueryData(authQueryKey, updated);
      }}
      save={save}
      user={current}
    />
  );
}
