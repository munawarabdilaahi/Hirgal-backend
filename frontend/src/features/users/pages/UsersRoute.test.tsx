import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAnyPermission } from '@/features/auth/components/AuthRouteGuards';
import { UsersRoute } from '@/features/users/pages/UsersRoute';
import { userQueryKeys } from '@/features/users/user-queries';
import type { ApiDirectoryUser, ApiPaginatedResponse, ApiUser } from '@/services/api/contracts';

const { authMock, userApiMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userApiMock: {
    listUsers: vi.fn(),
    listDirectory: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    activateUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: authMock }));
vi.mock('@/services/api/userApi', () => ({ userApi: userApiMock }));

const memberRole = { id: 4, name: 'Member', slug: 'member' as const, description: null, is_system: false };
const user = (permissions: string[]): ApiUser => ({
  id: 7,
  name: 'Amina Noor',
  email: 'amina@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  roles: [memberRole],
  permissions,
});
const directoryPerson: ApiDirectoryUser = {
  id: 9,
  name: 'Sam Lee',
  email: 'sam@example.test',
  avatar_url: null,
  timezone: 'UTC',
  job_title: 'Designer',
  department: 'Design',
};

function directoryResponse({
  data = [directoryPerson],
  page = 1,
  lastPage = 3,
  total = 45,
}: {
  data?: ApiDirectoryUser[];
  page?: number;
  lastPage?: number;
  total?: number;
} = {}): ApiPaginatedResponse<ApiDirectoryUser> {
  return {
    success: true,
    message: 'Directory loaded',
    data,
    meta: { current_page: page, last_page: lastPage, per_page: 20, total },
  };
}

function adminResponse(): ApiPaginatedResponse<ApiUser> {
  return {
    success: true,
    message: 'Users loaded',
    data: [user([])],
    meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
  };
}

function renderRoute(
  permissions: string[] = ['users.view_directory'],
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  }),
) {
  authMock.mockReturnValue({ user: user(permissions) });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RequireAnyPermission permissions={['users.view_directory', 'users.view']}>
            <UsersRoute />
          </RequireAnyPermission>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('UsersRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApiMock.listDirectory.mockResolvedValue(directoryResponse());
    userApiMock.listUsers.mockResolvedValue(adminResponse());
  });

  it('shows only sanitized directory fields to directory viewers', async () => {
    const directoryRow = {
      ...directoryPerson,
      account_status: 'suspended',
      roles: [memberRole],
      permissions: ['users.update'],
      profile: { phone: '555-0100', bio: 'private', notification_preferences: { email: true } },
    } as ApiDirectoryUser;
    userApiMock.listDirectory.mockResolvedValue(directoryResponse({ data: [directoryRow] }));

    renderRoute();

    expect(await screen.findAllByText('Sam Lee')).toHaveLength(2);
    expect(screen.getAllByText('Sam Lee')).toHaveLength(2);
    expect(screen.getAllByText(/sam@example\.test/)).toHaveLength(2);
    expect(screen.queryByText('Member')).not.toBeInTheDocument();
    expect(screen.queryByText('Suspended')).not.toBeInTheDocument();
    expect(screen.queryByText('users.update')).not.toBeInTheDocument();
    expect(screen.queryByText('555-0100')).not.toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(userApiMock.listDirectory).toHaveBeenCalledWith({ page: 1, per_page: 20 });
    expect(userApiMock.listUsers).not.toHaveBeenCalled();
  });

  it('shows account status and global roles only in the administrative list', async () => {
    renderRoute(['users.view']);

    expect(await screen.findAllByText('Member')).toHaveLength(2);
    expect(screen.getAllByText('Member')).toHaveLength(2);
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View Amina Noor' })).toHaveAttribute('href', '/users/7');
    expect(userApiMock.listUsers).toHaveBeenCalledWith({
      page: 1,
      per_page: 15,
      sort_by: 'created_at',
      sort_direction: 'desc',
    });
    expect(userApiMock.listDirectory).not.toHaveBeenCalled();
  });

  it('denies direct directory navigation without either supported permission', () => {
    const queryClient = new QueryClient();
    const adminListKey = userQueryKeys.administrativeList({
      page: 1,
      per_page: 15,
      sort_by: 'created_at',
      sort_direction: 'desc',
    });
    queryClient.setQueryData(adminListKey, adminResponse());
    renderRoute([], queryClient);

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('Amina Noor')).not.toBeInTheDocument();
    expect(userApiMock.listDirectory).not.toHaveBeenCalled();
    expect(userApiMock.listUsers).not.toHaveBeenCalled();
  });

  it('shows the loading state while the directory request is pending', () => {
    userApiMock.listDirectory.mockReturnValue(new Promise(() => {}));

    renderRoute();

    expect(screen.getByText('Loading team directory')).toBeInTheDocument();
  });

  it('debounces search, sends the search filter, and returns to page one when search is cleared', async () => {
    const userInteraction = userEvent.setup();
    renderRoute();
    await screen.findAllByText('Sam Lee');

    await userInteraction.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({ page: 2, per_page: 20 }));
    const callCountBeforeSearch = userApiMock.listDirectory.mock.calls.length;
    const searchInput = screen.getByRole('searchbox', { name: 'Search people' });
    fireEvent.change(searchInput, { target: { value: 'sam' } });
    expect(userApiMock.listDirectory).toHaveBeenCalledTimes(callCountBeforeSearch);

    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({
      page: 1,
      per_page: 20,
      search: 'sam',
    }), { timeout: 2000 });
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({ page: 1, per_page: 20 }));
  });

  it('sends next, previous, and last-page parameters to the directory API', async () => {
    const userInteraction = userEvent.setup();
    userApiMock.listDirectory.mockImplementation(async (filters: { page?: number }) =>
      directoryResponse({ page: filters.page ?? 1 }));
    renderRoute();
    await screen.findAllByText('Sam Lee');

    await userInteraction.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({ page: 2, per_page: 20 }));
    await userInteraction.click(screen.getByRole('button', { name: 'Go to previous page' }));
    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({ page: 1, per_page: 20 }));
    await userInteraction.click(screen.getByRole('button', { name: 'Go to page 3' }));
    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({ page: 3, per_page: 20 }));
  });

  it('shows an empty search result message', async () => {
    userApiMock.listDirectory.mockResolvedValue(directoryResponse({ data: [], lastPage: 1, total: 0 }));
    const userInteraction = userEvent.setup();
    renderRoute();
    await screen.findByText('No teammates to show');
    await userInteraction.type(screen.getByRole('searchbox', { name: 'Search people' }), 'unknown');

    expect(await screen.findByText('No matching people')).toBeInTheDocument();
    await waitFor(() => expect(userApiMock.listDirectory).toHaveBeenCalledWith({
      page: 1,
      per_page: 20,
      search: 'unknown',
    }), { timeout: 2000 });
  });

  it('shows API validation errors and retries a failed directory request', async () => {
    userApiMock.listDirectory
      .mockRejectedValueOnce({ status: 422 })
      .mockResolvedValueOnce(directoryResponse());
    const userInteraction = userEvent.setup();
    renderRoute();

    expect(await screen.findByText('The API rejected one of these filters. Clear the filters and try again.')).toBeInTheDocument();
    await userInteraction.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findAllByText('Sam Lee')).toHaveLength(2);
    expect(userApiMock.listDirectory).toHaveBeenCalledTimes(2);
  });

  it('renders server failure feedback for the administrative list', async () => {
    userApiMock.listUsers.mockRejectedValue(new Error('server details must not be shown'));
    renderRoute(['users.view']);

    expect(await screen.findByText('Hirgal could not load this list. Check your connection and try again.')).toBeInTheDocument();
    expect(screen.queryByText('server details must not be shown')).not.toBeInTheDocument();
  });
});
