import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardRoute } from '@/features/auth/pages/DashboardRoute';
import { apiClient } from '@/services/api/apiClient';
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
    locale: 'en',
    date_format: 'Y-m-d',
    time_format: '24h',
    created_at: null,
    updated_at: null,
  },
  roles: [],
  permissions: [],
};

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><DashboardRoute /></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('DashboardRoute', () => {
  it('preserves account shortcuts and does not request data without permission', () => {
    authMock.mockReturnValue({ user: { ...baseUser, permissions: ['users.view_directory'] } });
    const get = vi.spyOn(apiClient, 'get');

    renderDashboard();

    expect(screen.getByRole('heading', { name: "Today’s Workspace Agenda" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'People & access' })).toHaveAttribute('href', '/users');
    expect(screen.queryByRole('region', { name: 'Workspace overview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add booking' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('counts open tasks across pages and shows the first future appointment', async () => {
    authMock.mockReturnValue({
      user: { ...baseUser, permissions: ['projects.view', 'tasks.view', 'tasks.create', 'appointments.view', 'appointments.create'] },
    });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: baseUser.timezone, dateStyle: 'short' }).format(new Date());
    const project = { uuid: 'project-1', name: 'Workspace refresh' };
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (path, config) => {
      const params = config?.params as { page?: number; status?: string } | undefined;
      if (path === '/projects') return { data: { data: [project], meta: { total: 12 } } };
      if (path === '/tasks') {
        const items = params?.page === 1
          ? [{ uuid: 'late', title: 'Close feedback', status: 'in_progress', due_date: '2000-01-01', project }]
          : [
              { uuid: 'review', title: 'Review copy', status: 'in_review', due_date: today, project },
              { uuid: 'closed', title: 'Closed task', status: 'done', due_date: today, project },
            ];
        return { data: { data: items, meta: { last_page: 2 } } };
      }
      const start = new Date(Date.now() + (params?.status === 'confirmed' ? 3600 : 7200) * 1000);
      return { data: { data: [{
        uuid: params?.status,
        title: params?.status === 'confirmed' ? 'Design review' : 'Planning session',
        start_time: start.toISOString(),
        organizer: { name: 'Amina Noor' },
      }], meta: { last_page: 1 } } };
    });

    renderDashboard();

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Review copy' })).toHaveAttribute('href', '/my-work?task=review#task-details');
    expect(screen.getByRole('heading', { name: 'Due today' }).parentElement?.parentElement).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Overdue tasks' }).parentElement?.parentElement).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Pending reviews' }).parentElement?.parentElement).toHaveTextContent('1');
    expect(screen.queryByText('Closed task')).not.toBeInTheDocument();
    expect(await screen.findByText('Design review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View appointment' })).toHaveAttribute('href', '/appointments?appointment=confirmed#appointment-details');
    expect(screen.getByRole('button', { name: 'Add booking' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByRole('dialog', { name: 'Create task' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Today’s Workspace Agenda' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add booking' }));
    expect(screen.getByRole('dialog', { name: 'Schedule an appointment' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/tasks', expect.objectContaining({ params: expect.objectContaining({ page: 2, assignee: baseUser.id }) }));
  });

  it('renders nothing without an authenticated user', () => {
    authMock.mockReturnValue({ user: null });
    expect(renderDashboard().container).toBeEmptyDOMElement();
  });
});
