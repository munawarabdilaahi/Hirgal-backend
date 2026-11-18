import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { AccountSettings } from '@/features/account/AccountSettings';
import { enableWebSession } from '@/services/api/apiClient';
import { authApi } from '@/services/api/authApi';
import type { ApiUser, UpdateProfileRequest } from '@/services/api/contracts';

enableWebSession();

export default function AccountSettingsPage({ user, frontendUrl }: { user: ApiUser; frontendUrl: string }) {
  const [current, setCurrent] = useState(user);

  useEffect(() => {
    setCurrent(user);
  }, [user]);

  async function save(payload: UpdateProfileRequest): Promise<void> {
    const updated = await authApi.updateProfile(payload);
    setCurrent(updated);
  }

  function signedOut() {
    window.location.assign('/login');
  }

  const search = typeof window === 'undefined' ? '' : window.location.search;

  return (
    <MemoryRouter initialEntries={[`/profile${search}`]}>
      <AppShell
        breadcrumb="Account settings"
        session={{ user: current, frontendUrl, logout: () => router.post('/logout', {}, { replace: true }) }}
      >
        <AccountSettings
          onSignedOut={signedOut}
          onUserChanged={setCurrent}
          save={save}
          user={current}
        />
      </AppShell>
    </MemoryRouter>
  );
}
