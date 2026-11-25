import { router } from '@inertiajs/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Dashboard } from '@/features/auth/pages/DashboardRoute';
import { enableWebSession } from '@/services/api/apiClient';
import type { ApiUser } from '@/services/api/contracts';

enableWebSession();

export default function DashboardPage({ user, frontendUrl }: { user: ApiUser; frontendUrl: string }) {
  return (
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppShell
        breadcrumb="Dashboard"
        session={{ user, frontendUrl, logout: () => router.post('/logout', {}, { replace: true }) }}
      >
        <Dashboard frontendUrl={frontendUrl} user={user} />
      </AppShell>
    </MemoryRouter>
  );
}
