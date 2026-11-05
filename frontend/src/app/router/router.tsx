import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom';
import { AuthenticatedRouteLayout } from '@/app/router/routes/AuthenticatedRouteLayout';
import { DesignSystemLoadingFallback } from '@/app/router/routes/DesignSystemLoadingFallback';
import { NotFoundRoute } from '@/app/router/routes/NotFoundRoute';
import { ProtectedDeferredRoute } from '@/app/router/routes/ProtectedDeferredRoute';
import {
  ChangePasswordPage,
  DashboardPage,
  ForgotPasswordPage,
  LoginPage,
  ProfilePage,
  ResetPasswordPage,
  UserDetailsPage,
  UsersPage,
} from '@/app/router/routes/LazyPages';
import {
  RequireAnyPermission,
  RedirectAuthenticatedUser,
  RequirePermission,
  RequireAuthenticated,
} from '@/features/auth/components/AuthRouteGuards';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <RedirectAuthenticatedUser>
      <LoginPage />
      </RedirectAuthenticatedUser>
    ),
  },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: (
      <RequireAuthenticated>
        <AuthenticatedRouteLayout />
      </RequireAuthenticated>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/change-password', element: <ChangePasswordPage /> },
      {
        path: '/users',
        element: (
          <RequireAnyPermission permissions={['users.view_directory', 'users.view']}>
            <UsersPage />
          </RequireAnyPermission>
        ),
      },
      {
        path: '/users/:userId',
        element: (
          <RequirePermission permission="users.view">
            <UserDetailsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/projects',
        element: <ProtectedDeferredRoute name="Projects" permission="projects.view" />,
      },
      {
        path: '/teams',
        element: <ProtectedDeferredRoute name="Teams" permission="teams.view" />,
      },
      {
        path: '/tasks',
        element: <ProtectedDeferredRoute name="Tasks" permission="tasks.view" />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundRoute />,
  },
];

if (import.meta.env.DEV) {
  routes.push({
    path: '/dev/design-system',
    HydrateFallback: DesignSystemLoadingFallback,
    lazy: async () => {
      const { DesignSystemShowcaseRoute } = await import(
        '@/app/router/routes/DesignSystemShowcaseRoute'
      );

      return { Component: DesignSystemShowcaseRoute };
    },
  });
}

export const router = createBrowserRouter(routes);
