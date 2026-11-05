import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';

export function AuthenticatedRouteLayout() {
  const { pathname } = useLocation();
  const breadcrumb = pathname.startsWith('/users/')
    ? 'User details'
    : ({
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/change-password': 'Change password',
    '/users': 'Users',
    '/projects': 'Projects',
    '/teams': 'Teams',
    '/tasks': 'Tasks',
      }[pathname] ?? 'Workspace');

  return (
    <AppShell breadcrumb={breadcrumb}>
      <Outlet />
    </AppShell>
  );
}
