import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersRoute } from '@/features/users/pages/UsersRoute';
import type { ApiUser } from '@/services/api/contracts';

const { authMock, adminQueryMock, directoryQueryMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  adminQueryMock: vi.fn(),
  directoryQueryMock: vi.fn(),
}));

vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: authMock }));
vi.mock('@/features/users/user-queries', () => ({
  useAdministrativeUsers: adminQueryMock,
  useUserDirectory: directoryQueryMock,
}));

const user = (permissions: string[]): ApiUser => ({
  id: 7,
  name: 'Amina Noor',
  email: 'amina@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  roles: [{ id: 4, name: 'Member', slug: 'member', description: null, is_system: false }],
  permissions,
});

function renderRoute() {
  return render(<MemoryRouter><UsersRoute /></MemoryRouter>);
}

describe('UsersRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    directoryQueryMock.mockReturnValue({
      data: {
        data: [{ id: 9, name: 'Sam Lee', email: 'sam@example.test', avatar_url: null, timezone: 'UTC', job_title: 'Designer', department: 'Design' }],
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    adminQueryMock.mockReturnValue({
      data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows only the sanitized people directory to directory viewers', () => {
    authMock.mockReturnValue({ user: user(['users.view_directory']) });

    renderRoute();

    expect(screen.getByRole('heading', { name: 'Team directory' })).toBeInTheDocument();
    expect(screen.getAllByText('Sam Lee')).toHaveLength(2);
    expect(screen.queryByText('Member')).not.toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(directoryQueryMock).toHaveBeenCalled();
    expect(adminQueryMock).not.toHaveBeenCalled();
  });

  it('shows account status and global roles only in the administrative list', () => {
    authMock.mockReturnValue({ user: user(['users.view']) });
    adminQueryMock.mockReturnValue({
      data: {
        data: [user([])],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderRoute();

    expect(screen.getByRole('heading', { name: 'Users & access' })).toBeInTheDocument();
    expect(screen.getAllByText('Member')).toHaveLength(2);
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View Amina Noor' })).toHaveAttribute('href', '/users/7');
    expect(directoryQueryMock).not.toHaveBeenCalled();
  });

  it('shows an explicit empty state when the selected list has no results', () => {
    authMock.mockReturnValue({ user: user(['users.view_directory']) });
    directoryQueryMock.mockReturnValue({
      data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderRoute();

    expect(screen.getByText('No teammates to show')).toBeInTheDocument();
  });
});
