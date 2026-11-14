import { router } from '@inertiajs/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ProfileForm } from '@/features/auth/pages/ProfileRoute';
import type { ApiUser } from '@/services/api/contracts';
import { submitWebForm } from './submitWebForm';

export default function Profile({ user, frontendUrl }: { user: ApiUser; frontendUrl: string }) {
  return (
    <MemoryRouter initialEntries={['/profile']}>
      <AppShell
        breadcrumb="Profile"
        session={{ user, frontendUrl, logout: () => router.post('/logout', {}, { replace: true }) }}
      >
        <ProfileForm user={user} save={async (request) => {
          const page = await submitWebForm('put', '/profile', { ...request });
          return page.props.user as ApiUser;
        }} />
      </AppShell>
    </MemoryRouter>
  );
}
