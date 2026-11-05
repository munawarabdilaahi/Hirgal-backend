import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardRoute } from '@/features/auth/pages/DashboardRoute';
import type { ApiUser } from '@/services/api/contracts';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: authMock }));

const baseUser: ApiUser = {
  id: 8,
  name: 'Amina Noor',
  email: 'amina@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  profile: {
    id: 8,
    phone: null,
    job_title: 'Designer',
    department: 'Product',
    bio: null,
    notification_preferences: {},
    theme_preference: 'system',
    created_at: null,
    updated_at: null,
  },
  roles: [],
  permissions: [],
};

describe('DashboardRoute', () => {
  it('shows real account details and profile shortcuts without inventing workspace metrics', () => {
    authMock.mockReturnValue({ user: baseUser });

    render(<MemoryRouter><DashboardRoute /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Welcome, Amina Noor' })).toBeInTheDocument();
    expect(screen.getByText('amina@example.test')).toBeInTheDocument();
    expect(screen.getByText('Designer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage profile/i })).toHaveAttribute('href', '/profile');
    expect(screen.queryByText(/active projects|tasks due|team members/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /people & access/i })).not.toBeInTheDocument();
  });

  it('shows the people shortcut when the authenticated user has directory permission', () => {
    authMock.mockReturnValue({ user: { ...baseUser, permissions: ['users.view_directory'] } });

    render(<MemoryRouter><DashboardRoute /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /people & access/i })).toHaveAttribute('href', '/users');
  });

  it('renders safe fallbacks for incomplete account data', () => {
    authMock.mockReturnValue({
      user: {
        ...baseUser,
        timezone: '',
        profile: null,
        roles: [],
      },
    });

    render(<MemoryRouter><DashboardRoute /></MemoryRouter>);

    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('No global role assigned')).toBeInTheDocument();
    expect(screen.getByText('Add a job title or department from your profile to help teammates identify you.')).toBeInTheDocument();
  });

  it('renders no account details when no authenticated user is available', () => {
    authMock.mockReturnValue({ user: null });

    const { container } = render(<MemoryRouter><DashboardRoute /></MemoryRouter>);

    expect(container).toBeEmptyDOMElement();
  });
});
