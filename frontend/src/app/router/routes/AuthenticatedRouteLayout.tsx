import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { workspaceBreadcrumb } from '@/components/layout/workspace-breadcrumb';

export function AuthenticatedRouteLayout() {
  const { pathname } = useLocation();
  return (
    <AppShell breadcrumb={workspaceBreadcrumb(pathname)} wide={pathname === '/tasks' || pathname === '/my-work'}>
      <Outlet />
    </AppShell>
  );
}
