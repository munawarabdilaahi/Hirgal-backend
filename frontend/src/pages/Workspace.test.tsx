import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { apiClient } from '@/services/api/apiClient';
import { habitApi } from '@/services/api/habitApi';
import { userApi } from '@/services/api/userApi';
import type { ApiUser } from '@/services/api/contracts';
import Workspace from './Workspace';

const user = {
  id: 42,
  name: 'Amina Hassan',
  email: 'amina@example.com',
  account_status: 'active',
  avatar_url: null,
  timezone: 'UTC',
  roles: [],
  permissions: ['tasks.view'],
} as ApiUser;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session workspace appointments and habits', () => {
  it('opens the appointments calendar through the session workspace', async () => {
    window.history.replaceState(null, '', '/appointments');
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 15 } },
    });

    render(<AppProviders><Workspace user={{ ...user, permissions: ['appointments.view'] }} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByText('No appointments in this range.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/appointments/calendar', expect.any(Object));
    expect(screen.getByRole('link', { name: 'Appointments' })).toHaveAttribute('href', '/appointments');
  });

  it('opens the habits list and navigates to the new habit form', async () => {
    window.history.replaceState(null, '', '/habits');
    const list = vi.spyOn(habitApi, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 },
    });
    const overview = vi.spyOn(habitApi, 'dailyOverview').mockResolvedValue({
      date: '2026-11-14', timezone: 'UTC', habits: [],
    });

    render(<AppProviders><Workspace user={{ ...user, permissions: ['habits.manage'] }} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByText('No habits found')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    expect(overview).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Habits' })).toHaveAttribute('href', '/habits');
    fireEvent.click(screen.getByRole('link', { name: 'New habit' }));
    expect(await screen.findByRole('heading', { name: 'Create habit' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/habits/new');
  });
});

describe('session workspace notifications and activity', () => {
  it('loads the inbox and marks a notification as read', async () => {
    window.history.replaceState(null, '', '/notifications');
    const list = { data: { data: [{ id: 'notice-1', data: { title: 'Project invitation' }, read_at: null, created_at: null }], meta: { current_page: 1, last_page: 1 } } };
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce(list)
      .mockResolvedValueOnce({ data: { data: { unread_count: 1 } } })
      .mockResolvedValue(list);
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: { success: true } });

    render(<AppProviders><Workspace user={user} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByText('Project invitation')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/notifications', { params: { page: 1 } });
    expect(screen.getByRole('link', { name: 'Follow-up inbox' })).toHaveAttribute('href', '/notifications');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/notifications/notice-1/read'));
  });

  it.each([false, true])('loads personal activity and limits system audit to authorized users (audit.view=%s)', async (canAudit) => {
    window.history.replaceState(null, '', '/activity');
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [], meta: { current_page: 1, last_page: 1 } },
    });
    const permissions = canAudit ? ['audit.view'] : [];

    render(<AppProviders><Workspace user={{ ...user, permissions }} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByText('No activity on this page.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '/activity');
    expect(get).toHaveBeenCalledWith('/activity-logs/my', { params: { page: 1 } });
    if (canAudit) {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Show system audit log' }));
      await waitFor(() => expect(get).toHaveBeenCalledWith('/activity-logs', { params: { page: 1 } }));
    } else {
      expect(screen.queryByRole('checkbox', { name: 'Show system audit log' })).not.toBeInTheDocument();
      expect(get).not.toHaveBeenCalledWith('/activity-logs', expect.anything());
    }
  });
});

describe('session workspace user administration', () => {
  it('loads the collaborative directory for a directory-only user', async () => {
    window.history.replaceState(null, '', '/users');
    const directory = vi.spyOn(userApi, 'listDirectory').mockResolvedValue({
      success: true, message: 'ok', data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });
    const users = vi.spyOn(userApi, 'listUsers');

    render(<AppProviders><Workspace user={{ ...user, permissions: ['users.view_directory'] }} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByRole('heading', { name: 'Team directory' })).toBeInTheDocument();
    await waitFor(() => expect(directory).toHaveBeenCalled());
    expect(users).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'People & access' })).toHaveAttribute('href', '/users');
  });

  it('loads the administrative list and sends an invitation', async () => {
    window.history.replaceState(null, '', '/users');
    const list = vi.spyOn(userApi, 'listUsers').mockResolvedValue({
      success: true, message: 'ok', data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });
    const roles = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [{ id: 4, name: 'Member', slug: 'member' }] },
    });
    const invite = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

    render(<AppProviders><Workspace user={{ ...user, permissions: ['users.view', 'users.invite'] }} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByRole('heading', { name: 'Users & access' })).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Invite user' }));
    expect(await screen.findByRole('option', { name: 'Member' })).toBeInTheDocument();
    expect(roles).toHaveBeenCalledWith('/invitations/roles');
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText(/System role/), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(invite).toHaveBeenCalledWith('/invitations', { email: 'new@example.test', role_id: 4 }));
  });

  it('updates the session user display after editing their own administrative details', async () => {
    window.history.replaceState(null, '', '/users/42');
    const admin = { ...user, permissions: ['users.view', 'users.update'] };
    vi.spyOn(userApi, 'getUser').mockResolvedValue(admin);
    const update = vi.spyOn(userApi, 'updateUser').mockResolvedValue({ ...admin, name: 'Amina Updated' });

    render(<AppProviders><Workspace user={admin} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByRole('heading', { name: 'User details for Amina Hassan' }, { timeout: 5000 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Amina Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save user details' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Open account menu for Amina Updated' })).toBeInTheDocument();
  });
});

describe('session workspace tasks', () => {
  it.each([
    ['/tasks', 'Tasks', undefined],
    ['/my-work', 'My work', 42],
  ] as const)('opens %s and requests the expected task list', async (path, heading, assignee) => {
    window.history.replaceState(null, '', path);
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 15 } },
    });

    render(<AppProviders><Workspace user={user} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(await screen.findByText(assignee ? 'No assigned tasks match this view.' : 'No tasks match this view.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/tasks', {
      params: {
        page: 1,
        assignee,
        status: undefined,
        ...(assignee ? { sort_by: 'due_date', sort_direction: 'asc' } : {}),
      },
    });
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute('href', path);
  });
});
