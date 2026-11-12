import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';

export function AuthenticatedRouteLayout() {
  const { pathname } = useLocation();
  const breadcrumb = pathname.startsWith('/users/')
    ? 'User details'
    : pathname.startsWith('/habits/') && pathname !== '/habits/new' && !pathname.endsWith('/edit')
      ? 'Habit details'
      : pathname.startsWith('/habits/') && (pathname === '/habits/new' || pathname.endsWith('/edit'))
        ? 'Habit editor'
        : ({
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/change-password': 'Change password',
    '/users': 'Users',
    '/projects': 'Projects',
    '/teams': 'Teams',
    '/tasks': 'Tasks',
    '/habits': 'Habits',
      }[pathname] ?? 'Workspace');

  return (
    <AppShell breadcrumb={breadcrumb}>
      <Outlet />
    </AppShell>
  );
}
