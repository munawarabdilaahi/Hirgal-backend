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
  RedirectAuthenticatedUser,
  RequireAuthenticated,
} from '@/features/auth/components/AuthRouteGuards';
import { ChangePasswordRoute } from '@/features/auth/pages/ChangePasswordRoute';
import { DashboardRoute } from '@/features/auth/pages/DashboardRoute';
import { ForgotPasswordRoute } from '@/features/auth/pages/ForgotPasswordRoute';
import { LoginRoute } from '@/features/auth/pages/LoginRoute';
import { ProfileRoute } from '@/features/auth/pages/ProfileRoute';
import { ResetPasswordRoute } from '@/features/auth/pages/ResetPasswordRoute';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <RedirectAuthenticatedUser>
        <LoginRoute />
      </RedirectAuthenticatedUser>
    ),
  },
  { path: '/forgot-password', element: <ForgotPasswordRoute /> },
  { path: '/reset-password', element: <ResetPasswordRoute /> },
  {
    element: (
      <RequireAuthenticated>
        <AuthenticatedRouteLayout />
      </RequireAuthenticated>
    ),
    children: [
      { path: '/dashboard', element: <DashboardRoute /> },
      { path: '/profile', element: <ProfileRoute /> },
      { path: '/change-password', element: <ChangePasswordRoute /> },
      {
        path: '/users',
        element: <ProtectedDeferredRoute name="Users" permission="users.view_directory" />,
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
