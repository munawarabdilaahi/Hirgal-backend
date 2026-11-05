import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/auth-context';
import { useAuth } from '@/features/auth/auth-hooks';
import { RequireAuthenticated } from '@/features/auth/components/AuthRouteGuards';
import { DashboardRoute } from '@/features/auth/pages/DashboardRoute';
import { userQueryKeys } from '@/features/users/user-queries';
import type { ApiUser } from '@/services/api/contracts';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/services/api/tokenStore';

const { authApiMock } = vi.hoisted(() => ({
  authApiMock: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('@/services/api/authApi', () => ({
  authApi: authApiMock,
  authQueryKey: ['auth', 'me'],
}));

const signedInUser: ApiUser = {
  id: 1,
  name: 'Admin Amina',
  email: 'admin@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  permissions: ['users.view'],
};

function LogoutControl() {
  const { logout } = useAuth();

  return <button onClick={() => void logout().catch(() => undefined)}>Sign out</button>;
}

function ProtectedDashboard() {
  return (
    <RequireAuthenticated>
      <DashboardRoute />
    </RequireAuthenticated>
  );
}

function PermissionProbe() {
  const { user } = useAuth();

  return <p>{user?.permissions?.join(',') || 'No permissions'}</p>;
}

describe('AuthProvider query cache', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.clearAllMocks();
    authApiMock.getCurrentUser.mockResolvedValue(signedInUser);
  });

  afterEach(() => {
    clearAccessToken();
  });

  it('clears cached administrative data and the token when server logout fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const adminListKey = userQueryKeys.administrativeList({ page: 1 });
    queryClient.setQueryData(adminListKey, {
      success: true,
      message: 'Users loaded',
      data: [{ id: 42, email: 'private@example.test' }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    });
    setAccessToken('memory-token');
    authApiMock.logout.mockRejectedValue(new Error('Network unavailable'));

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><LogoutControl /></AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(getAccessToken()).toBeNull();
      expect(queryClient.getQueryData(adminListKey)).toBeUndefined();
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });
    expect(authApiMock.logout).toHaveBeenCalledOnce();
  });

  it('loads the authenticated user before rendering the dashboard without duplicate requests', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    setAccessToken('memory-token');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><AuthProvider><ProtectedDashboard /></AuthProvider></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Welcome, Admin Amina' })).toBeInTheDocument();
    expect(authApiMock.getCurrentUser).toHaveBeenCalledOnce();
  });

  it('shows session verification failure and renders the dashboard after retry succeeds', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    authApiMock.getCurrentUser
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(signedInUser);
    setAccessToken('memory-token');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><AuthProvider><ProtectedDashboard /></AuthProvider></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Unable to verify your session' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry session check' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Admin Amina' })).toBeInTheDocument();
    expect(authApiMock.getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('removes user data from the query cache when refreshed permissions change', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const adminListKey = userQueryKeys.administrativeList({ page: 1 });
    setAccessToken('memory-token');
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><PermissionProbe /></AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('users.view')).toBeInTheDocument();
    queryClient.setQueryData(adminListKey, {
      success: true,
      message: 'Users loaded',
      data: [{ id: 42, email: 'private@example.test' }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    });
    queryClient.setQueryData(['auth', 'me'], { ...signedInUser, permissions: [] });

    expect(await screen.findByText('No permissions')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(adminListKey)).toBeUndefined());
  });
});
