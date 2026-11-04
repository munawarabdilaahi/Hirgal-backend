import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { DeferredRoute } from '@/app/router/routes/DeferredRoute';
import { DesignSystemLoadingFallback } from '@/app/router/routes/DesignSystemLoadingFallback';
import { NotFoundRoute } from '@/app/router/routes/NotFoundRoute';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <DeferredRoute name="Authentication" />,
  },
  {
    path: '/dashboard',
    element: <DeferredRoute name="Dashboard" />,
  },
  {
    path: '/users',
    element: <DeferredRoute name="Users" />,
  },
  {
    path: '/projects',
    element: <DeferredRoute name="Projects" />,
  },
  {
    path: '/teams',
    element: <DeferredRoute name="Teams" />,
  },
  {
    path: '/tasks',
    element: <DeferredRoute name="Tasks" />,
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
