import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequirePermission } from '@/features/auth/components/AuthRouteGuards';
import { UserDetailsRoute } from '@/features/users/pages/UserDetailsRoute';
import { userQueryKeys } from '@/features/users/user-queries';
import { ApiError } from '@/services/api/ApiError';
import type { ApiUser } from '@/services/api/contracts';

const { authMock, userApiMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userApiMock: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
    activateUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: authMock }));
vi.mock('@/services/api/userApi', () => ({ userApi: userApiMock }));

const memberRole = { id: 4, name: 'Member', slug: 'member' as const, description: null, is_system: false };
const adminActor: ApiUser = {
  id: 1,
  name: 'Admin Amina',
  email: 'admin@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  roles: [{ ...memberRole, id: 1, name: 'System Admin', slug: 'system-admin' }],
  permissions: ['users.view', 'users.update', 'users.delete'],
};
const targetUser: ApiUser = {
  id: 42,
  name: 'Sam Lee',
  email: 'sam@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'UTC',
  email_verified_at: null,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00Z',
  profile: {
    id: 42,
    phone: '555-0100',
    job_title: 'Designer',
    department: 'Design',
    bio: null,
    notification_preferences: {},
    theme_preference: 'system',
    created_at: null,
    updated_at: null,
  },
  roles: [memberRole],
  permissions: [],
};

function setup({
  actor = adminActor,
  getUser = () => Promise.resolve(targetUser),
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  }),
}: {
  actor?: ApiUser;
  getUser?: () => Promise<ApiUser>;
  queryClient?: QueryClient;
} = {}) {
  authMock.mockReturnValue({ user: actor });
  userApiMock.getUser.mockImplementation(getUser);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/users/42']}>
        <Routes>
          <Route
            element={(
              <RequirePermission permission="users.view">
                <UserDetailsRoute />
              </RequirePermission>
            )}
            path="/users/:userId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { queryClient, ...result };
}

describe('UserDetailsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApiMock.updateUser.mockResolvedValue(targetUser);
    userApiMock.activateUser.mockResolvedValue({ ...targetUser, account_status: 'active' });
    userApiMock.deactivateUser.mockResolvedValue({ ...targetUser, account_status: 'suspended' });
  });

  it('shows a loading state while user details load, then renders the administrative resource', async () => {
    let resolveUser: ((user: ApiUser) => void) | undefined;
    const pendingUser = new Promise<ApiUser>((resolve) => { resolveUser = resolve; });

    setup({ getUser: vi.fn(() => pendingUser) });

    expect(screen.getByText('Loading user details')).toBeInTheDocument();
    resolveUser?.(targetUser);

    expect(await screen.findByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Designer')).toBeInTheDocument();
    expect(userApiMock.getUser).toHaveBeenCalledWith(42);
  });

  it.each([
    [403, 'Your account is not allowed to view this user. Administrative details are restricted.'],
    [404, 'This user no longer exists or is outside your access scope.'],
    [500, 'The server could not load this user right now. Try again shortly.'],
  ])('shows the appropriate detail error for HTTP %i', async (status, message) => {
    setup({ getUser: vi.fn().mockRejectedValue(new ApiError('Request failed', status)) });

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to users' })).toHaveAttribute('href', '/users');
  });

  it('retries a failed detail request and renders the user after recovery', async () => {
    const getUser = vi.fn()
      .mockRejectedValueOnce(new ApiError('Not found', 404))
      .mockResolvedValueOnce(targetUser);
    const user = userEvent.setup();
    setup({ getUser });

    await screen.findByText('This user no longer exists or is outside your access scope.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Sam Lee')).toBeInTheDocument();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('keeps the detail route administrative-only for a user without users.view', () => {
    setup({ actor: { ...adminActor, permissions: [] } });

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('Sam Lee')).not.toBeInTheDocument();
    expect(userApiMock.getUser).not.toHaveBeenCalled();
  });

  it('keeps self-account data in the profile route instead of adding a self detail view', () => {
    setup({ actor: { ...adminActor, id: targetUser.id, permissions: [] } });

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('Sam Lee')).not.toBeInTheDocument();
    expect(userApiMock.getUser).not.toHaveBeenCalled();
  });

  it('does not reveal previously cached administrative details after permission is absent', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(userQueryKeys.detail(targetUser.id), targetUser);

    setup({ actor: { ...adminActor, permissions: [] }, queryClient });

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('Sam Lee')).not.toBeInTheDocument();
    expect(userApiMock.getUser).not.toHaveBeenCalled();
  });

  it('does not render administrative edit or account actions without their permissions', async () => {
    setup({ actor: { ...adminActor, permissions: ['users.view'] } });

    expect(await screen.findByText('Sam Lee')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save user details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend account' })).not.toBeInTheDocument();
    expect(screen.getByText('You do not have permission to change this account’s status.')).toBeInTheDocument();
  });

  it('does not expose self-suspension controls', async () => {
    const self = { ...targetUser, id: adminActor.id, name: adminActor.name };
    setup({ actor: adminActor, getUser: () => Promise.resolve(self) });

    expect(await screen.findByText(adminActor.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend account' })).not.toBeInTheDocument();
    expect(screen.getByText('You cannot change your own account status here.')).toBeInTheDocument();
  });

  it('hides update and status actions for a System Admin target when the actor is not a System Admin', async () => {
    const systemAdminTarget = {
      ...targetUser,
      roles: [{ ...memberRole, id: 99, name: 'System Admin', slug: 'system-admin' as const }],
    };
    const actor = { ...adminActor, roles: [memberRole], permissions: ['users.view', 'users.update', 'users.delete'] };
    setup({ actor, getUser: () => Promise.resolve(systemAdminTarget) });

    expect(await screen.findByText('System administrator account')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save user details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend account' })).not.toBeInTheDocument();
  });

  it('submits only supported profile fields and updates the detail and list caches', async () => {
    const user = userEvent.setup();
    const updatedUser = { ...targetUser, name: 'Sam Lee Updated', email: 'sam.updated@example.test' };
    userApiMock.updateUser.mockResolvedValue(updatedUser);
    const { queryClient } = setup();
    const listKey = userQueryKeys.administrativeList({ page: 1 });
    queryClient.setQueryData(listKey, {
      success: true,
      message: 'Users loaded',
      data: [targetUser],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    });

    await screen.findByText('Sam Lee');
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/account status/i)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Name/));
    await user.type(screen.getByLabelText(/^Name/), updatedUser.name);
    await user.clear(screen.getByLabelText(/^Email address/));
    await user.type(screen.getByLabelText(/^Email address/), updatedUser.email);
    await user.click(screen.getByRole('button', { name: 'Save user details' }));

    await waitFor(() => expect(userApiMock.updateUser).toHaveBeenCalledWith(42, {
      name: updatedUser.name,
      email: updatedUser.email,
      timezone: 'UTC',
    }));
    expect(await screen.findByText(updatedUser.name)).toBeInTheDocument();
    expect(queryClient.getQueryData(userQueryKeys.detail(42))).toEqual(updatedUser);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it('blocks invalid name and email values before making an update request', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Sam Lee');

    await user.clear(screen.getByLabelText(/^Name/));
    await user.clear(screen.getByLabelText(/^Email address/));
    await user.type(screen.getByLabelText(/^Email address/), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save user details' }));

    expect(await screen.findByText('Enter the user’s name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(userApiMock.updateUser).not.toHaveBeenCalled();
  });

  it('shows backend 422 field validation and preserves the current cached user', async () => {
    const user = userEvent.setup();
    userApiMock.updateUser.mockRejectedValue(new ApiError('Validation failed', 422, 'VALIDATION_ERROR', {
      email: ['This email is already in use.'],
    }));
    const { queryClient } = setup();
    await screen.findByText('Sam Lee');
    await user.click(screen.getByRole('button', { name: 'Save user details' }));

    expect(await screen.findByText('This email is already in use.')).toBeInTheDocument();
    expect(screen.getByText('Some user details were rejected. Review the highlighted fields.')).toBeInTheDocument();
    expect(queryClient.getQueryData(userQueryKeys.detail(42))).toEqual(targetUser);
  });

  it('surfaces a backend timezone validation failure on the labeled field', async () => {
    const user = userEvent.setup();
    userApiMock.updateUser.mockRejectedValue(new ApiError('Validation failed', 422, 'VALIDATION_ERROR', {
      timezone: ['Select a valid IANA timezone.'],
    }));
    setup();
    await screen.findByText('Sam Lee');
    await user.clear(screen.getByLabelText('Time zone'));
    await user.type(screen.getByLabelText('Time zone'), 'Mars/Olympus');
    await user.click(screen.getByRole('button', { name: 'Save user details' }));

    expect(await screen.findByText('Select a valid IANA timezone.')).toBeInTheDocument();
    expect(screen.getByLabelText('Time zone')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables repeated update submissions while the save request is pending', async () => {
    const user = userEvent.setup();
    let resolveUpdate: ((user: ApiUser) => void) | undefined;
    userApiMock.updateUser.mockImplementation(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    setup();
    await screen.findByText('Sam Lee');
    const saveButton = screen.getByRole('button', { name: 'Save user details' });
    await user.click(saveButton);
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(userApiMock.updateUser).toHaveBeenCalledOnce();

    resolveUpdate?.({ ...targetUser, name: 'Sam Saved' });

    expect(await screen.findByText('Sam Saved')).toBeInTheDocument();
  });

  it.each([
    [403, 'The server denied this change. Check your access and the user account’s eligibility.'],
    [404, 'This user is no longer available. Return to the user list and refresh it.'],
  ])('reports update authorization or missing-user failure for HTTP %i', async (status, message) => {
    const user = userEvent.setup();
    userApiMock.updateUser.mockRejectedValue(new ApiError('Request failed', status));
    setup();
    await screen.findByText('Sam Lee');
    await user.click(screen.getByRole('button', { name: 'Save user details' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('opens deactivation confirmation, cancels without a request, then activates only after confirmation', async () => {
    const user = userEvent.setup();
    const suspendedUser = { ...targetUser, account_status: 'suspended' as const };
    const activatedUser = { ...suspendedUser, account_status: 'active' as const };
    userApiMock.activateUser.mockResolvedValue(activatedUser);
    const { queryClient } = setup({ getUser: vi.fn().mockResolvedValue(suspendedUser) });
    await screen.findByText('Sam Lee');

    await user.click(screen.getByRole('button', { name: 'Activate account' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Activate this user account?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(userApiMock.activateUser).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Activate account' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activate account' }));

    await waitFor(() => expect(userApiMock.activateUser).toHaveBeenCalledOnce());
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(queryClient.getQueryData(userQueryKeys.detail(42))).toEqual(activatedUser);
  });

  it('confirms deactivation, prevents duplicate submissions while pending, and invalidates directory data', async () => {
    const user = userEvent.setup();
    let resolveDeactivation: ((user: ApiUser) => void) | undefined;
    userApiMock.deactivateUser.mockImplementation(() => new Promise((resolve) => {
      resolveDeactivation = resolve;
    }));
    const { queryClient } = setup();
    const directoryKey = userQueryKeys.directoryList({ page: 1 });
    queryClient.setQueryData(directoryKey, {
      success: true,
      message: 'Directory loaded',
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });
    await screen.findByText('Sam Lee');
    await user.click(screen.getByRole('button', { name: 'Suspend account' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/active API tokens will be revoked/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Suspend account' });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(userApiMock.deactivateUser).toHaveBeenCalledOnce();

    resolveDeactivation?.({ ...targetUser, account_status: 'suspended' });

    await waitFor(() => expect(queryClient.getQueryState(directoryKey)?.isInvalidated).toBe(true));
    expect(await screen.findByText('Suspended')).toBeInTheDocument();
  });

  it('shows the last-System-Admin warning and keeps active status after backend denial', async () => {
    const user = userEvent.setup();
    const systemAdminTarget = {
      ...targetUser,
      roles: [{ ...memberRole, id: 99, name: 'System Admin', slug: 'system-admin' as const }],
    };
    userApiMock.deactivateUser.mockRejectedValue(new ApiError('Forbidden', 403, 'FORBIDDEN'));
    const { queryClient } = setup({ getUser: () => Promise.resolve(systemAdminTarget) });
    await screen.findByText('System administrator account');
    expect(screen.getByText(/last active System Admin/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Suspend account' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/last active System Admin/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Suspend account' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The server denied this change.');
    expect(queryClient.getQueryData(userQueryKeys.detail(systemAdminTarget.id))).toEqual(systemAdminTarget);
  });

  it.each([403, 404, 500])('keeps the confirmation dialog open and reports action HTTP %i', async (status) => {
    const user = userEvent.setup();
    userApiMock.deactivateUser.mockRejectedValue(new ApiError('Request failed', status));
    setup();
    await screen.findByText('Sam Lee');
    await user.click(screen.getByRole('button', { name: 'Suspend account' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend account' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      status === 404
        ? 'This user is no longer available.'
        : status === 500
          ? 'The server could not save this change.'
          : 'The server denied this change.',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
